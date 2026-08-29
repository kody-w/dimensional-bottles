#!/usr/bin/env python3
"""Machine-checkable acceptance gate for the dimensional-bottles preprint."""

from __future__ import annotations

import hashlib
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parent
PAPER = ROOT / "dimensional-bottles-paper.html"
RUN_A = ROOT / "dimensional-bottles-benchmark-run-a.json"
RUN_B = ROOT / "dimensional-bottles-benchmark-run-b.json"
BENCHMARK = ROOT / "dimensional-bottles-benchmark.mjs"
FRAME = ROOT / "dimensional-bottles-frame.json"
SAME_FRAME_HARNESS = ROOT / "dimensional-bottles-same-frame-harness.mjs"
SAME_FRAME = ROOT / "dimensional-bottles-same-frame-evidence.json"
REFINEMENT = ROOT / "dimensional-bottles-refinement-evidence.json"
AVATAR_IMAGE = ROOT / "dimensional-bottles-avatar.png"
BRIEFING_IMAGE = ROOT / "dimensional-bottles-briefing.png"
CODESIGN_HARNESS = ROOT / "dimensional-bottles-codesign-check.sh"
CODESIGN_EVIDENCE = ROOT / "dimensional-bottles-codesign-evidence-redacted.txt"
MANIFEST = ROOT / "dimensional-bottles-artifact-manifest.json"


class PaperParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.in_script = False
        self.in_style = False
        self.current_h2 = False
        self.h2: list[str] = []
        self.figures = 0
        self.figcaptions = 0
        self.aria_figures = 0
        self.reference_items = 0
        self.in_references = False
        self.text: list[str] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        attr = dict(attrs)
        if tag == "script":
            self.in_script = True
        elif tag == "style":
            self.in_style = True
        elif tag == "h2":
            self.current_h2 = True
        elif tag == "figure":
            self.figures += 1
        elif tag == "figcaption":
            self.figcaptions += 1
        elif tag == "svg" and attr.get("role") == "img" and attr.get("aria-label"):
            self.aria_figures += 1
        elif tag == "ol" and "references" in attr.get("class", "").split():
            self.in_references = True
        elif tag == "li" and self.in_references:
            self.reference_items += 1

    def handle_endtag(self, tag: str) -> None:
        if tag == "script":
            self.in_script = False
        elif tag == "style":
            self.in_style = False
        elif tag == "h2":
            self.current_h2 = False
        elif tag == "ol" and self.in_references:
            self.in_references = False

    def handle_data(self, data: str) -> None:
        if self.in_script or self.in_style:
            return
        normalized = " ".join(data.split())
        if not normalized:
            return
        self.text.append(normalized)
        if self.current_h2:
            self.h2.append(normalized)


