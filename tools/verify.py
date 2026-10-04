import json, re, sys, glob, os
C = os.path.dirname(os.path.abspath(__file__)) + '/'
TOPICS = ['company','reactive','edge','stream','stake','agents','scale','rwa','privacy','markets','economics','gauss','systems','devs','playground']
def norm(s):
    s = s.replace('’', "'").replace('‘', "'").replace('“', '"').replace('”', '"').replace(' ', ' ')
    s = re.sub(r'[\*_`\\#>]', '', s)
    return re.sub(r'\s+', ' ', s).strip().lower()
files = {os.path.basename(f): norm(open(f).read()) for f in glob.glob(C + 'txt/*.md')}
ALLTXT = '\n'.join(files.values())
HYPH = set(re.findall(r"[a-z0-9]+(?:-[a-z0-9]+)+", ALLTXT))
def dash_ok(s):
    if re.search(r'[–—]', s) or re.search(r'\s-\s', s) or re.search(r'(^|\s)-\w', s) or re.search(r'\w-(\s|$)', s): return False
    for w in re.findall(r"[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+", s):
        if w.lower() not in HYPH: return False
    return True
def texts(o):
    t = []
    for k in ('q', 's', 'why'):
        if k in o: t.append((k, o[k]))
    for x in o.get('a', []) or []: t.append(('option', x))
    for x in o.get('steps', []) or []: t.append(('step', x))
    return t
def check(path, seen_ids=None):
    good, bad = [], []
    ids = seen_ids if seen_ids is not None else set()
    for n, line in enumerate(open(path), 1):
        line = line.strip()
        if not line: continue
        try: o = json.loads(line)
        except Exception as e: bad.append((n, 'json', str(e)[:80])); continue
        errs = []
        for k in ['id', 'type', 'topic', 'file', 'diff', 'why', 'ev']:
            if k not in o: errs.append('missing ' + k)
        if errs: bad.append((n, o.get('id'), errs)); continue
        if not re.fullmatch(r'[a-z][a-z0-9_]{1,23}', o['id']): errs.append('id format')
        if o['id'] in ids: errs.append('dup id')
        ids.add(o['id'])
        if o['topic'] not in TOPICS: errs.append('topic')
        if o['file'] not in files: errs.append('file unknown')
        if o['diff'] not in (1, 2, 3): errs.append('diff')
        if len(o['why']) > 220: errs.append('why too long')
        t = o['type']
        if t == 'mcq' or t == 'fill':
            if 'q' not in o: errs.append('missing q')
            elif len(o['q']) > 160: errs.append('q too long')
            if t == 'mcq' and 'q' in o and not o['q'].rstrip().endswith('?'): errs.append('q no ?')
            if t == 'fill' and 'q' in o and '____' not in o['q']: errs.append('fill no blank')
            a = o.get('a')
            if not (isinstance(a, list) and len(a) == 4): errs.append('a not 4')
            else:
                if len(set(x.strip().lower() for x in a)) < 4: errs.append('dup options')
                if any(len(x) > (90 if t == 'mcq' else 60) for x in a): errs.append('option too long')
                if any(re.search(r'all of the above|none of the above|both ', x, re.I) for x in a): errs.append('all/none')
                if t == 'fill' and norm(a[0]) not in norm(o['ev']): errs.append('fill answer not in ev')
        elif t == 'source':
            if 'q' not in o: errs.append('missing q')
            elif len(o['q']) > 230: errs.append('q too long')
            a = o.get('a')
            if not (isinstance(a, list) and len(a) == 4): errs.append('a not 4')
            elif len(set(a)) < 4: errs.append('dup options')
            if norm(o.get('q', '')) != norm(o['ev']): errs.append('source q != ev')
        elif t == 'noise':
            if 's' not in o: errs.append('missing s')
            elif len(o['s']) > 150: errs.append('s too long')
            if not isinstance(o.get('truth'), bool): errs.append('truth not bool')
        elif t == 'order':
            st = o.get('steps')
            if 'q' not in o: errs.append('missing q')
            elif len(o['q']) > 140: errs.append('q too long')
            if not (isinstance(st, list) and 4 <= len(st) <= 5): errs.append('steps not 4..5')
            elif any(len(x) > 70 for x in st): errs.append('step too long')
            elif len(set(x.strip().lower() for x in st)) < len(st): errs.append('dup steps')
        else: errs.append('type')
        if 'context' in o: errs.extend([] if dash_ok(o['context']) and len(o['context']) <= 220 else ['context'])
        for k, v in texts(o):
            if not isinstance(v, str): errs.append('non string ' + k); continue
            if t != 'source' and not dash_ok(v): errs.append('dash in ' + k + ': ' + v[:50])
        ev = norm(o['ev']); wc = len(ev.split())
        lim = 70 if t == 'order' else 45
        if wc < 6 or wc > lim: errs.append(f'ev words {wc}')
        if o['file'] in files and ev not in files[o['file']]: errs.append('ev not found verbatim')
        if errs: bad.append((n, o['id'], errs))
        else: good.append(o)
    return good, bad
if __name__ == '__main__':
    ids = set(); tot_good, tot_bad = [], []
    for p in sys.argv[1:]:
        g, b = check(p, ids); tot_good += g; tot_bad += b
        print(f'{os.path.basename(p)}: {len(g)} ok, {len(b)} bad')
        for x in b: print('   ', x)
    from collections import Counter
    print('TOTAL ok', len(tot_good), 'bad', len(tot_bad))
    print('types', Counter(o['type'] for o in tot_good))
    print('topics', Counter(o['topic'] for o in tot_good))
    print('diff', Counter(o['diff'] for o in tot_good))
    print('noise truth', Counter(o.get('truth') for o in tot_good if o['type'] == 'noise'))
