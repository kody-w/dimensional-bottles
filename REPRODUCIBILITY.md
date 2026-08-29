# Independent physical-device reproduction

This protocol closes the largest remaining evidence gap in the preprint. It should be run on a physical device other than the original Apple M4 Max host, preferably by an operator other than the author.

## 1. Record the environment

Record:

- operator;
- device model, CPU/GPU, memory, and operating system;
- Node, Electron, Python, and browser versions;
- whether the device is on battery or external power;
- whether other high-load applications are running.

Use [`reproduction-results-template.json`](./reproduction-results-template.json) for the result.

## 2. Verify the public artifact

```bash
curl -fLO https://github.com/kody-w/dimensional-bottles/releases/download/v0.1.0-preprint/dimensional-bottles-artifact.zip
shasum -a 256 dimensional-bottles-artifact.zip
```

Expected artifact SHA-256:

```text
8f9086deda03b1761960edd1ff13f6b154d34bb908f788030286c1851fd818aa
```

Extract and run the gate:

```bash
unzip dimensional-bottles-artifact.zip -d dimensional-bottles-artifact
cd dimensional-bottles-artifact
python3 dimensional-bottles-paper-gate.py
```

Do not continue unless all 21 checks pass.

## 3. Check out the released implementation

```bash
git clone https://github.com/kody-w/rapp-zoo.git
cd rapp-zoo
git checkout 42f06849b576d5d596f210390ca04e5295ea86c7
npm ci
```

Install the repository's existing Python requirements using an isolated environment.

## 4. Create isolated state

```bash
export DB_STATE="$PWD/.dimensional-bottles-reproduction"
mkdir -p "$DB_STATE/rapp-home" "$DB_STATE/xdg" "$DB_STATE/electron-a" "$DB_STATE/electron-b"
```

The benchmark refuses to run unless the catalog contains exactly:

```text
holo-avatar
holo-briefing
holo-nexus
```

## 5. Run benchmark A

```bash
RAPP_HOME="$DB_STATE/rapp-home" \
XDG_CONFIG_HOME="$DB_STATE/xdg" \
RAPP_ZOO_HEADLESS=1 \
RAPP_ZOO_CDP_PORT=9224 \
./node_modules/.bin/electron . --user-data-dir="$DB_STATE/electron-a"
```

In another shell:

```bash
RAPP_ZOO_IMPLEMENTATION="$PWD" \
DIMENSIONAL_BOTTLES_PAPER="/path/to/dimensional-bottles-artifact/dimensional-bottles-paper.html" \
DIMENSIONAL_BOTTLES_FRAME="/path/to/dimensional-bottles-artifact/dimensional-bottles-frame.json" \
node /path/to/dimensional-bottles-artifact/dimensional-bottles-benchmark.mjs \
  > independent-run-a.json
```

Stop the Electron process completely.

## 6. Run benchmark B

Repeat step 5 with `--user-data-dir="$DB_STATE/electron-b"` and save `independent-run-b.json`.

## 7. Replay same-frame projection

Start a fresh isolated Electron process and run:

```bash
mkdir -p "$PWD/independent-same-frame"
DIMENSIONAL_BOTTLES_FRAME="/path/to/dimensional-bottles-artifact/dimensional-bottles-frame.json" \
DIMENSIONAL_BOTTLES_OUTPUT="$PWD/independent-same-frame" \
node /path/to/dimensional-bottles-artifact/dimensional-bottles-same-frame-harness.mjs \
  > independent-same-frame.json
```

## 8. Exact acceptance criteria

The following must match exactly:

- artifact manifest hashes;
- frame fixture bytes and `frame_hash`;
- catalog identifiers;
- source frame before and after projection;
- Holo Avatar title, kind, and displayed source hash;
- The Briefing title, kind, and displayed source hash;
- sample counts;
- each bottle appearing ten times in each order position;
- no excluded samples.

The following are measured and should **not** be required to match exactly:

- matcher and renderer timings;
- screenshot bytes across different GPUs, operating systems, scaling, or font renderers.

Screenshot hashes must be recorded locally to bind the independent outputs, but cross-device pixel identity is not currently claimed.

## 9. Submit the result

Open a GitHub issue using the title:

```text
[REPRODUCTION] <device> / <operator>
```

Attach:

- completed result JSON;
- both raw benchmark JSON files;
- same-frame evidence JSON;
- both screenshots;
- gate output;
- any deviations or failures.

An independent reproduction is successful only when another operator can execute this protocol without unpublished files or author intervention.
