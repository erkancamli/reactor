import json, sys, re
en = [json.loads(l) for l in open(sys.argv[1]) if l.strip()]
problems = []
try:
    tr = [json.loads(l) for l in open(sys.argv[2]) if l.strip()]
except Exception as e:
    print('bad json:', e); sys.exit(1)
trm = {o.get('id'): o for o in tr}
if len(tr) != len(trm): problems.append('duplicate ids in tr')
import glob, os
_C = os.path.dirname(os.path.abspath(__file__)) + '/txt/*.md'
HYPH = set()
for f in glob.glob(_C): HYPH |= set(re.findall(r"[a-z0-9]+(?:-[a-z0-9]+)+", open(f).read().lower()))
def dash(s):
    for w in re.findall(r"[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+", s):
        if w.lower() in HYPH: s = s.replace(w, 'X')
    return bool(re.search(r'[–—]', s) or re.search(r'\s-\s', s) or re.search(r'(^|\s)-\w', s) or re.search(r'\w-(\s|$)', s) or re.search(r'[A-Za-zçğıöşüÇĞİÖŞÜ]-[A-Za-zçğıöşüÇĞİÖŞÜ]', s))
for e in en:
    t = trm.get(e['id'])
    if not t: problems.append(f"{e['id']}: missing"); continue
    allowed = {'id', 'q', 's', 'a', 'steps', 'why', 'context'}
    for k in t:
        if k not in allowed: problems.append(f"{e['id']}: unknown field {k}")
    if 'why' not in t or not isinstance(t['why'], str): problems.append(f"{e['id']}: why missing")
    elif len(t['why']) > 230: problems.append(f"{e['id']}: why too long")
    typ = e['type']
    if typ in ('mcq', 'fill', 'order', 'source'):
        if 'q' not in t: problems.append(f"{e['id']}: q missing"); continue
        if len(t['q']) > 170 + (60 if typ == 'source' else 0): problems.append(f"{e['id']}: q too long")
        if typ == 'fill' and t['q'].count('____') != 1: problems.append(f"{e['id']}: fill blank count")
        if typ == 'mcq' and not t['q'].rstrip().endswith('?'): problems.append(f"{e['id']}: q no ?")
    if typ == 'noise':
        if 's' not in t: problems.append(f"{e['id']}: s missing"); continue
        if len(t['s']) > 160: problems.append(f"{e['id']}: s too long")
        if t['s'].rstrip().endswith('?'): problems.append(f"{e['id']}: s ends with ?")
    if typ in ('mcq', 'fill', 'source'):
        a = t.get('a')
        if not (isinstance(a, list) and len(a) == 4): problems.append(f"{e['id']}: a not 4"); continue
        if len(set(x.strip().lower() for x in a)) < 4: problems.append(f"{e['id']}: dup options")
        if any(len(x) > (60 if typ == 'fill' else 95) for x in a): problems.append(f"{e['id']}: option too long")
        if typ == 'source' and a != e['a']: problems.append(f"{e['id']}: source options must equal English titles")
    if typ == 'order':
        st = t.get('steps')
        if not (isinstance(st, list) and len(st) == len(e['steps'])): problems.append(f"{e['id']}: steps count"); continue
        if any(len(x) > 75 for x in st): problems.append(f"{e['id']}: step too long")
    texts = [t.get('q', ''), t.get('s', ''), t.get('why', '')] + list(t.get('a', []) or []) + list(t.get('steps', []) or [])
    if typ == 'source': texts = [t.get('q', ''), t.get('why', '')]
    for x in texts:
        if not isinstance(x, str): problems.append(f"{e['id']}: non string"); continue
        if dash(x): problems.append(f"{e['id']}: dash in '{x[:40]}'")
    # untranslated check: identical to English for long texts
    for k in ('q', 's', 'why'):
        if k in e and k in t and len(e[k]) > 25 and e[k].strip() == t[k].strip() and typ != 'source': problems.append(f"{e['id']}: {k} not translated")
extra = set(trm) - set(o['id'] for o in en)
for x in extra: problems.append(f'{x}: not in English file')
for p in problems: print(p)
print(len(problems), 'problems', len(trm), 'lines')
