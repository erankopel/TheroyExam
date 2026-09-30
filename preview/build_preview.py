#!/usr/bin/env python3
"""Build the marked v2 preview that is published under /preview/ of the real site.

usage: build_preview.py --src <checkout of the v2 branch> --out <output dir, e.g. _site/preview> [--sha SHA] [--ref REF]

The preview shares its origin (and therefore localStorage and Cache Storage) with the real site, so everything that
could collide is renamed: every "road26" identifier (progress key, picture flags, service-worker caches, backup file
name) becomes "road26pv". The service worker of the real site therefore never deletes the preview's caches, and the
preview never reads or writes the learner's real progress.

Also: a thin strip at the top says this is the preview and which commit it is, the page is marked noindex, the title
gets a "[תצוגה]" prefix (kept when the app rewrites it), the installed app is named "26 תצוגה", and version.txt
records what was published.

The output is built in a temporary directory and moved into place only when every check passed, so a failure never
leaves a half-built /preview/ behind. The source tree is never modified.
"""
import argparse, datetime, html, json, os, pathlib, re, shutil, subprocess, sys, tempfile

TEXT_EXT = {'.js', '.html', '.css', '.json', '.webmanifest', '.txt', '.svg'}
COPY = ['index.html', 'manifest.webmanifest', 'sw.js', 'css', 'js', 'fonts', 'img']
DATA = ['questions.json', 'units.json', 'explanations.json']   # explanations.json is optional
OLD, NEW = 'road26', 'road26pv'


