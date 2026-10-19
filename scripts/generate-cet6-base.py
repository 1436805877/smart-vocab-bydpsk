#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从 PDF 提取文本生成六级 4036 基础词库。

输入：数据与资料/pdf-text.txt（由 pypdf 提取）
可选：数据与资料/Feed.v2.json、数据与资料/单词本备份_2026-10-19.json
输出：数据与资料/六级4036_基础版.json

只做可靠的基础字段：单词、中文释义、词性、中文/英文拆分。
不编造核心感觉、词根、词源、近义组。
"""
import json
import re
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
DATA = ROOT / "数据与资料"
PDF_TEXT = DATA / "pdf-text.txt"
OUT = DATA / "六级4036_基础版.json"

POS_RE = re.compile(r"(?<![A-Za-z])(n|adj|adv|v|vt|vi|prep|conj|pron|num|art|aux|int)\.\s*", re.I)
NUM_LINE = re.compile(r"^\s*(\d{1,4})(?:\s+(.*))?$")
WORD_LINE = re.compile(r"^[^\W\d_][\w'’\- .]*$")
NOISE = ("Word Meaning", "六级大纲", "共 4036", "扫码听单词", "纸上默写")
RADICAL_MAP = {
    "⻋": "车", "⻓": "长", "⻛": "风", "⻅": "见", "⺠": "民", "⻝": "食",
    "⻔": "门", "⻢": "马", "⻜": "飞", "⻆": "角", "⻘": "青", "⻥": "鱼",
    "⻣": "骨", "㬵": "胶", "⻤": "鬼", "⻩": "黄", "⻮": "齿", "⻨": "麦",
    "⻬": "齐", "⻚": "页", "⻦": "鸟", "⻰": "龙", "⻉": "贝", "⻐": "钅",
    "⻑": "长", "⻒": "镸", "⻕": "阜", "⻖": "阝", "⻗": "雨", "⻙": "韦",
    "⻞": "飠", "⻟": "飠", "⻠": "饣", "⻧": "卤", "⻪": "黾", "⻫": "齐",
    "⻭": "齿", "⻯": "龙", "⻱": "龟", "⻲": "龟", "⻳": "龟",
}


def clean(s: str) -> str:
    s = unicodedata.normalize("NFKC", s or "")
    s = "".join(RADICAL_MAP.get(ch, ch) for ch in s)
    s = s.replace("（", "（").replace("）", "）")
    s = re.sub(r"\s+", " ", s).strip()
    return s


def is_noise(line: str) -> bool:
    return (not line) or any(n in line for n in NOISE) or re.fullmatch(r"\d+\s*/\s*\d+\s*页?", line) is not None


def split_zh_en(text: str):
    s = clean(text)
    if not s:
        return "", ""
    if not re.search(r"[\u3400-\u9fff]", s):
        return "", s
    m = re.match(r"^(.*?[\u3400-\u9fff][\s\S]*?)\s+([A-Za-z][\s\S]*)$", s)
    if m and re.search(r"[A-Za-z]", m.group(2)):
        return m.group(1).strip(), m.group(2).strip()
    return s, ""


def split_senses(meaning: str):
    text = clean(meaning)
    if not text:
        return []
    matches = list(POS_RE.finditer(text))
    if not matches:
        return [text]
    # 只保留从开头或空格后的词性标记，避免英文正文中的 "v." 误切
    starts = [m.start() for m in matches if m.start() == 0 or text[m.start() - 1].isspace()]
    if not starts:
        return [text]
    parts = []
    for i, start in enumerate(starts):
        end = starts[i + 1] if i + 1 < len(starts) else len(text)
        seg = text[start:end].strip(" ;；,，")
        if seg:
            parts.append(seg)
    return parts or [text]


def parse_pdf_text():
    text = PDF_TEXT.read_text(encoding="utf-8")
    words = {}
    meanings = {}
    current_num = None
    current_meaning = []
    lines = text.splitlines()
    for raw in lines:
        line = clean(raw)
        if is_noise(line) or line == "---PAGE" or line.startswith("---PAGE "):
            continue
        m = NUM_LINE.match(line)
        if m:
            num = int(m.group(1))
            rest = (m.group(2) or "").strip()
            if not rest:
                if current_num is not None and current_meaning:
                    meanings[current_num] = " ".join(current_meaning).strip()
                current_num = num
                current_meaning = []
                continue
            # 单词行：纯英文、无词性/中文
            if rest and WORD_LINE.fullmatch(rest) and not re.search(r"[\u3400-\u9fff]", rest) and num not in words:
                words[num] = rest
                continue
            # 释义行：以词性或中文开头，或内容含中文
            if rest and (POS_RE.match(rest) or re.search(r"[\u3400-\u9fff]", rest) or num in meanings):
                if current_num is not None and current_meaning:
                    meanings[current_num] = " ".join(current_meaning).strip()
                current_num = num
                current_meaning = [rest]
                continue
        # 续行：归属当前释义
        if current_num is not None and line and not line.startswith("---PAGE"):
            if not is_noise(line):
                current_meaning.append(line)
    if current_num is not None and current_meaning:
        meanings[current_num] = " ".join(current_meaning).strip()
    # 合并被拆开的编号/释义（极少）
    return words, meanings


def load_old_words():
    old = {}
    for name in ("Feed.v2.json", "单词本备份_2026-10-19.json"):
        p = DATA / name
        if not p.exists():
            continue
        try:
            obj = json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            continue
        for w in obj.get("words", []):
            word = clean(w.get("word", "")).lower()
            if word:
                old[word] = w
    return old


def make_senses(meaning, base_id):
    senses = []
    for i, seg in enumerate(split_senses(meaning)):
        pos_m = POS_RE.match(seg)
        pos = (pos_m.group(1) + ".") if pos_m else ""
        zh, en = split_zh_en(seg)
        senses.append({
            "id": base_id + i + 1,
            "definition": seg,
            "defZh": zh,
            "defEn": en,
            "pos": pos,
            "example": "",
            "tone": "",
            "topic": "",
            "level": "CET-6",
            "origin": "",
            "formality": "",
            "grammar": "",
            "synonyms": "",
            "collocations": "",
            "pitfall": "",
            "notes": [""],
        })
    if not senses:
        senses = [{
            "id": base_id + 1, "definition": "", "defZh": "", "defEn": "", "pos": "",
            "example": "", "tone": "", "topic": "", "level": "CET-6", "origin": "",
            "formality": "", "grammar": "", "synonyms": "", "collocations": "",
            "pitfall": "", "notes": [""]
        }]
    return senses


def main():
    if not PDF_TEXT.exists():
        print("缺少 pdf-text.txt", file=sys.stderr)
        return 1
    words, meanings = parse_pdf_text()
    nums = sorted(set(words) | set(meanings))
    print(f"解析：words={len(words)} meanings={len(meanings)} nums={len(nums)}")
    missing_words = [n for n in nums if n not in words]
    missing_meanings = [n for n in nums if n not in meanings]
    print(f"缺单词={len(missing_words)} 缺释义={len(missing_meanings)}")
    if missing_words[:10]: print("缺单词示例", [(n, meanings.get(n, "")[:20]) for n in missing_words[:10]])
    if missing_meanings[:10]: print("缺释义示例", missing_meanings[:10])

    old = load_old_words()
    print(f"旧数据可合并：{len(old)} 个词")
    now = int(datetime.now(timezone.utc).timestamp() * 1000)
    out_words = []
    deck_words = []
    deck_id = "cet6-4036-base"
    used_old = 0
    for idx, num in enumerate(nums, start=1):
        word = words.get(num, "")
        meaning = meanings.get(num, "")
        if not word:
            continue
        source = old.get(word.lower())
        if source:
            # 保留旧数据的核心/词根/词源/笔记，修正 ID 和释义拆分
            w = json.loads(json.dumps(source, ensure_ascii=False))
            w["id"] = idx
            w["word"] = word
            w["deleted"] = False
            w["addedDate"] = w.get("addedDate") or now
            w["lastReviewDate"] = w.get("lastReviewDate") or now
            w["mastery"] = w.get("mastery") or "unknown"
            w["reviewCount"] = w.get("reviewCount") or 0
            w["correctCount"] = w.get("correctCount") or 0
            if not w.get("senses"):
                w["senses"] = make_senses(meaning, idx * 100)
            for j, s in enumerate(w["senses"]):
                s["id"] = idx * 100 + j + 1
                s["definition"] = s.get("definition") or ""
                zh, en = split_zh_en(s["definition"])
                s["defZh"] = s.get("defZh") or zh
                s["defEn"] = s.get("defEn") or en
                if not s.get("defEn") and s.get("defZh"):
                    z2, e2 = split_zh_en(s["defZh"])
                    if e2:
                        s["defZh"], s["defEn"] = z2, e2
                s.setdefault("notes", [""])
                s.setdefault("level", "CET-6")
            w.setdefault("core", {})
            w.setdefault("morphology", {"parts": [], "literal": "", "rootFamilyId": None})
            w.setdefault("etymology", {"type": "legacy", "path": [], "story": "", "confidence": "low"})
            w.setdefault("wordNotes", [])
            used_old += 1
        else:
            senses = make_senses(meaning, idx * 100)
            w = {
                "id": idx,
                "word": word,
                "phonetic": "",
                "wordNotes": [],
                "core": {"feeling": "", "image": "", "keywords": [], "chain": []},
                "morphology": {"parts": [], "literal": "", "rootFamilyId": None},
                "etymology": {"type": "legacy", "path": [], "story": "", "confidence": "low"},
                "senses": senses,
                "mastery": "unknown",
                "addedDate": now,
                "lastReviewDate": now,
                "reviewCount": 0,
                "correctCount": 0,
                "deleted": False,
                "quality": "skeleton"
            }
        out_words.append(w)
        deck_words.append({"key": f"{deck_id}:{idx}", "deckId": deck_id, "wordId": idx})

    result = {
        "app": "智能单词本",
        "appVersion": "0.4.1",
        "schemaVersion": 3,
        "exportedAt": datetime.now(timezone.utc).isoformat(),
        "wordCount": len(out_words),
        "deckName": "六级大纲 4036（基础版）",
        "decks": [{
            "id": deck_id,
            "name": "六级大纲 4036（基础版）",
            "kind": "standard",
            "readOnly": True,
            "createdAt": now,
            "updatedAt": now,
            "description": "由六级大纲 PDF 生成；中文释义可用，核心/词根/近义待补。"
        }],
        "deckWords": deck_words,
        "words": out_words,
        "rootFamilies": [],
        "synonymGroups": [],
        "confusionPairs": [],
        "progress": []
    }
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"输出：{OUT}  words={len(out_words)} old_merged={used_old} size={OUT.stat().st_size/1024/1024:.2f}MB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
