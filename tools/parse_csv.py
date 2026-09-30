#!/usr/bin/env python3
"""Parse the official Ministry of Transport theory-question CSV into data/questions_raw.json.

Output per question:
  id        int      official question number
  q         str      question text (stem)
  a         [str]    answers in the official order
  c         int      index of the correct answer in `a`
  cat       str      official category (חוקי התנועה / בטיחות / תמרורים / הכרת הרכב)
  lic       [str]    license classes the question applies to (A, B, C1, C, D, 1)
  img       str|None original image URL on gov.il
"""
import csv, html, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "tools" / "source" / "TheoryExamHE-DATA.csv"
OUT = ROOT / "data" / "questions_raw.json"

# The source uses a Cyrillic "В" (U+0412) for license class B, normalise it.
LIC_FIX = {"В": "B"}
# The source CSV has a broken <img src="ה"> for question 574; the picture (alt="3574") lives in tq_pic_02.
IMG_FIX = {574: "https://www.gov.il/BlobFolder/generalpage/tq_pic_02/he/TQ_PIC_3574.jpg"}
LIC_ORDER = ["B", "A", "C1", "C", "D", "1"]

def clean(s: str) -> str:
    s = html.unescape(s)
    s = re.sub(r"<br\s*/?>", " ", s)
    s = re.sub(r"<[^>]+>", "", s)
    s = s.replace(" ", " ").replace("‏", "").replace("‎", "")
    return re.sub(r"\s+", " ", s).strip()

def main():
    rows = list(csv.DictReader(open(SRC, encoding="utf-8-sig", newline="")))
    out, problems = [], []
    for r in rows:
        m = re.match(r"\s*(\d+)\.\s*(.*)", r["title2"], re.S)
        if not m:
            problems.append(("no-id", r["title2"])); continue
        qid, stem = int(m.group(1)), clean(m.group(2))
        body = r["description4"]
        lis = re.findall(r"<li>\s*<span([^>]*)>(.*?)</span>\s*</li>", body, re.S)
        answers, correct = [], []
        for i, (attrs, txt) in enumerate(lis):
            answers.append(clean(txt))
            if "correctAnswer" in attrs:
                correct.append(i)
        if len(correct) != 1:
            problems.append(("correct-count", qid, len(correct)))
        img = None
        mi = re.search(r'<img[^>]*?src="?(https?://[^"\s>]+)', body)
        if mi: img = mi.group(1)
        elif "<img" in body: img = IMG_FIX.get(qid)
        tags = re.findall(r"«([^»]+)»", body)
        lic = sorted({LIC_FIX.get(t, t) for t in tags}, key=lambda t: LIC_ORDER.index(t) if t in LIC_ORDER else 99)
        out.append(dict(id=qid, q=stem, a=answers, c=correct[0] if correct else -1,
                        cat=r["category"].strip(), lic=lic, img=img))
    out.sort(key=lambda x: x["id"])
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=0), encoding="utf-8")
    print(f"{len(out)} questions -> {OUT}")
    for p in problems: print("PROBLEM", p)
    if problems: sys.exit(1)

if __name__ == "__main__":
    main()