def fail(msg):
    print(f'::error title=preview build failed::{msg}')
    sys.exit(1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--sha', default='')
    ap.add_argument('--ref', default='')
    a = ap.parse_args()
    src, out = pathlib.Path(a.src).resolve(), pathlib.Path(a.out).resolve()
    sha = a.sha or subprocess.run(['git', '-C', str(src), 'rev-parse', 'HEAD'], capture_output=True, text=True).stdout.strip() or 'unknown'
    ref = a.ref or 'unknown'
    short = sha[:7]
    out.parent.mkdir(parents=True, exist_ok=True)
    stage = pathlib.Path(tempfile.mkdtemp(prefix='preview-', dir=out.parent))
    try:
        build(src, stage, sha, ref, short)
        if out.exists():
            shutil.rmtree(out)
        shutil.move(str(stage), str(out))
    except Exception as e:  # noqa: BLE001 - any problem means "no preview", never a broken one
        shutil.rmtree(stage, ignore_errors=True)
        fail(f'{type(e).__name__}: {e}')
    print(f'preview built: {short} ({ref}) -> {out} ({sum(1 for _ in out.rglob("*") if _.is_file())} files)')


def build(src, stage, sha, ref, short):
    # 1. copy the site files (never the tests, tools, docs or the raw data)
    for name in COPY:
        p = src / name
        if p.is_dir():
            shutil.copytree(p, stage / name)
        elif p.is_file():
            shutil.copy2(p, stage / name)
        else:
            raise FileNotFoundError(name)
    (stage / 'data').mkdir()
    for name in DATA:
        p = src / 'data' / name
        if p.is_file():
            shutil.copy2(p, stage / 'data' / name)
        elif name != 'explanations.json':
            raise FileNotFoundError(f'data/{name}')
    (stage / 'tools').mkdir()
    shutil.copy2(src / 'tools' / 'build_sw.py', stage / 'tools' / 'build_sw.py')

    # 2. rename the identifiers that would collide with the real site
    for p in stage.rglob('*'):
        if p.is_file() and p.suffix in {'.js', '.html'} and 'tools' not in p.relative_to(stage).parts:
            t = p.read_text(encoding='utf-8')
            if OLD in t:
                p.write_text(t.replace(OLD, NEW), encoding='utf-8')

    # 3. mark it as the preview
    index = stage / 'index.html'
    s = index.read_text(encoding='utf-8')
    if '<body>' not in s or '</head>' not in s or '<title>' not in s:
        raise ValueError('unexpected index.html layout')
    s = s.replace('<title>', '<title>[תצוגה] ', 1)
    s = s.replace('content="#2456e6"', 'content="#d77e00"', 1)                    # browser bar colour
    s = s.replace('content="הדרך ל־26"', 'content="26 תצוגה"', 1)                  # iOS home-screen name
    head_extra = '''  <meta name="robots" content="noindex, nofollow">
  <script>
    (function () { var P = '[תצוגה] ', t = document.querySelector('title');
      function f() { if (document.title.indexOf(P) !== 0) document.title = P + document.title; }
      if (t) new MutationObserver(f).observe(t, { childList: true }); f(); })();
  </script>
  <style>
    /* a thin strip above the app in normal flow: it scrolls away and never covers the app's sticky header */
    #preview-badge { background: #d77e00; color: #fff; text-align: center; font: 600 11px/1.5 system-ui, sans-serif;
      padding: max(2px, env(safe-area-inset-top)) 8px 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  </style>
'''
    s = s.replace('</head>', head_extra + '</head>', 1)
    badge = f'<div id="preview-badge" role="note" dir="rtl">גרסת תצוגה · ההתקדמות נפרדת מהאתר הרגיל · {html.escape(short)}</div>'
    s = s.replace('<body>', '<body>\n  ' + badge, 1)
    index.write_text(s, encoding='utf-8')

    mf = stage / 'manifest.webmanifest'
    m = json.loads(mf.read_text(encoding='utf-8'))
    m['name'], m['short_name'], m['theme_color'] = 'הדרך ל־26 (גרסת תצוגה)', '26 תצוגה', '#d77e00'
    mf.write_text(json.dumps(m, ensure_ascii=False, indent=2), encoding='utf-8')

    # 4. stamp the service worker (cache version + precache list) from the patched files, then drop the helper
    r = subprocess.run([sys.executable, str(stage / 'tools' / 'build_sw.py')], capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError('build_sw.py: ' + r.stderr.strip()[:300])
    shutil.rmtree(stage / 'tools')
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M UTC')
    (stage / 'version.txt').write_text(f'{sha}\n{ref}\n{stamp}\n', encoding='utf-8')
    (stage / '.nojekyll').write_text('', encoding='utf-8')

    # 5. checks: nothing may still be able to touch the real site's storage or caches
    for p in stage.rglob('*'):
        if p.is_file() and p.suffix in TEXT_EXT:
            t = p.read_text(encoding='utf-8', errors='ignore')
            bad = re.search(r'road26(?!pv)', t)
            if bad:
                raise AssertionError(f'{p.relative_to(stage)} still contains "{bad.group(0)}" without the preview suffix')
    sw = (stage / 'sw.js').read_text(encoding='utf-8')
    if 'road26pv-app-' not in sw or 'road26pv-img-' not in sw:
        raise AssertionError('service worker caches were not renamed')
    if "'road26pv.v1'" not in (stage / 'js' / 'config.js').read_text(encoding='utf-8'):
        raise AssertionError('storage key was not renamed')
    for need in ('index.html', 'sw.js', 'manifest.webmanifest', 'data/questions.json', 'data/units.json', 'js/app.js', 'css/style.css'):
        if not (stage / need).is_file() or (stage / need).stat().st_size == 0:
            raise AssertionError(f'missing or empty: {need}')
    if 'id="preview-badge"' not in (stage / 'index.html').read_text(encoding='utf-8'):
        raise AssertionError('badge missing')
    json.loads((stage / 'manifest.webmanifest').read_text(encoding='utf-8'))
    for name in ('questions.json', 'units.json') + (('explanations.json',) if (stage / 'data' / 'explanations.json').is_file() else ()):
        json.loads((stage / 'data' / name).read_text(encoding='utf-8'))


if __name__ == '__main__':
    main()
