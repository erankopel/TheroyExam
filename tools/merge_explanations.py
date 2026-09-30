#!/usr/bin/env python3
"""Dev helper: merge explanation-workflow outputs into data/explanations.json ({id: {e, k}}) and lint them.

Usage: merge_explanations.py [--strict] [--meta META.json] out1.json [out2.json ...]
  outN.json   a workflow output file ({"result": {"results": [{"recs": [...]}]}}, or the bare {"results": [...]})
  --meta      also write the audit metadata (basis, verdicts, unsure/doubt flags) for the records to this file
  --strict    only keep records that finished every review stage: bank check done, law check done, and a final
              read whenever the law reviewer rewrote the text or anyone marked it unsure (records still waiting for a stage are held back)

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
MASC_SECOND_PERSON = re.compile(rf"(?<![{HEB}])(?:אתה|עליך|לך|שלך|בפניך|תאט|תבדוק|תשמור|תיתן|תסתכל|תוודא|תנהג|תפנה|תעקוף)(?![{HEB}])")
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
            for m in rx.finditer(text):
                # a letter that the question or its answers use as a label (e.g. "רחוב א'" in a junction picture,
                # "ביטוח צד ג'") is part of the content, not a reference to an answer position
                if q and m.group(0) in " ".join([q.get("q", ""), *q.get("a", [])]):
                    continue
                probs.append(f"refers to an answer position: '{m.group(0)}'")
                break
            if probs:
                break
    m = MASC_SECOND_PERSON.search(text)
    if m:
        probs.append(f"masculine second person: '{m.group(0)}'")
    if re.search(r"[‎‏‪-‮]", text):
        probs.append("stray bidi control character")
    if "  " in text or text != text.strip():
        probs.append("whitespace")
    return probs


def fully_reviewed(r):
    """True when the record went through the bank check, the law check and (if the law reviewer rewrote it or it was marked unsure) the final read."""
    ok = ("ok", "fix")
    if r.get("v1") not in ok or r.get("v2") not in ok:
        return False
    needs_final = r["v2"] == "fix" or r.get("unsure")
    return not needs_final or r.get("v3") in ok


def main(argv):
    meta_out = None
    strict = False
    files = []
    it = iter(argv)
    for a in it:
        if a == "--meta":
            meta_out = next(it)
        elif a == "--strict":
            strict = True
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
    out, meta, bad, removed, held = {}, {}, [], 0, []
    for qid, r in sorted(recs.items()):
        q = qs.get(qid)
        if not q:
            bad.append((qid, "unknown id")); continue
        meta[qid] = {k: r.get(k) for k in ("basis", "v1", "v1why", "v2", "v2why", "v3", "v3why", "unsure", "doubt", "doubtNote", "removed", "refs")}
        if r.get("removed"):
            removed += 1; continue
        if strict and not fully_reviewed(r):
            held.append(qid); continue
        probs = lint(r["e"], q, "e") + lint(r.get("k", ""), q, "k")
        if probs:
            bad.append((qid, "; ".join(probs))); continue
        out[str(qid)] = {"e": r["e"].strip(), **({"k": r["k"].strip()} if r.get("k", "").strip() else {})}
    (ROOT / "data/explanations.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    if meta_out:
        Path(meta_out).write_text(json.dumps(meta, ensure_ascii=False, indent=0), encoding="utf-8")
    print(f"{len(out)} explanations written ({removed} removed by verifiers, {len(bad)} rejected by lint, {len(held)} held back for missing review stages, {len(qs) - len(recs)} without any record)")
    for qid, why in bad[:60]:
        print(f"  lint #{qid}: {why}")


if __name__ == "__main__":
    main(sys.argv[1:])
