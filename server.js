/**
 * nodejs-openhab-test-suite-backend
 * ───────────────────────────────────
 * Stateless Express server that proxies test-suite calls
 * from the GitHub Pages frontend to openHAB.
 *
 * Every request carries credentials in the body — no session state is stored.
 *
 * Endpoints
 * ─────────
 *   GET  /             → health / wake-up
 *   POST /api/connect  → verify credentials  → { loggedIn, isCloud }
 *   POST /api/test     → run tester method   → { result, output }
 */

import express    from "express";
import cors       from "cors";

import {
  OpenHABClient,
  Items, Things, Rules,
  Links, Persistence, Sitemaps, ItemEvents,
} from "nodejs-openhab-rest-client";

import {
  ItemTester, ThingTester, RuleTester,
  ChannelTester, PersistenceTester, SitemapTester,
} from "nodejs-openhab-test-suite";

const app  = express();
const PORT = process.env.PORT ?? 8080;

app.use(cors());
app.use(express.json());

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Build an OpenHABClient with all API instances attached,
 * so the tester constructors can pick them up via client._items etc.
 */
async function buildClient(url, username, password, token) {
  if (!url) throw new Error("url is required");
  const base = url.replace(/\/+$/, "");
  const raw  = token
    ? new OpenHABClient(base, null, null, token)
    : new OpenHABClient(base, username || null, password || null);
  await raw.login();

  raw._items       = new Items(raw);
  raw._things      = new Things(raw);
  raw._rules       = new Rules(raw);
  raw._links       = new Links(raw);
  raw._persistence = new Persistence(raw);
  raw._sitemaps    = new Sitemaps(raw);
  raw._itemEvents  = new ItemEvents(raw);

  return raw;
}

/**
 * Instantiate the requested tester and bind it to the client.
 */
function buildTester(name, client) {
  switch (name) {
    case "ItemTester":        return new ItemTester(client);
    case "ThingTester":       return new ThingTester(client);
    case "RuleTester":        return new RuleTester(client);
    case "ChannelTester":     return new ChannelTester(client);
    case "PersistenceTester": return new PersistenceTester(client);
    case "SitemapTester":     return new SitemapTester(client);
    default:
      throw new Error(
        `Unknown tester '${name}'. Valid: ItemTester, ThingTester, RuleTester, ` +
        "ChannelTester, PersistenceTester, SitemapTester"
      );
  }
}

/**
 * Capture all console.log / console.error / console.warn output
 * produced during the tester method call, then restore the originals.
 */
async function captureAndCall(tester, methodName, params) {
  const method = tester[methodName];
  if (typeof method !== "function")
    throw new Error(`Method '${methodName}' not found on ${tester.constructor.name}`);

  const lines         = [];
  const orig          = { log: console.log, error: console.error, warn: console.warn };
  console.log         = (...a) => lines.push(a.join(" "));
  console.error       = (...a) => lines.push(a.join(" "));
  console.warn        = (...a) => lines.push(a.join(" "));

  let result;
  try {
    result = await method.apply(tester, params ?? []);
  } finally {
    Object.assign(console, orig);
  }

  return { result, output: lines.join("\n").trim() };
}

// ── Routes ─────────────────────────────────────────────────────────────────────

app.get("/", (_req, res) => {
  res.json({ status: "ok", service: "nodejs-openhab-test-suite-backend" });
});

app.post("/api/connect", async (req, res) => {
  const { url, username, password, token } = req.body ?? {};
  try {
    const client = await buildClient(url, username, password, token);
    res.json({ loggedIn: client.isLoggedIn, isCloud: client.isCloud });
  } catch (e) {
    console.error("connect error:", e.message);
    res.json({ loggedIn: false, isCloud: false, error: e.message });
  }
});

app.post("/api/test", async (req, res) => {
  const { url, username, password, token, tester, method, params } = req.body ?? {};

  if (!tester) return res.status(400).json({ error: "tester is required" });
  if (!method) return res.status(400).json({ error: "method is required" });
  if (!Array.isArray(params ?? []))
    return res.status(400).json({ error: "params must be an array" });

  // ── Build client ────────────────────────────────────────────────────────────
  let client;
  try {
    client = await buildClient(url, username, password, token);
    if (!client.isLoggedIn)
      return res.status(401).json({
        error: "Could not connect to openHAB — check credentials"
      });
  } catch (e) {
    return res.status(502).json({ error: `Connection failed: ${e.message}` });
  }

  // ── Instantiate tester ──────────────────────────────────────────────────────
  let testerInst;
  try {
    testerInst = buildTester(tester, client);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  // ── Execute ─────────────────────────────────────────────────────────────────
  try {
    const { result, output } = await captureAndCall(testerInst, method, params);
    console.log(`${tester}.${method}(${JSON.stringify(params)}) → ${result}`);
    return res.json({ result: result ?? false, output });
  } catch (e) {
    const status = e.status ?? 500;
    console.error(`${tester}.${method}() failed:`, e.message);
    return res.status(status).json({ error: e.message });
  }
});

// ── Start ───────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`nodejs-openhab-test-suite-backend running on port ${PORT}`);
});
