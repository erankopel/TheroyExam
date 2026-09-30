#!/usr/bin/env python3
"""Dev helper: merge explanation-workflow outputs into data/explanations.json ({id: {e, k}}) and lint them.

Usage: merge_explanations.py [--meta META.json] out1.json [out2.json ...]
  outN.json   a workflow output file ({"result": {"results": [{"recs": [...]}]}}, or the bare {"results": [...]})
  --meta      also write the audit metadata (basis, verdicts, unsure/doubt flags) for the records to this file

Records that were removed by a verifier are left out. The lint (also used by validate_data.py) rejects explanations
that would be wrong in the app: references to answer letters/positions (answers are shuffled), second-person masculine
forms (the copy must be gender-neutral), over-long text and empty text."""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HEB = "א-ת"
LETTER_REFS = [
    re.compile(rf"(?<![{HEB}])[אבגד][׳'](?![{HEB}])"),                                      # א'  ב׳
    re.compile(rf"(?<![{HEB}])(?:תשובה|תשובות|סעיף|סעיפים|אפשרות|אפשרויות)\s+[אבגד](?![{HEB}])"),  # תשובה ב
    re.compile(rf"(?<![{HEB}])(?:התשובה|האפשרות)\s+(?:הראשונה|השנייה|השניה|השלישית|הרביעית|האחרונה)"),
    re.compile(rf"(?<![{HEB}])(?:הראשונה|השנייה|השניה|השלישית|הרביעית|האחרונה)\s+(?:היא|נכונה|שגויה)"),
]
MASC_SECOND_PERSON = re.compile(rf"(?<![{HEB}])(?:אתה|עליך|לך|שלך|בפניך|תעצור|תאט|תבדוק|תשמור|תיתן|תסתכל|תוודא|תנהג|תפנה|תעקוף)(?![{HEB}])")
MAX_WORDS = 55      # the writers were asked for <=45; slack for punctuation-glued tokens


def lint(text, q=None, field="e"):
    """Return a list of problems (empty = fine). q is the question dict (for the NO-SHUFFLE exemption)."""
    probs = []
    if not text or not text.strip():
        return ["empty"] if field == "e" else []
    words = len(text.split())
    if words > (MAX_WORDS if field == "e" else 18):
        probs.append(f"too long ({words} words)")
    if not (q and q.get("ns")):
        for rx in LETTER_REFS:
            m = rx.search(text)
            if m:
                probs.append(f"refers to an answer position: '{m.group(0)}'")
                break
    m = MASC_SECOND_PERSON.search(text)
    if m:
        probs.append(f"masculine second person: '{m.group(0)}'")
    if re.search(r"[‎‏‪-‮]", text):
        probs.append("stray bidi control character")
    if "  " in text or text != text.strip():
        probs.append("whitespace")
    return probs


def main(argv):
    meta_out = None
    files = []
    it = iter(argv)
    for a in it:
        if a == "--meta":
            meta_out = next(it)
        else:
            files.append(a)
    qs = {q["id"]: q for q in json.loads((ROOT / "data/questions.json").read_text(encoding="utf-8"))}
    recs = {}
    for f in files:
        obj = json.loads(Path(f).read_text(encoding="utf-8"))
        res = obj.get("result", obj)
        for batch in res["results"]:
            for r in batch["recs"]:
                recs[r["id"]] = r  # later files win
    out, meta, bad, removed = {}, {}, [], 0
    for qid, r in sorted(recs.items()):
        q = qs.get(qid)
        if not q:
            bad.append((qid, "unknown id")); continue
        meta[qid] = {k: r.get(k) for k in ("basis", "v1", "v1why", "v2", "v2why", "unsure", "doubt", "doubtNote", "removed", "refs")}
        if r.get("removed"):
            removed += 1; continue
        probs = lint(r["e"], q, "e") + lint(r.get("k", ""), q, "k")
        if probs:
            bad.append((qid, "; ".join(probs))); continue
        out[str(qid)] = {"e": r["e"].strip(), **({"k": r["k"].strip()} if r.get("k", "").strip() else {})}
    (ROOT / "data/explanations.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    if meta_out:
        Path(meta_out).write_text(json.dumps(meta, ensure_ascii=False, indent=0), encoding="utf-8")
    print(f"{len(out)} explanations written ({removed} removed by verifiers, {len(bad)} rejected by lint, {len(qs) - len(out) - len(bad) - removed} missing)")
    for qid, why in bad[:60]:
        print(f"  lint #{qid}: {why}")


if __name__ == "__main__":
    main(sys.argv[1:])
