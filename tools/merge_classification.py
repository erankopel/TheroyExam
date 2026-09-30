#!/usr/bin/env python3
"""Dev helper: merge classifier-workflow outputs into data/classification.json + data/qflags.json.
Usage: merge_classification.py out1.json [out2.json ...]   (each is a workflow output file with a top-level "result")"""
import json, sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
cls, ns, sg, not_sg, low = {}, set(), set(), set(), set()
for f in sys.argv[1:]:
    r = json.loads(Path(f).read_text())["result"]
    for k, v in r["cls"].items():
        if v: cls[str(k)] = v
    ns.update(r["ns"]); sg.update(r["sg"]); not_sg.update(r["notSg"]); low.update(r["lowConf"])
    print(f, "->", len(r["cls"]), "questions", r.get("stats"))
(ROOT / "data/classification.json").write_text(json.dumps(dict(sorted(cls.items(), key=lambda kv: int(kv[0]))), ensure_ascii=False, indent=0))
(ROOT / "data/qflags.json").write_text(json.dumps({"ns": sorted(ns), "sg": sorted(sg), "notSg": sorted(not_sg), "lowConf": sorted(low)}, ensure_ascii=False))
c = Counter(cls.values())
print(f"{len(cls)} classified; ns={len(ns)} sg={len(sg)} notSg={len(not_sg)} lowConf={len(low)}")
for k, v in sorted(c.items()): print(f"  {k:34s} {v}")
