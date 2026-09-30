#!/usr/bin/env python3
"""Turn the assembled site (_site) into the clearly-marked preview build.

usage: patch_preview.py <site-dir> <source-sha> <source-ref>

- a thin strip at the very top (in normal flow, so it scrolls away and never covers the app) says this is the preview and which commit it is
- the page asks search engines not to index it
- the installed app / browser bar look different from the real site (name, colour)
- version.txt records what is published, so the hourly job only redeploys when the branch changed
"""
import datetime, html, json, pathlib, re, sys

site = pathlib.Path(sys.argv[1])
sha, ref = sys.argv[2], sys.argv[3]
short = sha[:7]
stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M UTC')

index = site / 'index.html'
s = index.read_text(encoding='utf-8')
assert '<body>' in s and '</head>' in s, 'unexpected index.html layout'
s = s.replace('<title>', '<title>[תצוגה] ', 1)   # the app rewrites the title per screen; the script below keeps the prefix
s = s.replace('content="#2456e6"', 'content="#d77e00"', 1)                 # browser bar colour
s = s.replace('content="הדרך ל־26"', 'content="26 תצוגה"', 1)               # iOS home-screen name
head_extra = '''  <meta name="robots" content="noindex, nofollow">
  <script>
    (function () { var P = '[תצוגה] ', t = document.querySelector('title');
      function f() { if (document.title.indexOf(P) !== 0) document.title = P + document.title; }
      if (t) new MutationObserver(f).observe(t, { childList: true }); f(); })();
  </script>
  <style>
    /* a thin strip above the app in normal flow: it scrolls away, the app's sticky header is never covered */
    #preview-badge { background: #d77e00; color: #fff; text-align: center; font: 600 11px/1.5 system-ui, sans-serif;
      padding: max(2px, env(safe-area-inset-top)) 8px 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  </style>
'''
s = s.replace('</head>', head_extra + '</head>', 1)
badge = f'<div id="preview-badge" role="note" dir="rtl">גרסת תצוגה · ההתקדמות נפרדת מהאתר הרגיל · {html.escape(short)}</div>'
s = s.replace('<body>', '<body>\n  ' + badge, 1)
index.write_text(s, encoding='utf-8')

mf = site / 'manifest.webmanifest'
m = json.loads(mf.read_text(encoding='utf-8'))
m['name'] = 'הדרך ל־26 (גרסת תצוגה)'
m['short_name'] = '26 תצוגה'
m['theme_color'] = '#d77e00'
mf.write_text(json.dumps(m, ensure_ascii=False, indent=2), encoding='utf-8')

(site / 'version.txt').write_text(f'{sha}\n{ref}\n{stamp}\n', encoding='utf-8')
print(f'preview build: {short} ({ref}) {stamp}')
