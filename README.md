# Dimensional Bottles

<!-- rapp1:network-header:start -->
[![RAPP/1](https://kody-w.github.io/rapp-hive-public/portfolio/badges/dimensional-bottles.svg)](https://github.com/kody-w/rapp-hive-public/blob/main/portfolio/repos/dimensional-bottles.md) · **New to RAPP?** [Start here: get your Brainstem →](https://github.com/kody-w/rapp-installer#start-here)
<!-- rapp1:network-header:end -->

**Public preprint and reproducibility artifact.**

Dimensional bottles are a restricted projection-artifact contract: an immutable RAPP/1 frame is matched to a bounded, data-only specification; a fixed local runtime computes a fresh projection; optional model refinement may propose a separately identified successor.

- **Paper:** <https://kody-w.github.io/dimensional-bottles/paper.html>
- **Artifact:** <https://kody-w.github.io/dimensional-bottles/artifact/dimensional-bottles-artifact.zip>
- **RAPP Zoo implementation:** <https://github.com/kody-w/rapp-zoo/releases/tag/v1.2.0>
- **RAR bottle records:** <https://github.com/kody-w/RAR/pull/639>
- **Notarized HologramDOGG:** <https://github.com/kody-w/RAR/issues/640>

## Status

This is an artifact-backed **public preprint**, not a peer-reviewed paper.

The contribution is the implemented composition of:

1. deterministic applicability metadata and bounded scene schemas;
2. immutable frame-hash provenance;
3. data-only registry transport and fixed local rendering;
4. explicit generated-bottle admission and successor identity;
5. a model-independent local path plus optional tool-enabled refinement.

The paper does **not** claim that event projection, declarative visualization, static/dynamic binding, asynchronous refresh, content addressing, or procedural memory are individually new.

## Evidence

Two process-separated runs used an isolated RAPP home, separate Electron user-data directories, the archived frame fixture, and the clean three-bottle catalog.

| Run | Matcher median / p95 | Renderer-ready median / p95 | Samples |
|---|---:|---:|---:|
| A | 1.4 / 1.6 ms | 145.7 / 271.1 ms | 200 matcher, 90 renderer |
| B | 1.2 / 1.5 ms | 99.8 / 160.8 ms | 200 matcher, 90 renderer |

No samples were excluded. Renderer-ready is measured after the child's first synchronous `renderer.render` call; it is not compositor-present or human-perceived first-pixel latency.

The artifact also contains:

- replayable same-frame/different-projection evidence with hash-bound screenshots;
- both observed refinement durations, 17.934 s and 26.208 s;
- prelaunch and post-launch macOS signing chronology;
- exact raw samples, trial order, event definitions, percentile rule, and manifests;
- a clean-extraction acceptance gate.

## Verify

```bash
unzip dimensional-bottles-artifact.zip -d dimensional-bottles-artifact
cd dimensional-bottles-artifact
python3 dimensional-bottles-paper-gate.py
```

Expected result:

```text
READY FOR ADVERSARIAL REVIEW - 21/21 gates pass
```

## Reproduce on another device

Follow [`REPRODUCIBILITY.md`](./REPRODUCIBILITY.md). The protocol deliberately separates exact invariants from platform-dependent measurements and does not require pixel-identical GPU output.

## Checksums

```text
paper.html
048142baeb9771f096d9c7c80aa7f3646fe376778e2c1069e818609ec31d1090

dimensional-bottles-artifact.zip
8f9086deda03b1761960edd1ff13f6b154d34bb908f788030286c1851fd818aa
```

## Scope not yet established

- alternative-system performance baselines;
- physical cross-device reproduction;
- compositor-present timing;
- repeated model token and monetary cost;
- independent artifact evaluation;
- human comprehension, trust, authoring, or task outcomes.

Copyright 2026 RapterBox LLC.
