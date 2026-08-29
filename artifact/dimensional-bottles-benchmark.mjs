#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const CDP_ORIGIN = process.env.RAPP_ZOO_CDP_ORIGIN || "http://127.0.0.1:9224";
const scriptPath = fileURLToPath(import.meta.url);
const artifactRoot = path.dirname(scriptPath);
const IMPLEMENTATION = process.env.RAPP_ZOO_IMPLEMENTATION || process.cwd();
const PAPER = (
  process.env.DIMENSIONAL_BOTTLES_PAPER
  || path.join(artifactRoot, "dimensional-bottles-paper.html")
);
const FRAME_PATH = process.env.DIMENSIONAL_BOTTLES_FRAME || null;
const suppliedFrame = FRAME_PATH
  ? JSON.parse(readFileSync(FRAME_PATH, "utf8"))
  : null;

const sleep = (milliseconds) => new Promise((resolve) => {
  setTimeout(resolve, milliseconds);
});

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
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text);
    }
    return result.result.value;
  };
  return { socket, send, evaluate };
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

const commit = spawnSync(
  "git",
  ["-C", IMPLEMENTATION, "rev-parse", "HEAD"],
  { encoding: "utf8" },
);
if (commit.status !== 0) {
  throw new Error(commit.stderr || "could not resolve implementation commit");
}

const tabs = await getJson(`${CDP_ORIGIN}/json/list`);
const page = tabs.find((candidate) => (
  candidate.type === "page"
  && candidate.url.startsWith("http://127.0.0.1:7070")
));
if (!page) throw new Error("RAPP Zoo Electron page was not found");

const cdp = await connectCdp(page.webSocketDebuggerUrl);
await cdp.send("Page.reload", { ignoreCache: true });
await sleep(2_500);

