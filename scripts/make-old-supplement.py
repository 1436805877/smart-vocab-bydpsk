#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 8/29 旧数据中不在 4036 大纲里的词单独导出，避免旧内容丢失。"""
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
DATA = ROOT / "数据与资料"
full = json.loads((DATA / "六级4036_完整版_v1.json").read_text(encoding="utf-8"))
old = json.loads((DATA / "单词本数据_2026-08-29_v2.json").read_text(encoding="utf-8"))
main_words = {w["word"].lower() for w in full["words"]}
now = int(datetime.now(timezone.utc).timestamp() * 1000)
deck_id = "old-supplement-2026-08-29"
words = []
deck_words = []
for i, w in enumerate(old.get("words", []), start=1):
    if w.get("word", "").lower() in main_words:
        continue
    x = json.loads(json.dumps(w, ensure_ascii=False))
    x["id"] = 10000 + i
    x["deleted"] = False
    x.setdefault("culture", {"background": "", "usage": "", "easterEggs": []})
    for j, s in enumerate(x.get("senses", [])):
        s["id"] = x["id"] * 100 + j + 1
        s.setdefault("defZh", "")
        s.setdefault("defEn", "")
        s.setdefault("example", "")
        s.setdefault("exampleZh", "")
        s.setdefault("notes", [""])
    words.append(x)
    deck_words.append({"key": f"{deck_id}:{x['id']}", "deckId": deck_id, "wordId": x["id"]})

result = {
    "app": "智能单词本", "appVersion": "0.4.4", "schemaVersion": 3,
    "exportedAt": datetime.now(timezone.utc).isoformat(),
    "wordCount": len(words),
    "deck": {"id": deck_id, "name": "旧数据补充（不在 4036 大纲）", "kind": "standard",
             "readOnly": True, "version": "1.0.0", "description": "8/29 旧数据中不在 PDF 大纲里的详细词，单独保留。"},
    "decks": [{"id": deck_id, "name": "旧数据补充（不在 4036 大纲）", "kind": "standard",
               "readOnly": True, "version": "1.0.0"}],
    "deckWords": deck_words,
    "words": words,
    "rootFamilies": old.get("rootFamilies", []),
    "synonymGroups": old.get("synonymGroups", []),
    "confusionPairs": old.get("confusionPairs", []),
    "progress": []
}
out = DATA / "旧数据补充_2026-08-29.json"
out.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"输出 {out} words={len(words)} size={out.stat().st_size/1024/1024:.2f}MB")
