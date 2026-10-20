#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""校验 AI 富化单元输出。"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
UNITS = ROOT / "数据与资料" / "待富化_batches" / "units"


def load(p):
    return json.load(open(p, encoding="utf-8-sig"))


def main():
    errors = []
    ok = 0
    for n in range(1, 64):
        inp = UNITS / f"unit_{n:02d}_input.json"
        out = UNITS / f"unit_{n:02d}_output.json"
        if not out.exists():
            errors.append((n, "missing output"))
            continue
        try:
            a = load(inp)
            b = load(out)
        except Exception as e:
            errors.append((n, f"json: {e}"))
            continue
        if len(b.get("words", [])) != len(a["words"]):
            errors.append((n, f"word count {len(b.get('words', []))}/{len(a['words'])}"))
            continue
        in_ids = [str(w["id"]) for w in a["words"]]
        out_ids = [str(w.get("id")) for w in b["words"]]
        if in_ids != out_ids:
            errors.append((n, "id/order mismatch"))
            continue
        bad = []
        for w in b["words"]:
            if not (w.get("core") or {}).get("feeling"):
                bad.append(f"{w.get('word')}: core")
            if not w.get("senses"):
                bad.append(f"{w.get('word')}: senses")
                continue
            for s in w["senses"]:
                for f in ("defZh", "defEn", "example", "exampleZh"):
                    if not s.get(f):
                        bad.append(f"{w.get('word')}: {f}")
        if bad:
            errors.append((n, "; ".join(bad[:6])))
            continue
        ok += 1
    print(f"ok units={ok}/63")
    for n, e in errors:
        print(f"unit {n:02d}: {e}")
    return 0 if ok == 63 else 1


if __name__ == "__main__":
    sys.exit(main())
