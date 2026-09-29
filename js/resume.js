// ===================== RESUME =====================
// The resume PDF is not stored in this repository. A Cloudflare Worker
// (worker/resume.worker.js) holds a Google Drive service-account credential,
// looks up the most recently modified file in a Drive folder, and serves the
// bytes. Uploading a new resume to Drive therefore updates the site with no
// commit and no push.
//
// RESUME_ENDPOINT is the deployed Worker URL. The https:// scheme is added
// automatically if it is left off, because fetch() would otherwise treat a bare
// hostname as a relative path and fail.
const RESUME_ENDPOINT = "worker.jnaveenraaj2003.workers.dev";

// Safety net if the Worker ever goes down. Point this at any always-present
// PDF and the buttons keep working; "" disables it. Left empty on purpose so
// no resume binary lives in this repository.
const RESUME_FALLBACK_URL = "";

const RESUME_FALLBACK_NAME = "J Naveen Raaj Resume Latest.pdf";
const RESUME_DRIVE_FOLDER_URL =
    "https://drive.google.com/drive/folders/1GeVABCnetfIYMeXd_cx6UI01PxPx3UW9";
const RESUME_CACHE_KEY = "portfolio_resume_file";

const isConfigured = () =>
    Boolean(RESUME_ENDPOINT) && !RESUME_ENDPOINT.startsWith("PASTE_");

const trimEndpoint = () => {
    const url = RESUME_ENDPOINT.replace(/\/+$/, "");
    return /^https?:\/\//i.test(url) ? url : `https://${url}`;
};

