import csv, sys, re
rows = list(csv.reader(open(sys.argv[1], encoding='utf-8')))
pats = [re.compile(p, re.I) for p in sys.argv[2:]]
for r in rows[1:]:
    line = ' | '.join(r[1:])
    if all(p.search(line) for p in pats): print(r[0], '|', ' | '.join(x for x in r[2:] if x))
