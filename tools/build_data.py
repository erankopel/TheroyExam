#!/usr/bin/env python3
"""Merge parsed questions + unit taxonomy + classification (+ optional summaries) into the app's data files.

Inputs  (data/):  questions_raw.json  units_def.json  classification.json  [summaries.json]  [qflags.json]
Outputs (data/):  questions.json (compact, shipped to the browser)   units.json

If units_def/classification are missing, falls back to one unit per official category so the app still runs.
"""
import json, os, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
D = ROOT / "data"
CAT_KEY = {"חוקי התנועה": "law", "בטיחות": "safety", "תמרורים": "signs", "הכרת הרכב": "vehicle"}

# answers that only make sense in their official position ("all of the above", ...)
POS_DEP = re.compile(r"(כל התשובות|אף תשובה|אף אחת מהתשובות|כל האמור|האמור לעיל|התשובות (הראשונות|האחרונות|א|ב|ג|ד)|תשובות (א|ב|ג|ד)\b|שתי התשובות|שלוש התשובות|התשובה (הראשונה|השנייה|השניה|השלישית|הרביעית|האחרונה)|כלל התשובות)")
# "what does this sign mean?" style stems with a single sign picture -> dictionary entries
SIGN_MEANING = re.compile(r"^(מה\s+(פירוש|משמעות|מציין|מסמל|מורה|מייצג)\b(?!.*הבדל)|.*משמעותו\?$)")

def load(name, default=None):
    p = D / name
    if p.exists():
        return json.loads(p.read_text(encoding="utf-8"))
    return default

def main():
    raw = load("questions_raw.json")
    units_def = load("units_def.json")
    cls = load("classification.json", {})
    summaries = load("summaries.json", {})
    qflags = load("qflags.json", {})
    ns_extra = set(qflags.get("ns", []))
    sg_extra = set(qflags.get("sg", []))
    sg_block = set(qflags.get("notSg", []))

    if not units_def:
        units_def = [dict(key=f"{k}-all", cat=k, title=he, blurb="כל השאלות בנושא", emoji="📘", order=1) for he, k in CAT_KEY.items()]
        cls = {}
        print("WARN: no taxonomy – using one unit per category", file=sys.stderr)
    unit_keys = {u["key"] for u in units_def}
    default_unit = {u["cat"]: u["key"] for u in reversed(units_def)}

    out, missing, bad = [], [], []
    for r in raw:
        cat = CAT_KEY[r["cat"]]
        u = cls.get(str(r["id"]))
        if u not in unit_keys:
            missing.append(r["id"]); u = default_unit[cat]
        elif not u.startswith(cat + "-"):
            bad.append((r["id"], u)); u = default_unit[cat]
        item = {"id": r["id"], "q": r["q"], "a": r["a"], "c": r["c"], "cat": cat, "u": u, "lic": r["lic"]}
        if r["img"]:
            item["img"] = os.path.basename(r["img"])
        if any(POS_DEP.search(a) for a in r["a"]) or r["id"] in ns_extra:
            item["ns"] = 1
        if r["img"] and cat == "signs" and r["id"] not in sg_block and (SIGN_MEANING.search(r["q"]) or r["id"] in sg_extra):
            item["sg"] = 1
        out.append(item)

    counts = {}
    for it in out: counts[it["u"]] = counts.get(it["u"], 0) + 1
    units = []
    for u in units_def:
        n = counts.get(u["key"], 0)
        if n == 0:
            print("WARN: empty unit", u["key"], file=sys.stderr); continue
        units.append({"key": u["key"], "cat": u["cat"], "title": u["title"], "blurb": u.get("blurb", ""), "emoji": u.get("emoji", ""),
                      "order": u.get("order", 0), "summary": summaries.get(u["key"], [])})
    (D / "questions.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (D / "units.json").write_text(json.dumps({"units": units}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"questions: {len(out)}  units: {len(units)}  ns: {sum(1 for x in out if x.get('ns'))}  sg: {sum(1 for x in out if x.get('sg'))}")
    if missing: print(f"WARN: {len(missing)} unclassified -> default unit", missing[:10], file=sys.stderr)
    if bad: print(f"WARN: {len(bad)} cross-category assignments ignored", bad[:10], file=sys.stderr)
    for u in units:
        icon = ROOT / "img" / "units" / f"{u['key']}.svg"
        if not icon.exists(): print("note: no icon for", u["key"], file=sys.stderr)

if __name__ == "__main__":
    main()
