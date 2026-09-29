// Resume resolver for Google Drive.
//
// Google Drive API v3 refuses API-key auth (401 CREDENTIALS_MISSING), so the
// service-account credential has to live somewhere server-side. This Worker
// holds it and exposes three routes to the static site:
//
//   GET /           -> { name, modifiedTime, size, updated }  for the newest PDF
//   GET /download   -> the PDF bytes, as an attachment
//   GET /view       -> the PDF bytes, inline
//
// The file listing is cached at the edge, so Drive quota is a few calls an
// hour no matter how many visitors the portfolio gets.
//
// Deploy:
//   1. Google Cloud Console -> enable "Google Drive API".
//   2. Create a service account, then a JSON key. The downloaded .json holds
//      client_email and private_key — the private_key value is the PEM.
//   3. In Drive, share the resume folder with that service account's
//      client_email as Viewer. The folder does not need to be public.
//   4. Cloudflare dashboard -> Workers & Pages -> Create -> paste this file.
//      Settings -> Variables: FOLDER_ID (plain text), SA_CLIENT_EMAIL (plain
//      text), SA_PRIVATE_KEY (secret, paste the whole PEM including the
//      BEGIN/END lines).
//   5. Put the resulting https://<name>.<subdomain>.workers.dev URL into
//      RESUME_ENDPOINT in js/resume.js.
//
// Resume folder:
//   https://drive.google.com/drive/folders/1GeVABCnetfIYMeXd_cx6UI01PxPx3UW9
//   FOLDER_ID = 1GeVABCnetfIYMeXd_cx6UI01PxPx3UW9
//
// The most recently modified file in the folder is the one served, whatever it
// is called. Optional DOWNLOAD_NAME overrides the filename visitors get.

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const JWT_BEARER = "urn:ietf:params:oauth:grant-type:jwt-bearer";
const DEFAULT_TTL = 60;
const TOKEN_EXPIRY_SKEW_MS = 60 * 1000;


const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Expose-Headers": "Content-Disposition, Content-Length",
};

let tokenCache = null;

const json = (body, status, extraHeaders) =>
    new Response(JSON.stringify(body), {
        status,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
            ...CORS_HEADERS,
            ...(extraHeaders || {}),
        },
    });

// ===================== SERVICE ACCOUNT AUTH =====================
const base64Url = bytes => {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const base64UrlFromString = value =>
    base64Url(new TextEncoder().encode(value));

const pemProblem = pem => {
    const raw = String(pem == null ? "" : pem);
    if (!raw.trim()) return "SA_PRIVATE_KEY is empty";
    if (raw.includes("private_key") || /[{}]/.test(raw)) {
        return "SA_PRIVATE_KEY looks like the whole JSON key file. Paste only the private_key value, not the file.";
    }
    if (!/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(raw)) {
        return "SA_PRIVATE_KEY is missing the -----BEGIN PRIVATE KEY----- line";
    }

    // literal "\n" escapes first, so a value copied straight out of the
    // downloaded .json works just as well as a real multi-line paste.
    const body = raw
        .replace(/\\r\\n|\\n|\\r/g, "\n")
        .replace(/-----(BEGIN|END) [A-Z ]*PRIVATE KEY-----/g, "")
        .replace(/\s+/g, "");

    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(body)) {
        return "SA_PRIVATE_KEY contains characters that are not part of a PEM key. Re-copy it from a plain text editor.";
    }
    if (body.length % 4 !== 0) {
        return `SA_PRIVATE_KEY is truncated or has extra characters (body is ${body.length} chars, needs a multiple of 4). Re-copy the entire private_key value including the BEGIN/END lines.`;
    }
    return null;
};

const privateKeyToDer = pem => {
    const problem = pemProblem(pem);
    if (problem) throw new Error(problem);

    const body = String(pem)
        .replace(/\\r\\n|\\n|\\r/g, "\n")
        .replace(/-----(BEGIN|END) [A-Z ]*PRIVATE KEY-----/g, "")
        .replace(/\s+/g, "");

    const binary = atob(body);
    const der = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) der[i] = binary.charCodeAt(i);
    return der;
};

