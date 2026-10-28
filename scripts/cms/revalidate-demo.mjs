#!/usr/bin/env node
// Signs a payload the way the admin-backend relay will and POSTs it to /api/revalidate (doc/08 §7.2),
// so the endpoint can be tried by hand. The secret is read from the environment and never printed.
//
//   REVALIDATE_SECRET=<same value as the server> node scripts/cms/revalidate-demo.mjs [options]
//
//   --url <url>          default http://localhost:3000/api/revalidate (only localhost unless --allow-remote)
//   --tags a,b,c         default pages,settings,sitemap
//   --event-id <id>      default a fresh UUID
//   --stale              sign with a timestamp 1 hour in the past (expect 401)
//   --bad-signature      send a wrong signature (expect 401)
//   --replay             send the same event twice (second answer: 200 with duplicate:true)
//   --raw '<json>'       send this exact body instead of building one (e.g. to try a bad body)
//   --secret-env <NAME>  read the secret from another variable (default REVALIDATE_SECRET)
//   --allow-remote       allow a non-localhost --url
import { createHmac, randomUUID } from "node:crypto";

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
};

const url = new URL(opt("url", "http://localhost:3000/api/revalidate"));
const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
if (!local && !flag("allow-remote")) {
  console.error(`Refusing to call ${url.hostname}: pass --allow-remote if that is really what you want.`);
  process.exit(2);
}

const secretName = opt("secret-env", "REVALIDATE_SECRET");
const secret = process.env[secretName];
if (!secret) {
  console.error(`Set ${secretName} in the environment (the same value as the server's REVALIDATE_SECRET).`);
  process.exit(2);
}

const tags = opt("tags", "pages,settings,sitemap").split(",").map((t) => t.trim()).filter(Boolean);
const eventId = opt("event-id", randomUUID());
const raw = opt("raw", null);

function build() {
  const body = raw ?? JSON.stringify({ event_id: eventId, tags, sent_at: new Date().toISOString() });
  const ts = String(Math.floor(Date.now() / 1000) - (flag("stale") ? 3600 : 0));
  let sig = createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
  if (flag("bad-signature")) sig = sig.replace(/^./, sig[0] === "0" ? "1" : "0");
  return { body, ts, sig: `v1=${sig}` };
}

async function send(label) {
  const { body, ts, sig } = build();
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-materm-timestamp": ts, "x-materm-signature": sig },
    body,
  });
  const text = await res.text();
  console.log(`${label}POST ${url.pathname} -> ${res.status}`);
  console.log(`  request body : ${body}`);
  console.log(`  response     : ${text}`);
  return res.status;
}

await send("");
if (flag("replay")) await send("[replay] ");