const formatDate = iso => {
    const date = new Date(iso);
    if (isNaN(date)) return "";
    return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

// ===================== WIRING =====================
const resumeButtons = document.getElementById("resumeButtons");
const downloadLink = document.getElementById("resumeDownload");
const viewLink = document.getElementById("resumeView");
const resumeNote = document.getElementById("resumeNote");

if (resumeButtons && downloadLink && viewLink) {
    let current = null; // { name, href, viewHref, source }
    let downloading = false;
    let prefetched = false;
    let blobUrl = null;
    let blobKey = null;
    let inflight = null;

    const setState = state => resumeButtons.setAttribute("data-resume-state", state);

    const showNote = html => {
        if (!resumeNote) return;
        if (!html) {
            resumeNote.hidden = true;
            resumeNote.textContent = "";
            return;
        }
        resumeNote.hidden = false;
        resumeNote.innerHTML = html;
    };

    const readCache = () => {
        try {
            const raw = localStorage.getItem(RESUME_CACHE_KEY);
            const file = raw ? JSON.parse(raw) : null;
            return file && file.name && file.modifiedTime ? file : null;
        } catch (err) {
            return null;
        }
    };

    const writeCache = file => {
        try {
            localStorage.setItem(RESUME_CACHE_KEY, JSON.stringify(file));
        } catch (err) {
            /* private mode or quota — the cache is optional */
        }
    };

    // The Worker serves the newest file in the Drive folder whatever it is
    // named, and downloadName is the tidy name visitors get. driveName is kept
    // only for the tooltip so the source file stays identifiable.
    const fromMetadata = file => ({
        name: file.downloadName || file.name,
        driveName: file.name,
        modifiedTime: file.modifiedTime,
        href: `${trimEndpoint()}/download`,
        viewHref: `${trimEndpoint()}/view`,
        source: "drive",
    });

    const apply = resume => {
        current = resume;
        prefetched = false;
        downloadLink.href = resume.href;
        downloadLink.setAttribute("download", resume.name);
        viewLink.href = resume.viewHref;

        const when = resume.modifiedTime ? formatDate(resume.modifiedTime) : "";
        downloadLink.setAttribute(
            "title",
            when ? `Download ${resume.name} (updated ${when})` : `Download ${resume.name}`
        );
        viewLink.setAttribute("title", `Open ${resume.name} in a new tab`);

        downloadLink.removeAttribute("aria-disabled");
        viewLink.removeAttribute("aria-disabled");
        resumeButtons.setAttribute("aria-busy", "false");
        setState("ready");
    };

    // A same-origin PDF honours the `download` attribute and needs no
    // JavaScript, so the fallback path is a plain href.
    const useFallback = () => {
        if (!RESUME_FALLBACK_URL) return false;
        apply({
            name: RESUME_FALLBACK_NAME,
            href: RESUME_FALLBACK_URL,
            viewHref: RESUME_FALLBACK_URL,
            source: "fallback",
        });
        return true;
    };

    // Blob URLs are same-origin, so the browser honours `download` and saves
    // the file under its real name instead of navigating to the PDF.
    const fetchBlobUrl = resume => {
        if (blobKey === resume.href && blobUrl) return Promise.resolve(blobUrl);
        if (inflight && inflight.key === resume.href) return inflight.promise;

        const promise = fetch(resume.href, { credentials: "omit", cache: "no-store" })
            .then(res => {
                if (!res.ok) throw new Error(`Resume download failed (${res.status})`);
                return res.blob();
            })
            .then(blob => {
                if (blobUrl) URL.revokeObjectURL(blobUrl);
                blobUrl = URL.createObjectURL(blob);
                blobKey = resume.href;
                return blobUrl;
            })
            .catch(err => {
                inflight = null;
                throw err;
            });

        inflight = { key: resume.href, promise };
        return promise;
    };

    // Warm the bytes only on intent, so a plain page view never hits the
    // Worker for the file itself.
    const prefetch = () => {
        if (prefetched || !current || current.source === "fallback") return;
        prefetched = true;
        fetchBlobUrl(current).catch(() => {
            prefetched = false;
        });
    };

    downloadLink.addEventListener("pointerenter", prefetch, { passive: true });
    downloadLink.addEventListener("focus", prefetch);
    downloadLink.addEventListener("touchstart", prefetch, { passive: true });

    downloadLink.addEventListener("click", async event => {
        if (!current || current.source === "fallback") return;
        event.preventDefault();
        if (downloading) return;
        downloading = true;

        const idleLabel = downloadLink.innerHTML;
        downloadLink.innerHTML = 'Preparing... <i class="fa fa-spinner fa-spin"></i>';

        try {
            const url = await fetchBlobUrl(current);
            const link = document.createElement("a");
            link.href = url;
            link.download = current.name;
            link.rel = "noopener";
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.warn("[resume] blob download failed, navigating instead", err);
            window.location.href = current.href;
        } finally {
            downloading = false;
            downloadLink.innerHTML = idleLabel;
        }
    });

    const resolve = async () => {
        if (!isConfigured()) {
            if (useFallback()) return;
            setState("error");
            showNote(
                `Resume links are not configured yet. <a href="${RESUME_DRIVE_FOLDER_URL}" target="_blank" rel="noopener">Get it from Drive</a> in the meantime.`
            );
            return;
        }

        try {
            // "no-cache" so the browser revalidates the filename instead of
            // replaying a stale one. The Worker still answers from its own
            // short cache, so this costs no extra Drive quota.
            const response = await fetch(`${trimEndpoint()}/`, {
                credentials: "omit",
                cache: "no-cache",
            });
            if (!response.ok) throw new Error(`Resolver request failed (${response.status})`);

            const file = await response.json();
            if (!file || !file.name) throw new Error("Resolver returned no file");

            apply(fromMetadata(file));
            showNote(null);
            writeCache({
                name: file.name,
                downloadName: file.downloadName,
                modifiedTime: file.modifiedTime,
            });
        } catch (err) {
            console.warn("[resume] resolver unreachable", err);
            if (useFallback()) return;
            setState("error");
            showNote(
                `Resume unavailable right now. <a href="${RESUME_DRIVE_FOLDER_URL}" target="_blank" rel="noopener">Get it from Drive</a> or try again shortly.`
            );
        }
    };

    setState("loading");
    const cached = readCache();
    if (cached && isConfigured()) apply(fromMetadata(cached));
    resolve();
}
