DIMENSIONAL BOTTLES PREPRINT ARTIFACT
====================================

This archive accompanies the public, non-peer-reviewed preprint:

  Dimensional Bottles: Cached Static Intelligence with Per-Call Data Slosh
  over Immutable Frames

Contents
--------

dimensional-bottles-paper.html
  The paper candidate.

dimensional-bottles-benchmark.mjs
  The exact Chrome DevTools Protocol benchmark harness.

dimensional-bottles-benchmark-run-a.json
dimensional-bottles-benchmark-run-b.json
  Two raw, process-separated, counterbalanced runs against an isolated
  three-bottle catalog and pinned frame. Together they contain 400 matcher
  observations and 180 renderer observations, with exact trial order, bottle,
  event timings, frame bytes, runtime metadata, percentile rule, and artifact
  bindings.

dimensional-bottles-frame.json
  The exact verified frame fixture used by both benchmark runs and the
  same-frame harness.

dimensional-bottles-same-frame-harness.mjs
dimensional-bottles-same-frame-evidence.json
dimensional-bottles-avatar.png
dimensional-bottles-briefing.png
  Replayable same-frame experiment, exact DOM observations, full frame,
  before/after equality, and hash-bound iframe-only screenshots.

dimensional-bottles-refinement-evidence.json
  Structured record of one end-to-end refinement, including the observed
  HologramForge tool log and the distinction between observed and enforced
  validation.

dimensional-bottles-codesign-check.sh
dimensional-bottles-codesign-evidence-redacted.txt
  Replayable launch/check/shutdown script and redacted chronology showing
  pre- and post-launch macOS code-sign verification, runtime health, exact
  bytecode search with zero counts, and release ZIP hash.

dimensional-bottles-paper-gate.py
  Machine-checkable structural, claim, evidence, citation, and artifact gate.

dimensional-bottles-artifact-manifest.json
  SHA-256 manifest binding every file in this archive.

Reproducing the local benchmark
-------------------------------

1. Check out kody-w/rapp-zoo at the implementation commit recorded in a run.
2. Install its existing dependencies.
3. Create empty RAPP_HOME, XDG_CONFIG_HOME, and Electron user-data directories.
4. Start the Electron app with a DevTools endpoint and the isolated state:

     RAPP_HOME=/tmp/db-rapp-home \
     XDG_CONFIG_HOME=/tmp/db-xdg \
     RAPP_ZOO_HEADLESS=1 \
     RAPP_ZOO_CDP_PORT=9224 \
     ./node_modules/.bin/electron . --user-data-dir=/tmp/db-electron

5. From the implementation checkout, run:

     RAPP_ZOO_IMPLEMENTATION="$PWD" \
     DIMENSIONAL_BOTTLES_PAPER="/path/to/dimensional-bottles-paper.html" \
     DIMENSIONAL_BOTTLES_FRAME="/path/to/dimensional-bottles-frame.json" \
     node /path/to/dimensional-bottles-benchmark.mjs > reproduced-run.json

The harness performs ten matcher warm-ups, retains 200 matcher samples, and
executes 30 Latin-rotated rounds over three bottles, retaining 90 renderer
samples. Each bottle appears ten times in each order position. No sample is
excluded. Percentiles use nearest rank: sorted[ceil(p*n)-1].

Scope
-----

These artifacts support a single-host systems reduction and local
microbenchmark. They do not establish human-perceived first-pixel latency,
deployment performance, physical cross-device reproduction, model-token cost,
publisher authenticity of the mutable RAR index, or user task benefit.
