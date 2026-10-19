#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
把 8/29 旧详细数据与 PDF 4036 合并成完整结构词库。

输出：
  数据与资料/六级4036_完整版_v1.json
  数据与资料/待富化_单词_含释义.json
  数据与资料/待富化_单词列表.txt
"""
import importlib.util
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
DATA = ROOT / "数据与资料"
SCRIPT = ROOT / "智能单词本-0.1" / "scripts" / "generate-cet6-base.py"

spec = importlib.util.spec_from_file_location("cet6base", SCRIPT)
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)


def norm(s):
    return base.clean(s).lower()


def culture_from_notes(notes):
    """从旧 note 的 💎 / 🔥 / 📌 段落提取文化/彩蛋，不新增事实。"""
    notes = [str(n) for n in (notes or [])]
    background = ""
    usage = ""
    eggs = []
    for n in notes:
        if n.startswith("🔥"):
            background = re.sub(r"^🔥[^：:]*[：:]\s*", "", n).strip()
        elif n.startswith("📌"):
            usage = re.sub(r"^📌[^：:]*[：:]\s*", "", n).strip()
        elif n.startswith("💎") or "🎭" in n or "🧠" in n:
            text = re.sub(r"^💎[^：:]*[：:]\s*", "", n).strip()
            parts = re.split(r"(?=🎭|🧠)", text)
            for p in parts:
                p = p.strip()
                if p:
                    eggs.append(re.sub(r"^(🎭|🧠)\s*", "", p).strip())
    return {"background": background, "usage": usage, "easterEggs": eggs[:8]}


def main():
    words_map, meanings = base.parse_pdf_text()
    nums = sorted(words_map)
    old_obj = json.loads((DATA / "单词本数据_2026-08-29_v2.json").read_text(encoding="utf-8"))
    old = {}
    for w in old_obj.get("words", []):
        k = norm(w.get("word", ""))
        if k and k not in old:
            old[k] = w
    print(f"PDF {len(nums)} 词，旧详细 {len(old)} 词")

    now = int(datetime.now(timezone.utc).timestamp() * 1000)
    deck_id = "cet6-4036-full"
    out_words = []
    deck_words = []
    missing = []
    used_old = 0
    for idx, num in enumerate(nums, start=1):
        word = words_map[num]
        source = old.get(norm(word))
        if source:
            w = json.loads(json.dumps(source, ensure_ascii=False))
            w["id"] = idx
            w["word"] = word
            w["deleted"] = False
            w["addedDate"] = w.get("addedDate") or now
            w["lastReviewDate"] = w.get("lastReviewDate") or now
            w["mastery"] = w.get("mastery") or "unknown"
            w["reviewCount"] = w.get("reviewCount") or 0
            w["correctCount"] = w.get("correctCount") or 0
            w["culture"] = culture_from_notes(w.get("wordNotes", []))
            w["enrichmentStatus"] = "detailed"
            w["quality"] = w.get("quality") or "legacy-detailed"
            # 保证 senses / id / 中英文拆分
            if not w.get("senses"):
                w["senses"] = base.make_senses(meanings.get(num, ""), idx * 100)
            for j, s in enumerate(w["senses"]):
                s["id"] = idx * 100 + j + 1
                s["definition"] = s.get("definition") or ""
                if not s.get("defZh"):
                    zh, en = base.split_zh_en(s["definition"])
                    s["defZh"] = zh
                    s["defEn"] = s.get("defEn") or en
                s.setdefault("defEn", "")
                s.setdefault("example", "")
                s.setdefault("exampleZh", "")
                s.setdefault("pos", "")
                s.setdefault("notes", [""])
                s.setdefault("level", "CET-6")
            w.setdefault("core", {"feeling": "", "image": "", "keywords": [], "chain": []})
            w.setdefault("morphology", {"parts": [], "literal": "", "rootFamilyId": None})
            w.setdefault("etymology", {"type": "legacy", "path": [], "story": "", "confidence": "low"})
            used_old += 1
        else:
            senses = base.make_senses(meanings.get(num, ""), idx * 100)
            w = {
                "id": idx, "word": word, "phonetic": "", "wordNotes": [],
                "core": {"feeling": "", "image": "", "keywords": [], "chain": []},
                "morphology": {"parts": [], "literal": "", "rootFamilyId": None},
                "etymology": {"type": "legacy", "path": [], "story": "", "confidence": "low"},
                "culture": {"background": "", "usage": "", "easterEggs": []},
                "senses": senses, "mastery": "unknown",
                "addedDate": now, "lastReviewDate": now,
                "reviewCount": 0, "correctCount": 0, "deleted": False,
                "enrichmentStatus": "base", "quality": "base"
            }
            missing.append({
                "word": word,
                "defZh": " / ".join(s.get("defZh", "") for s in senses if s.get("defZh")),
                "senses": [{"defZh": s.get("defZh", ""), "pos": s.get("pos", "")} for s in senses]
            })
        out_words.append(w)
        deck_words.append({"key": f"{deck_id}:{idx}", "deckId": deck_id, "wordId": idx})

    result = {
        "app": "智能单词本",
        "appVersion": "0.4.4",
        "schemaVersion": 3,
        "exportedAt": datetime.now(timezone.utc).isoformat(),
        "wordCount": len(out_words),
        "deckName": "六级大纲 4036（完整结构版）",
        "decks": [{
            "id": deck_id, "name": "六级大纲 4036（完整结构版）",
            "kind": "standard", "readOnly": True,
            "createdAt": now, "updatedAt": now,
            "description": "2589 个旧详细词 + 1447 个 PDF 基础词；基础词的核心/词根/文化待补。"
        }],
        "deckWords": deck_words,
        "words": out_words,
        "rootFamilies": old_obj.get("rootFamilies", []),
        "synonymGroups": old_obj.get("synonymGroups", []),
        "confusionPairs": old_obj.get("confusionPairs", []),
        "progress": []
    }
    out = DATA / "六级4036_完整版_v1.json"
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    (DATA / "待富化_单词_含释义.json").write_text(
        json.dumps(missing, ensure_ascii=False, indent=2), encoding="utf-8")
    (DATA / "待富化_单词列表.txt").write_text(
        "\n".join(m["word"] for m in missing) + "\n", encoding="utf-8")
    print(f"输出 {out} words={len(out_words)} detailed={used_old} base={len(missing)} "
          f"size={out.stat().st_size/1024/1024:.2f}MB")


if __name__ == "__main__":
    main()
