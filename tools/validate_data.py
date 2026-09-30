#!/usr/bin/env python3
"""Integrity checks for the shipped data (run in CI and after every data build)."""
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
qs = json.loads((ROOT / "data/questions.json").read_text(encoding="utf-8"))
units = json.loads((ROOT / "data/units.json").read_text(encoding="utf-8"))["units"]
errors, warns = [], []
ukeys = {u["key"]: u for u in units}
if len(ukeys) != len(units): errors.append("duplicate unit keys")
seen = set()
for q in qs:
    i = q["id"]
    if i in seen: errors.append(f"duplicate id {i}")
    seen.add(i)
    if len(q["a"]) != 4: errors.append(f"{i}: expected 4 answers")
    if not (0 <= q["c"] < len(q["a"])): errors.append(f"{i}: bad correct index")
    if len({a.strip() for a in q["a"]}) != len(q["a"]): warns.append(f"{i}: duplicate answer texts")
    if any(not a.strip() for a in q["a"]) or not q["q"].strip(): errors.append(f"{i}: empty text")
    if q["u"] not in ukeys: errors.append(f"{i}: unknown unit {q['u']}")
    elif ukeys[q["u"]]["cat"] != q["cat"]: errors.append(f"{i}: unit/category mismatch")
    if not q["lic"]: errors.append(f"{i}: no license classes")
    if q.get("img") and not (ROOT / "img/q" / q["img"]).exists(): errors.append(f"{i}: missing image {q['img']}")
count = {}
for q in qs: count[q["u"]] = count.get(q["u"], 0) + 1
for u in units:
    n = count.get(u["key"], 0)
    if n < 8: warns.append(f"unit {u['key']} is tiny ({n})")
    if not (ROOT / "img/units" / f"{u['key']}.svg").exists(): warns.append(f"unit {u['key']}: no icon")
    for f in u.get("summary", []):
        for r in f.get("refs", []):
            if r not in seen: errors.append(f"unit {u['key']}: summary ref to unknown question {r}")
# study explanations (optional file): known ids and the copy rules the app relies on
ex_path = ROOT / "data/explanations.json"
if ex_path.exists():
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from merge_explanations import lint
    ex = json.loads(ex_path.read_text(encoding="utf-8"))
    qmap = {q["id"]: q for q in qs}
    for k, v in ex.items():
        if not k.isdigit() or int(k) not in qmap: errors.append(f"explanation for unknown question {k}"); continue
        for prob in lint(v.get("e", ""), qmap[int(k)], "e") + lint(v.get("k", ""), qmap[int(k)], "k"):
            errors.append(f"explanation {k}: {prob}")
    print(f"{len(ex)} explanations ({len(ex) * 100 // len(qs)}% of the bank)")
print(f"{len(qs)} questions, {len(units)} units, {sum(1 for q in qs if q.get('img'))} with images")
for w in warns: print("warn:", w)
for e in errors: print("ERROR:", e)
sys.exit(1 if errors else 0)
