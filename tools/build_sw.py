#!/usr/bin/env python3
"""Stamp sw.js with a content-hash VERSION and the list of files to precache (everything except question pictures)."""
import hashlib, json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INCLUDE = ["index.html", "manifest.webmanifest", "css", "js", "fonts", "data/questions.json", "data/units.json", "data/explanations.json", "data/confusable.json", "img/app", "img/units"]

def files():
    out = []
    for inc in INCLUDE:
        p = ROOT / inc
        if p.is_file(): out.append(p)
        elif p.is_dir(): out += sorted(x for x in p.rglob("*") if x.is_file())
    return out

def main():
    fs = files()
    h = hashlib.sha256()
    for f in fs:
        h.update(str(f.relative_to(ROOT)).encode()); h.update(f.read_bytes())
    version = h.hexdigest()[:10]
    urls = ["./"] + [str(f.relative_to(ROOT)) for f in fs]
    sw = (ROOT / "sw.js").read_text(encoding="utf-8")
    sw = re.sub(r"const VERSION = '[^']*';", f"const VERSION = '{version}';", sw)
    sw = re.sub(r"const PRECACHE = \[.*?\];", "const PRECACHE = " + json.dumps(urls, ensure_ascii=False) + ";", sw, flags=re.S)
    (ROOT / "sw.js").write_text(sw, encoding="utf-8")
    print(f"sw.js: version {version}, {len(urls)} precached files")

if __name__ == "__main__":
    main()