def main() -> int:
    html = PAPER.read_text(encoding="utf-8")
    run_a = json.loads(RUN_A.read_text(encoding="utf-8"))
    run_b = json.loads(RUN_B.read_text(encoding="utf-8"))
    same_frame = json.loads(SAME_FRAME.read_text(encoding="utf-8"))
    refinement = json.loads(REFINEMENT.read_text(encoding="utf-8"))
    frame_fixture = json.loads(FRAME.read_text(encoding="utf-8"))
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    parser = PaperParser()
    parser.feed(html)
    prose = " ".join(parser.text)
    words = re.findall(r"\b[\w'-]+\b", prose)

    results: list[tuple[str, bool, str]] = []

    def require(name: str, passed: bool, detail: str) -> None:
        results.append((name, bool(passed), detail))
        print(f"{'PASS' if passed else 'FAIL'}  {name} — {detail}")

    require(
        "title is exact",
        "Dimensional Bottles: Cached Static Intelligence with Per-Call Data Slosh over Immutable Frames"
        in html,
        "named contribution and mechanism are explicit",
    )
    require(
        "frame-chains section form",
        parser.h2 == [
            "Abstract",
            "1 · Introduction",
            "2 · Substrate and artifact contract",
            "3 · Design",
            "4 · Reduction to practice",
            "5 · Related work and position",
            "6 · Limitations",
            "7 · Conclusion",
            "References",
        ],
        repr(parser.h2),
    )
    require("substantive length", 2500 <= len(words) <= 6000, f"{len(words)} words")
    require(
        "public preprint status is honest",
        "Public preprint" in html
        and "First public disclosure: August 29, 2026" in prose
        and "has not undergone peer review" in prose
        and "Private preprint draft" not in html,
        "public disclosure and non-peer-reviewed status are explicit",
    )
    require(
        "figures are substantive",
        parser.figures >= 4
        and parser.figcaptions == parser.figures
        and parser.aria_figures == parser.figures,
        f"{parser.figures} figures, {parser.figcaptions} captions, "
        f"{parser.aria_figures} accessible diagrams",
    )
    require(
        "related work is archival",
        parser.reference_items >= 12
        and parser.reference_items >= 20
        and html.count("doi:") >= 12
        and "GPTCache" in prose
        and "Event Sourced Systems" in prose
        and "Reactive Vega" in prose
        and "Partial Evaluation" in prose
        and "Agent Workflow Memory" in prose
        and "Bidirectional Tree Transformations" in prose
        and "Vega-Lite" in prose,
        f"{parser.reference_items} references and {html.count('doi:')} DOI entries",
    )
    require(
        "citations are connected to argument",
        all(
            marker in prose
            for marker in (
                "[5]–[18]",
                "[1]",
                "[2]–[4]",
                "[21]",
                "[22]",
                "[23]",
                "[24]",
            )
        ),
        "related-work claims carry numbered references",
    )
    require(
        "measured claims match ledger",
        all(
            str(value) in prose
            for value in (
                run_a["matcher"]["summary"]["median_ms"],
                run_b["matcher"]["summary"]["median_ms"],
                run_a["projection"]["summary_ready_mixed_bottle_cache"]["median_ms"],
                run_b["projection"]["summary_ready_mixed_bottle_cache"]["median_ms"],
            )
        )
        and all(
            str(observation["elapsed_ms"] / 1000) in prose
            for observation in refinement["observations"]
        )
        and same_frame["frame_hash_before"] in prose,
        "both raw benchmark runs, refinement observations, and same-frame evidence are present",
    )
    require(
        "denominators are explicit",
        "No samples were excluded" in prose
        and "mixed-cache measurements" in prose
        and "not a compositor presentation measurement" in prose
        and "They were not collected as part of the matcher/renderer traces and are not a distribution" in prose,
        "performance language is bounded",
    )
    require(
        "remaining evidence gaps are explicit",
        "physical second-device reproduction" in prose
        and "token accounting" in prose
        and "monetary cost" in prose
        and "no alternative-system baseline" in prose.lower()
        and "HCI submission" in prose,
        "cross-device, cost, and quality gaps are named",
    )
    require(
        "threat model is represented",
        all(
            phrase in prose
            for phrase in (
                "current-index-relative integrity",
                "not publisher authentication",
                "tool-enabled",
                "prompt injection",
                "discriminated message envelope",
                "authenticated HTTPS reverse proxy",
                "Electron-held capability",
            )
        ),
        "index, model, message, generated-persistence, and remote-deployment boundaries are stated",
    )
    require(
        "raw artifact is independently auditable",
        BENCHMARK.is_file()
        and len(run_a["matcher"]["samples"]) == 200
        and len(run_b["matcher"]["samples"]) == 200
        and len(run_a["projection"]["samples"]) == 90
        and len(run_b["projection"]["samples"]) == 90
        and run_a["artifact_binding"]["benchmark_sha256"]
        == run_b["artifact_binding"]["benchmark_sha256"],
        "benchmark script plus 400 matcher and 180 renderer samples",
    )
    require(
        "benchmark state is pinned and isolated",
        run_a["catalog_ids"] == ["holo-avatar", "holo-briefing", "holo-nexus"]
        and run_b["catalog_ids"] == run_a["catalog_ids"]
        and run_a["frame"] == frame_fixture
        and run_b["frame"] == frame_fixture
        and run_a["artifact_binding"]["frame_fixture_sha256"]
        == hashlib.sha256(FRAME.read_bytes()).hexdigest()
        and run_b["artifact_binding"]["frame_fixture_sha256"]
        == run_a["artifact_binding"]["frame_fixture_sha256"],
        "both runs use the archived frame and clean three-bottle catalog",
    )
    require(
        "same-frame result is replayable",
        SAME_FRAME_HARNESS.is_file()
        and same_frame["harness_sha256"]
        == hashlib.sha256(SAME_FRAME_HARNESS.read_bytes()).hexdigest()
        and same_frame["frame"] == frame_fixture
        and same_frame["frame_json_unchanged"] is True
        and same_frame["frame_hash_before"] == same_frame["frame_hash_after"]
        and len(same_frame["projections"]) == 2
        and all(
            (ROOT / projection["screenshot"]).is_file()
            and hashlib.sha256(
                (ROOT / projection["screenshot"]).read_bytes()
            ).hexdigest() == projection["screenshot_sha256"]
            for projection in same_frame["projections"]
        ),
        "exact frame, harness, DOM observations, and two screenshot hashes",
    )
    signing_text = CODESIGN_EVIDENCE.read_text(encoding="utf-8")
    require(
        "signing observation has launch chronology",
        CODESIGN_HARNESS.is_file()
        and "prelaunch_signature_status=0" in signing_text
        and "launch_utc=" in signing_text
        and "runtime_health_status=1" in signing_text
        and "shutdown_utc=" in signing_text
        and "postlaunch_signature_status=0" in signing_text
        and "prelaunch_bytecode_count=0" in signing_text
        and "postlaunch_bytecode_count=0" in signing_text
        and "bytecode_check=passed" in signing_text,
        "prelaunch, launch, health, shutdown, postlaunch, and exact zero counts",
    )
    manifest_matches = True
    for filename, expected in manifest["files"].items():
        pathname = ROOT / filename
        actual = (
            hashlib.sha256(pathname.read_bytes()).hexdigest()
            if pathname.is_file()
            else None
        )
        if actual != expected:
            manifest_matches = False
            break
    require(
        "artifact manifest binds current bytes",
        manifest_matches
        and manifest["files"].get(PAPER.name)
        == hashlib.sha256(PAPER.read_bytes()).hexdigest(),
        f"{len(manifest['files'])} supplemental files are hash-bound",
    )
    require(
        "known overclaims are absent",
        all(
            phrase not in prose
            for phrase in (
                "content-addressable identity",
                "fact of record for one invocation",
                "closed postMessage schema",
                "proposes; cannot persist",
                "publisher authenticity is verified",
                "split-brain is structurally impossible",
            )
        ),
        "identity, frame, Brainstem, message, and registry claims are narrowed",
    )
    require(
        "no placeholder or hype language",
        not re.search(
            r"\b(TODO|TBD|revolutionary|groundbreaking|game-changing|guaranteed|"
            r"proves? once and for all)\b",
            prose,
            re.IGNORECASE,
        ),
        "no placeholders or promotional claims",
    )
    require(
        "responsive paper shell",
        "max-width: 46rem" in html
        and "@media (max-width: 640px)" in html
        and "overflow-x: auto" in html,
        "matches the compact reference form",
    )
    require(
        "frame-chains visual house style",
        'font: 17px/1.65 Georgia, "Times New Roman", serif' in html
        and 'document.documentElement.setAttribute("data-theme", "light")' in html
        and "background: var(--cp-surface)" in html
        and "border-left: 3px solid var(--cp-link)" in html,
        "deterministic light default, serif body, blue accent, compact page",
    )
    require(
        "evidence links are published",
        all(
            link in html
            for link in (
                "https://github.com/kody-w/rapp-zoo/releases/tag/v1.2.0",
                "https://github.com/kody-w/RAR/pull/639",
                "https://github.com/kody-w/RAR/issues/640",
            )
        ),
        "implementation, records, and notarization are linked",
    )

    failed = [name for name, passed, _ in results if not passed]
    print("\n" + "=" * 72)
    if failed:
        print(f"NOT READY — {len(failed)} gate(s) failed: {', '.join(failed)}")
        return 1
    print(f"READY FOR ADVERSARIAL REVIEW — {len(results)}/{len(results)} gates pass")
    return 0


if __name__ == "__main__":
    sys.exit(main())
