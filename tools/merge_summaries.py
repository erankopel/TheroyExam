#!/usr/bin/env python3
"""Dev helper: merge summary-workflow outputs into data/summaries.json with reliable question references.

The writer/verifier agents sometimes cited *line numbers* of their unit file instead of question ids. For every fact we
therefore evaluate both readings of each ref (id, or k-th question of the unit sorted by id), keep the reading whose
question text overlaps most with the fact, and drop refs / facts that have no lexical support in the unit.
Usage: merge_summaries.py out1.json [out2.json ...]"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
qs = {q["id"]: q for q in json.loads((ROOT / "data/questions.json").read_text(encoding="utf-8"))}
by_unit = {}
for q in qs.values(): by_unit.setdefault(q["u"], []).append(q["id"])
for v in by_unit.values(): v.sort()

STOP = set("של על את אם לא כל או גם רק עד הוא הם זה כדי אשר ידי אין יש הן היא זו אלה אלא כאשר בין לפי אחרי לפני מן מה מי איזה כמו כך לכן ואז וגם ולא שלא כי אך אבל".split())
PREFIX = "והבלמכש"
def toks(s):
    out = set()
    for t in re.findall(r"[֐-׿0-9A-Za-z]+", s.replace('"', "").replace("'", "")):
        if len(t) > 3 and t[0] in PREFIX: t = t[1:]
        if len(t) > 3 and t[0] in PREFIX: t = t[1:]
        if len(t) >= 2 and t not in STOP: out.add(t)
    return out
def qtoks(qid): q = qs[qid]; return toks(q["q"] + " " + q["a"][q["c"]])
def score(fact_toks, qid):
    qt = qtoks(qid)
    return len(fact_toks & qt) / (1 + 0.15 * max(0, len(qt) - 8))

facts_out, stats = {}, {}
for f in sys.argv[1:]:
    for u in json.loads(Path(f).read_text())["result"]:
        key, ids = u["key"], by_unit[u["key"]]
        idset, kept = set(ids), []
        for fact in u["facts"]:
            ft = toks(fact["t"])
            chosen = []
            for r in fact["refs"]:
                cands = []
                if r in idset: cands.append(r)
                if 1 <= r <= len(ids): cands.append(ids[r - 1])
                if not cands: continue
                best = max(cands, key=lambda c: score(ft, c))
                if score(ft, best) >= 1.0 and best not in chosen: chosen.append(best)
            if not chosen:  # nothing usable cited: search the unit for supporting questions
                ranked = sorted(ids, key=lambda c: -score(ft, c))
                chosen = [c for c in ranked[:2] if score(ft, c) >= 2.0]
            if chosen:
                kept.append({"t": fact["t"], "refs": chosen[:3]})
        facts_out[key] = kept
        stats[key] = (len(u["facts"]), len(kept))
out = ROOT / "data/summaries.json"
old = json.loads(out.read_text()) if out.exists() else {}
old.update(facts_out)
out.write_text(json.dumps(old, ensure_ascii=False, indent=1), encoding="utf-8")
for k, (a, b) in stats.items(): print(f"{k:32s} {a} -> {b}")
print(f"summaries.json: {len(old)} units, {sum(len(v) for v in old.values())} facts")