const browserResult = await cdp.evaluate(`(async () => {
  const percentile = (values, fraction) => {
    const sorted = [...values].sort((left, right) => left - right);
    return sorted[Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1)];
  };
  const summarize = (values) => ({
    n: values.length,
    min_ms: +Math.min(...values).toFixed(3),
    median_ms: +percentile(values, 0.5).toFixed(3),
    p95_ms: +percentile(values, 0.95).toFixed(3),
    max_ms: +Math.max(...values).toFixed(3),
    mean_ms: +(values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(3),
  });

  const expectedBottles = ["holo-avatar", "holo-briefing", "holo-nexus"];
  const catalog = await fetch("/api/holograms", {
    cache: "no-store",
  }).then((response) => response.json());
  const catalogIds = catalog.holograms.map((entry) => entry.id).sort();
  if (JSON.stringify(catalogIds) !== JSON.stringify(expectedBottles)) {
    throw new Error("benchmark requires the clean three-bottle catalog: " + JSON.stringify(catalogIds));
  }
  const frame = ${JSON.stringify(suppliedFrame)} || await fetch(
    "/api/holograms/example-frame",
    { cache: "no-store" },
  ).then((response) => response.json());

  const measureMatch = async () => {
    const started = performance.now();
    const response = await fetch("/api/holograms/match", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ frame }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(await response.text());
    const match = await response.json();
    return {
      elapsed_ms: performance.now() - started,
      selected_bottle: match.hologram.id,
      mode: match.mode,
      score: match.score,
    };
  };

  for (let index = 0; index < 10; index += 1) await measureMatch();
  const matcherSamples = [];
  for (let index = 0; index < 200; index += 1) {
    matcherSamples.push({ trial: index, ...(await measureMatch()) });
  }

  document.querySelector('[data-tab="holograms"]').click();
  const catalogDeadline = performance.now() + 10_000;
  while (!hologramEntries.length && performance.now() < catalogDeadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  if (!hologramEntries.length) throw new Error("hologram catalog did not load");

  const snapshot = await fetch("/api/intelligence-context", {
    cache: "no-store",
  }).then((response) => response.json());
  currentDataSlosh = { ...snapshot, data_slosh: { frame } };

  const measureProjection = (id, trial, round, orderPosition) => new Promise(
    (resolve, reject) => {
      const started = performance.now();
      let ready = null;
      const timer = setTimeout(() => {
        removeEventListener("message", handler);
        reject(new Error("projection timeout: " + id));
      }, 10_000);
      const handler = (event) => {
        const message = event.data || {};
        if (message.hologram_id !== id) return;
        if (message.schema === "rapp-zoo-hologram-ready/1.0") {
          ready = performance.now() - started;
        }
        if (message.schema === "rapp-zoo-hologram-bound/1.0") {
          clearTimeout(timer);
          removeEventListener("message", handler);
          resolve({
            trial,
            round,
            order_position: orderPosition,
            bottle: id,
            ready_ms: ready,
            bound_ms: performance.now() - started,
          });
        }
      };
      addEventListener("message", handler);
      openHologram(id);
    },
  );

  const orders = [
    ["holo-avatar", "holo-briefing", "holo-nexus"],
    ["holo-briefing", "holo-nexus", "holo-avatar"],
    ["holo-nexus", "holo-avatar", "holo-briefing"],
  ];
  const projectionSamples = [];
  let projectionTrial = 0;
  for (let round = 0; round < 30; round += 1) {
    const order = orders[round % orders.length];
    for (let position = 0; position < order.length; position += 1) {
      projectionSamples.push(await measureProjection(
        order[position],
        projectionTrial++,
        round,
        position,
      ));
      document.getElementById("hologram-dialog").close();
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
  }

  const byBottle = {};
  for (const id of orders[0]) {
    const rows = projectionSamples.filter((sample) => sample.bottle === id);
    byBottle[id] = {
      ready: summarize(rows.map((sample) => sample.ready_ms)),
      bound: summarize(rows.map((sample) => sample.bound_ms)),
      order_positions: Object.fromEntries([0, 1, 2].map((position) => [
        String(position),
        rows.filter((sample) => sample.order_position === position).length,
      ])),
    };
  }

  return JSON.stringify({
    user_agent: navigator.userAgent,
    catalog_ids: catalogIds,
    frame,
    matcher: {
      warmup_requests: 10,
      summary: summarize(matcherSamples.map((sample) => sample.elapsed_ms)),
      samples: matcherSamples,
    },
    projection: {
      order_strategy: "three-order Latin rotation; each bottle appears 10 times in each position",
      summary_ready_mixed_bottle_cache: summarize(
        projectionSamples.map((sample) => sample.ready_ms),
      ),
      summary_bound_mixed_bottle_cache: summarize(
        projectionSamples.map((sample) => sample.bound_ms),
      ),
      by_bottle: byBottle,
      samples: projectionSamples,
    },
  });
})()`);

cdp.socket.close();
const measured = JSON.parse(browserResult);
const output = {
  schema: "dimensional-bottles-benchmark/1.0",
  captured_utc: new Date().toISOString(),
  implementation: {
    repository: "kody-w/rapp-zoo",
    commit: commit.stdout.trim(),
    release_commit: (
      process.env.RAPP_ZOO_RELEASE_COMMIT
      || "42f06849b576d5d596f210390ca04e5295ea86c7"
    ),
  },
  artifact_binding: {
    benchmark_sha256: sha256(scriptPath),
    paper_sha256_at_capture: sha256(PAPER),
    frame_fixture_sha256: FRAME_PATH ? sha256(FRAME_PATH) : null,
  },
  host: {
    platform: os.platform(),
    release: os.release(),
    architecture: os.arch(),
    cpu: os.cpus()[0]?.model || "unknown",
    logical_cpus: os.cpus().length,
    memory_gib: +(os.totalmem() / (1024 ** 3)).toFixed(1),
  },
  runtime: {
    electron: "43.2.0",
    brainstem: "0.6.16",
    renderer: "three-r128",
    user_agent: measured.user_agent,
  },
  percentile_rule: "nearest-rank: sorted[ceil(p*n)-1]",
  catalog_ids: measured.catalog_ids,
  frame: measured.frame,
  matcher: measured.matcher,
  projection: measured.projection,
};

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