const importPrivateKey = pem =>
    crypto.subtle.importKey(
        "pkcs8",
        privateKeyToDer(pem),
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["sign"]
    );

const createAssertion = async (pem, clientEmail) => {
    const key = await importPrivateKey(pem);
    const issuedAt = Math.floor(Date.now() / 1000);
    const header = base64UrlFromString(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claims = base64UrlFromString(
        JSON.stringify({
            iss: clientEmail,
            scope: DRIVE_SCOPE,
            aud: TOKEN_URL,
            iat: issuedAt,
            exp: issuedAt + 3600,
        })
    );
    const signature = new Uint8Array(
        await crypto.subtle.sign(
            "RSASSA-PKCS1-v1_5",
            key,
            new TextEncoder().encode(`${header}.${claims}`)
        )
    );
    return `${header}.${claims}.${base64Url(signature)}`;
};

const getAccessToken = async env => {
    if (tokenCache && tokenCache.expiresAt > Date.now() + TOKEN_EXPIRY_SKEW_MS) {
        return tokenCache.token;
    }

    const missing = ["FOLDER_ID", "SA_CLIENT_EMAIL", "SA_PRIVATE_KEY"].filter(
        key => !env[key] || String(env[key]).trim() === ""
    );
    if (missing.length) throw new Error(`Worker is missing variables: ${missing.join(", ")}`);

    const assertion = await createAssertion(env.SA_PRIVATE_KEY, env.SA_CLIENT_EMAIL);
    const response = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: JWT_BEARER, assertion }).toString(),
    });

    if (!response.ok) {
        throw new Error(`Google token request failed (${response.status}): ${await response.text()}`);
    }

    const data = await response.json();
    const expiresIn = Number(data.expires_in) || 3600;
    tokenCache = {
        token: data.access_token,
        expiresAt: Date.now() + (expiresIn * 1000) - TOKEN_EXPIRY_SKEW_MS,
    };
    return tokenCache.token;
};

const driveFetch = async (url, env) => {
    let token = await getAccessToken(env);
    let response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

    if (response.status === 401) {
        tokenCache = null;
        token = await getAccessToken(env);
        response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    }

    return response;
};

// ===================== LATEST FILE =====================
const listUrl = folderId => {
    const query = [
        `q=${encodeURIComponent(`'${folderId}' in parents and trashed = false`)}`,
        `orderBy=${encodeURIComponent("modifiedTime desc")}`,
        "pageSize=25",
        `fields=${encodeURIComponent("files(id,name,mimeType,modifiedTime,size)")}`,
        "supportsAllDrives=true",
        "includeItemsFromAllDrives=true",
    ];
    return `${DRIVE_FILES_URL}?${query.join("&")}`;
};

// Google-native files and shortcuts have no document bytes to hand back from
// alt=media, so they are skipped. Everything else qualifies, because the most
// recent upload wins no matter what it is called or what format it is in.
const UNSERVABLE_MIME_TYPES = new Set([
    "application/vnd.google-apps.folder",
    "application/vnd.google-apps.document",
    "application/vnd.google-apps.spreadsheet",
    "application/vnd.google-apps.presentation",
    "application/vnd.google-apps.drawing",
    "application/vnd.google-apps.form",
    "application/vnd.google-apps.script",
    "application/vnd.google-apps.shortcut",
    "application/vnd.google-apps.map",
    "application/vnd.google-apps.site",
]);

const pickLatest = files => {
    const servable = (Array.isArray(files) ? files : []).filter(
        file => file && file.id && file.name && !UNSERVABLE_MIME_TYPES.has(file.mimeType)
    );
    // Newest modifiedTime wins, so the file name is irrelevant. The name is
    // only a tie-break for identical timestamps.
    servable.sort((a, b) => {
        const byTime = new Date(b.modifiedTime || 0) - new Date(a.modifiedTime || 0);
        return byTime !== 0 ? byTime : String(a.name).localeCompare(String(b.name));
    });
    return servable[0] || null;
};

const latestFile = async env => {
    const response = await driveFetch(listUrl(env.FOLDER_ID), env);
    if (!response.ok) {
        throw new Error(`Drive list failed (${response.status}): ${await response.text()}`);
    }
    const data = await response.json();
    const file = pickLatest(data.files);
    if (!file) throw new Error("No file found in the configured Drive folder");
    return file;
};

