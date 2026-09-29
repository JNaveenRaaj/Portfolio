// Pre-flight check for the service account key, so a bad copy is caught on
// your machine instead of by a 500 from the Worker.
//
//   node worker/check-key.mjs ./path/to/key.json          offline checks only
//   node worker/check-key.mjs ./path/to/key.json --live   also calls Google
//
// --live performs a real JWT -> access token -> Drive list round trip using the
// exact Worker code, which proves the key is valid and that the service account
// can read the folder. Nothing but the key is sent, and only to Google.

import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

const DEFAULT_FOLDER_ID = "1GeVABCnetfIYMeXd_cx6UI01PxPx3UW9";

const args = process.argv.slice(2);
const live = args.includes("--live");
const keyPath = args.find(arg => !arg.startsWith("--"));

if (!keyPath) {
    console.error("usage: node worker/check-key.mjs <path-to-service-account.json> [--live]");
    process.exit(1);
}

const fail = message => {
    console.log(`FAIL  ${message}`);
    process.exit(1);
};

let key;
try {
    key = JSON.parse(fs.readFileSync(path.resolve(keyPath), "utf8"));
} catch (err) {
    fail(`cannot read ${keyPath}: ${err.message}`);
}

if (key.type !== "service_account") fail("that file is not a service account key");
console.log(`ok    service account key: ${key.client_email}`);
console.log(`      project: ${key.project_id}`);

// This is the value to paste as the SA_CLIENT_EMAIL variable. A personal Gmail
// address will not work: service accounts sign with their own identity.
if (!key.client_email || !key.client_email.endsWith(".iam.gserviceaccount.com")) {
    fail("client_email is not a service account address");
}

const pem = key.private_key || "";
if (!pem) fail("the file has no private_key field");

// Same rules the Worker applies, checked locally first.
const body = pem
    .replace(/\\r\\n|\\n|\\r/g, "\n")
    .replace(/-----(BEGIN|END) [A-Z ]*PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");

if (body.length % 4 !== 0) {
    fail(`private_key is truncated or corrupt: body is ${body.length} chars, needs a multiple of 4. Re-copy the whole value.`);
}
if (!/^[A-Za-z0-9+/]+={0,2}$/.test(body)) fail("private_key has characters that are not valid base64");

let parsed;
try {
    parsed = crypto.createPrivateKey(pem);
} catch (err) {
    fail(`private_key is not a usable PEM: ${err.message}`);
}

const details = parsed.asymmetricKeyDetails || {};
if (details.modulusLength < 2048) fail(`key is only ${details.modulusLength} bits; Google issues 2048`);
const kind = details.namedCurve ? `EC (${details.namedCurve})` : "RSA";
console.log(`ok    private_key is valid PEM (${details.modulusLength}-bit ${kind})`);
console.log(`      paste the whole private_key value as the SA_PRIVATE_KEY secret`);
console.log(`      FOLDER_ID = ${DEFAULT_FOLDER_ID}`);

if (!live) {
    console.log("\nAll offline checks passed. Re-run with --live to test Google permissions.");
    process.exit(0);
}

globalThis.caches = {
    default: {
        async match() { return undefined; },
        async put() {},
        async delete() {},
    },
};

const worker = (await import(new URL("./resume.worker.js", import.meta.url))).default;
const res = await worker.fetch(new Request("https://local.test/health"), {
    FOLDER_ID: DEFAULT_FOLDER_ID,
    SA_CLIENT_EMAIL: key.client_email,
    SA_PRIVATE_KEY: pem,
});
const payload = await res.json();

if (res.status !== 200) {
    fail(`Worker returned ${res.status}: ${payload.error}`);
}

console.log(`\nok    signed a JWT, got an access token, and read the folder`);
console.log(`      would serve: ${payload.name} (modified ${payload.modifiedTime})`);
