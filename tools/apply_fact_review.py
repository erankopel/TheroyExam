#!/usr/bin/env python3
"""Dev helper: apply a fact-recheck workflow output (verdicts per unit: ok | fix | drop) to data/summaries.json.
Run once per output file, against the summaries the review was made for (indices refer to that list)."""
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
path = ROOT / "data/summaries.json"
summ = json.loads(path.read_text(encoding="utf-8"))
qs = {q["id"] for q in json.loads((ROOT / "data/questions.json").read_text(encoding="utf-8"))}
tot = {"ok": 0, "fix": 0, "drop": 0, "missing": 0}
for f in sys.argv[1:]:
    for u in json.loads(Path(f).read_text())["result"]:
        facts = summ[u["key"]]
        verdict = {v["idx"]: v for v in (u["verdicts"] or [])}
        out = []
        for i, fact in enumerate(facts):
            v = verdict.get(i)
            if v is None: tot["missing"] += 1; out.append(fact); continue   # no verdict: keep as is
            tot[v["verdict"]] += 1
            if v["verdict"] == "ok": out.append(fact)
            elif v["verdict"] == "fix" and v["fixed"].strip(): out.append({"t": v["fixed"].strip(), "refs": fact["refs"]})
        summ[u["key"]] = out
        print(f"{u['key']:32s} {len(facts)} -> {len(out)}")
path.write_text(json.dumps(summ, ensure_ascii=False, indent=1), encoding="utf-8")
print(tot, "total facts:", sum(len(v) for v in summ.values()))
