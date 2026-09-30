#!/usr/bin/env python3
"""Dev helper: extract finished taxonomy synthesizer results from a workflow journal into data/units_def.json
and one readable definitions file per category for the classifier agents."""
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
J = Path(sys.argv[1])
SP = Path(sys.argv[2])
rows = [json.loads(l) for l in J.read_text().splitlines()]
label = {r["agentId"]: r["label"] for r in rows if r["type"] == "started"}
defs = json.loads((ROOT / "data/units_def.json").read_text()) if (ROOT / "data/units_def.json").exists() else []
have = {u["cat"] for u in defs}
for r in rows:
    if r["type"] != "result": continue
    lab = label.get(r["agentId"], "")
    if not lab.startswith("synthesize:"): continue
    cat = lab.split(":")[1]
    if cat in have: continue
    for i, u in enumerate(r["result"]["units"], 1):
        assert u["key"].startswith(cat + "-"), u["key"]
        defs.append({"key": u["key"], "cat": cat, "order": i, "title": u["title"], "blurb": u["blurb"], "emoji": u["emoji"],
                     "iconBrief": u["iconBrief"], "definition": u["definition"], "estCount": u["estCount"], "exampleIds": u["exampleIds"]})
    have.add(cat)
    with open(SP / f"units_{cat}.txt", "w") as f:
        for u in r["result"]["units"]:
            f.write(f"UNIT {u['key']}  —  {u['title']}\n  blurb: {u['blurb']}\n  DEFINITION: {u['definition']}\n  examples (ids): {u['exampleIds']}\n\n")
    print("wrote", cat, len(r["result"]["units"]), "units")
(ROOT / "data/units_def.json").write_text(json.dumps(defs, ensure_ascii=False, indent=1), encoding="utf-8")
print("units_def.json:", len(defs), "units in", sorted(have))
