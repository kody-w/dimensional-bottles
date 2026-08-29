#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";

const CDP_ORIGIN = process.env.RAPP_ZOO_CDP_ORIGIN || "http://127.0.0.1:9224";
const FRAME_PATH = process.env.DIMENSIONAL_BOTTLES_FRAME;
const OUTPUT_DIR = process.env.DIMENSIONAL_BOTTLES_OUTPUT || process.cwd();
if (!FRAME_PATH) throw new Error("DIMENSIONAL_BOTTLES_FRAME is required");
mkdirSync(OUTPUT_DIR, { recursive: true });

const frame = JSON.parse(readFileSync(FRAME_PATH, "utf8"));
const sleep = (milliseconds) => new Promise((resolve) => {
  setTimeout(resolve, milliseconds);
});
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (response) => {
      let body = "";
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    }).on("error", reject);
  });
}

async function connectCdp(url) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });
  let sequence = 0;
  const pending = new Map();
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, (message) => {
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
    });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  return { socket, send, evaluate };
}

async function targetInfos() {
  const version = await getJson(`${CDP_ORIGIN}/json/version`);
  const browser = await connectCdp(version.webSocketDebuggerUrl);
  const result = await browser.send("Target.getTargets");
  browser.socket.close();
  return result.targetInfos;
}

async function waitForIframe(id) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const target = (await targetInfos()).find((candidate) => (
      candidate.type === "iframe"
      && candidate.url.endsWith(`/holograms/${id}`)
    ));
    if (target) return target;
    await sleep(100);
  }
  throw new Error(`iframe target not found for ${id}`);
}

const tabs = await getJson(`${CDP_ORIGIN}/json/list`);
const page = tabs.find((candidate) => (
  candidate.type === "page"
  && candidate.url.startsWith("http://127.0.0.1:7070")
));
if (!page) throw new Error("RAPP Zoo Electron page was not found");

const parent = await connectCdp(page.webSocketDebuggerUrl);
await parent.send("Page.reload", { ignoreCache: true });
await sleep(2_500);
const setup = JSON.parse(await parent.evaluate(`(async () => {
  document.querySelector('[data-tab="holograms"]').click();
  const deadline = performance.now() + 10000;
  while (!hologramEntries.length && performance.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const catalog = await fetch("/api/holograms", { cache: "no-store" }).then(
    (response) => response.json(),
  );
  const ids = catalog.holograms.map((entry) => entry.id).sort();
  const expected = ["holo-avatar", "holo-briefing", "holo-nexus"];
  if (JSON.stringify(ids) !== JSON.stringify(expected)) {
    throw new Error("same-frame harness requires the clean three-bottle catalog");
  }
  const snapshot = await fetch("/api/intelligence-context", {
    cache: "no-store",
  }).then((response) => response.json());
  const frame = ${JSON.stringify(frame)};
  currentDataSlosh = { ...snapshot, data_slosh: { frame } };
  return JSON.stringify({
    catalog_ids: ids,
    frame_json_before: JSON.stringify(frame),
    frame_hash_before: frame.frame_hash,
  });
})()`));

async function project(id, screenshotName) {
  const bound = parent.evaluate(`new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("projection timeout")), 10000);
    const handler = (event) => {
      const message = event.data || {};
      if (
        message.hologram_id === ${JSON.stringify(id)}
        && message.schema === "rapp-zoo-hologram-bound/1.0"
      ) {
        clearTimeout(timer);
        removeEventListener("message", handler);
        resolve(true);
      }
    };
    addEventListener("message", handler);
    openHologram(${JSON.stringify(id)});
  })`);
  await bound;
  await sleep(100);
  const target = await waitForIframe(id);
  const child = await connectCdp(
    `${CDP_ORIGIN.replace("http", "ws")}/devtools/page/${target.targetId}`,
  );
  const observation = JSON.parse(await child.evaluate(`JSON.stringify({
    url: location.href,
    ready: document.getElementById("hologram-canvas")?.dataset.ready,
    title: document.getElementById("hologram-title")?.textContent,
    kind: document.getElementById("hologram-kind")?.textContent,
    subtitle: document.getElementById("hologram-subtitle")?.textContent,
    facts: document.getElementById("hologram-facts")?.innerText,
  })`));
  child.socket.close();
  const clip = JSON.parse(await parent.evaluate(`JSON.stringify((() => {
    const rect = document.getElementById("hologram-frame").getBoundingClientRect();
    return {
      x: rect.x + scrollX,
      y: rect.y + scrollY,
      width: rect.width,
      height: rect.height,
      scale: 1,
    };
  })())`));
  const screenshot = await parent.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    clip,
  });
  const bytes = Buffer.from(screenshot.data, "base64");
  writeFileSync(path.join(OUTPUT_DIR, screenshotName), bytes);
  await parent.evaluate(
    `document.getElementById("hologram-dialog").close(); true`,
  );
  await sleep(150);
  return {
    bottle: id,
    observation,
    screenshot: screenshotName,
    screenshot_sha256: sha256(bytes),
  };
}

const projections = [
  await project("holo-avatar", "dimensional-bottles-avatar.png"),
  await project("holo-briefing", "dimensional-bottles-briefing.png"),
];
const after = JSON.parse(await parent.evaluate(`JSON.stringify({
  frame_json_after: JSON.stringify(currentDataSlosh.data_slosh.frame),
  frame_hash_after: currentDataSlosh.data_slosh.frame.frame_hash,
})`));
parent.socket.close();

const output = {
  schema: "dimensional-bottles-same-frame-evidence/2.0",
  captured_utc: new Date().toISOString(),
  harness_sha256: sha256(readFileSync(new URL(import.meta.url))),
  frame_fixture_sha256: sha256(readFileSync(FRAME_PATH)),
  catalog_ids: setup.catalog_ids,
  frame,
  frame_hash_before: setup.frame_hash_before,
  frame_hash_after: after.frame_hash_after,
  frame_json_unchanged: setup.frame_json_before === after.frame_json_after,
  projections,
  claim_scope: (
    "The two outputs are observably different and carry one exact source frame. "
    + "No perceptual or semantic distance metric is claimed."
  ),
};
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