const cacheTtl = env => {
    const configured = Number(env.CACHE_TTL_SECONDS);
    return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TTL;
};

const sanitiseFileName = name =>
    String(name == null ? "" : name)
        .replace(/[\\/:*?"<>|\r\n\t]+/g, " ")
        .replace(/\s+/g, " ")
        .trim() || "resume";

// DOWNLOAD_NAME lets visitors always receive the same tidy filename, whatever
// the uploaded file happens to be called. Unset, the Drive name is used.
const downloadName = (file, env) => {
    const override = env.DOWNLOAD_NAME ? sanitiseFileName(env.DOWNLOAD_NAME) : "";
    return override || sanitiseFileName(file.name);
};

const describe = (file, env, fetchedAt) => ({
    name: file.name,
    downloadName: downloadName(file, env),
    mimeType: file.mimeType,
    modifiedTime: file.modifiedTime,
    size: file.size,
    ttl: cacheTtl(env),
    fetchedAt,
});

// Only the metadata is cached, so a page full of visitors still costs Drive one
// list call per TTL. The file bytes are never cached: every /download and /view
// re-resolves the newest file, so a freshly uploaded or deleted resume takes
// effect immediately. ?fresh=1 skips the cached read.
const cacheKeyFor = request => {
    const url = new URL(request.url);
    return new Request(`${url.origin}${url.pathname}`, { method: "GET" });
};

const metadata = async (request, env) => {
    const cache = caches.default;
    const key = cacheKeyFor(request);
    const fresh = new URL(request.url).searchParams.get("fresh") === "1";

    if (!fresh) {
        const cached = await cache.match(key);
        if (cached) {
            const entry = await cached.json();
            if (entry && entry.fetchedAt && Date.now() - entry.fetchedAt < cacheTtl(env) * 1000) {
                return json(entry, 200, { "Cache-Control": `public, max-age=${cacheTtl(env)}` });
            }
            await cache.delete(key);
        }
    }

    const file = await latestFile(env);
    const entry = describe(file, env, Date.now());
    const response = json(entry, 200, { "Cache-Control": `public, max-age=${cacheTtl(env)}` });
    await cache.put(key, response.clone());
    return response;
};

// ===================== FILE BYTES =====================
const contentDisposition = (type, name) => {
    const fallback = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_") || "resume.pdf";
    return `${type}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name)}`;
};

const sendFile = async (env, type) => {
    const file = await latestFile(env);
    const response = await driveFetch(
        `${DRIVE_FILES_URL}/${file.id}?alt=media&supportsAllDrives=true`,
        env
    );
    if (!response.ok) {
        throw new Error(`Drive download failed (${response.status}): ${await response.text()}`);
    }

    return new Response(response.body, {
        status: 200,
        headers: {
            "Content-Type": response.headers.get("Content-Type") || "application/pdf",
            "Content-Disposition": contentDisposition(type, downloadName(file, env)),
            // Never let a browser or intermediary replay old bytes: the whole
            // point is that the newest upload wins immediately.
            "Cache-Control": "no-cache",
            "X-Content-Type-Options": "nosniff",
            ...CORS_HEADERS,
        },
    });
};

// ===================== ROUTER =====================
export default {
    async fetch(request, env) {
        const { pathname } = new URL(request.url);

        if (request.method === "OPTIONS") {
            return new Response(null, { status: 204, headers: CORS_HEADERS });
        }

        if (request.method !== "GET") {
            return json({ error: "Method not allowed" }, 405);
        }

        try {
            if (pathname === "/" || pathname === "/resume") return await metadata(request, env);
            if (pathname === "/download") return await sendFile(env, "attachment");
            if (pathname === "/view") return await sendFile(env, "inline");
            if (pathname === "/health") {
                const file = await latestFile(env);
                return json({ ok: true, name: file.name, modifiedTime: file.modifiedTime });
            }
            return json({ error: "Not found" }, 404);
        } catch (err) {
            return json({ error: err.message || "Resume lookup failed" }, 500);
        }
    },
};
