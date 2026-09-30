#!/usr/bin/env python3
"""Prepare the input files for the explanation-writing workflows.

Writes into OUT (default: ./_expl):
  all.txt                    one line per question of the whole bank: "<id> | <unit> | <q> => <correct answer>"
  facts/<unit>.txt           the unit's verified key rules
  unit/<unit>.txt            the same, for one unit (agents grep it for related questions)
  batch/<unit>__<n>.txt      a batch of questions in full (4 answers, correct one marked, picture path)
  batches.json               [{name, cat, catHe, unit, title, factsFile, file, unitFile, ids, imgs}]
"""
import json, os, sys, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '_expl')
LETTERS = 'אבגד'
CAT_HE = {'law': 'חוקי התנועה', 'safety': 'בטיחות ונהיגה', 'signs': 'תמרורים וסימני דרך', 'vehicle': 'הכרת הרכב'}

qs = json.load(open(os.path.join(ROOT, 'data/questions.json'), encoding='utf-8'))
units = json.load(open(os.path.join(ROOT, 'data/units.json'), encoding='utf-8'))['units']
by_unit = collections.defaultdict(list)
for q in qs:
    by_unit[q['u']].append(q)

for d in ('unit', 'batch', 'facts'):
    os.makedirs(os.path.join(OUT, d), exist_ok=True)

def compact(q):
    return f"{q['id']} | {q['u']} | {q['q']} => {q['a'][q['c']]}"

def full(q):
    flags = []
    if q.get('ns'): flags.append('NO-SHUFFLE (answers refer to each other by position)')
    if q.get('sg'): flags.append('SIGN-MEANING')
    head = f"[{q['id']}] lic:{','.join(q['lic'])} img:{('/home/user/TheroyExam/img/q/' + q['img']) if q.get('img') else '-'}" + (f"  flags: {', '.join(flags)}" if flags else '')
    lines = [head, f"  {q['q']}"]
    for i, a in enumerate(q['a']):
        lines.append(f"   {LETTERS[i]}. {a}" + ('   ✔ CORRECT' if i == q['c'] else ''))
    return '\n'.join(lines)

open(os.path.join(OUT, 'all.txt'), 'w', encoding='utf-8').write('\n'.join(compact(q) for q in qs) + '\n')

batches = []
for u in units:
    lst = sorted(by_unit[u['key']], key=lambda q: q['id'])
    uf = os.path.join(OUT, 'unit', u['key'] + '.txt')
    open(uf, 'w', encoding='utf-8').write('\n'.join(compact(q) for q in lst) + '\n')
    facts = [f['t'] if isinstance(f, dict) else f for f in (u.get('summary') or [])]
    ff = os.path.join(OUT, 'facts', u['key'] + '.txt')
    open(ff, 'w', encoding='utf-8').write('\n'.join(f'- {t}' for t in facts) + '\n')
    with_img = sum(1 for q in lst if q.get('img'))
    size = 12 if with_img * 2 >= len(lst) else 16
    n_batches = -(-len(lst) // size)
    per = -(-len(lst) // n_batches)          # even-sized chunks
    for i in range(n_batches):
        chunk = lst[i * per:(i + 1) * per]
        if not chunk:
            continue
        name = f"{u['key']}__{i + 1}"
        bf = os.path.join(OUT, 'batch', name + '.txt')
        open(bf, 'w', encoding='utf-8').write('\n\n'.join(full(q) for q in chunk) + '\n')
        batches.append({'name': name, 'cat': u['cat'], 'catHe': CAT_HE[u['cat']], 'unit': u['key'], 'title': u['title'],
                        'factsFile': ff, 'file': bf, 'unitFile': uf,
                        'ids': [q['id'] for q in chunk], 'imgs': sum(1 for q in chunk if q.get('img'))})

json.dump(batches, open(os.path.join(OUT, 'batches.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print(f"{len(batches)} batches, {sum(len(b['ids']) for b in batches)} questions -> {OUT}")
