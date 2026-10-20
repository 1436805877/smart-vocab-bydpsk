#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 AI 富化单元合并回 4036 主文件。"""
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
DATA = ROOT / "数据与资料"
UNITS = DATA / "待富化_batches" / "units"


def load(p):
    return json.load(open(p, encoding="utf-8-sig"))


def main():
    main = load(DATA / "六级4036_完整版_v1.json")
    by_id = {str(w["id"]): w for w in main["words"]}
    merged = 0
    missing = []
    for n in range(1, 64):
        p = UNITS / f"unit_{n:02d}_output.json"
        if not p.exists():
            missing.append(n)
            continue
        try:
            unit = load(p)
        except Exception as e:
            print(f"unit {n}: json error {e}", file=sys.stderr)
            missing.append(n)
            continue
        for src in unit.get("words", []):
            w = by_id.get(str(src.get("id")))
            if not w:
                print(f"unit {n}: unknown id {src.get('id')}", file=sys.stderr)
                continue
            for key in ("phonetic",):
                if src.get(key):
                    w[key] = src[key]
            if src.get("core") and src["core"].get("feeling"):
                w["core"] = src["core"]
            if src.get("morphology"):
                w["morphology"] = src["morphology"]
            if src.get("etymology"):
                w["etymology"] = src["etymology"]
            if src.get("culture"):
                w["culture"] = src["culture"]
            if src.get("senses"):
                # 保留已有的 notes/wordNotes，替换义项内容
                old_senses = {str(s.get("id")): s for s in w.get("senses", [])}
                senses = []
                for s in src["senses"]:
                    base = old_senses.get(str(s.get("id")), {})
                    out = dict(base)
                    out.update(s)
                    out.setdefault("definition", (s.get("defZh", "") + " " + s.get("defEn", "")).strip())
                    out.setdefault("example", "")
                    out.setdefault("exampleZh", "")
                    out.setdefault("notes", base.get("notes", [""]))
                    out.setdefault("level", "CET-6")
                    senses.append(out)
                if senses:
                    w["senses"] = senses
            w["enrichmentStatus"] = "ai-enriched"
            w["quality"] = "ai-enriched"
            merged += 1
    main["wordCount"] = len(main["words"])
    main["appVersion"] = "0.5.0"
    main["exportedAt"] = datetime.now(timezone.utc).isoformat()
    main["enrichment"] = {
        "source": "legacy-2026-08-29 + PDF 4036 + AI batches",
        "mergedWords": merged,
        "missingUnits": missing,
        "generatedAt": datetime.now(timezone.utc).isoformat()
    }
    out = DATA / "六级4036_完整版_v2.json"
    out.write_text(json.dumps(main, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"merged={merged} missing_units={missing} words={len(main['words'])} "
          f"size={out.stat().st_size/1024/1024:.2f}MB")
    return 0 if not missing else 1


if __name__ == "__main__":
    sys.exit(main())
