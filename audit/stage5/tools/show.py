"""show.py DUMP SHEET_PREFIX [formulas] -> rows of a sheet, ASCII-transliterated Turkish."""
import sys, io, re, collections
tr = str.maketrans({'ı':'i','İ':'I','ş':'s','Ş':'S','ğ':'g','Ğ':'G','ü':'u','Ü':'U','ö':'o','Ö':'O','ç':'c','Ç':'C','²':'2','³':'3','₂':'2','–':'-','—':'-','×':'x','→':'->','≤':'<=','≥':'>=','°':'deg'})
A = lambda s: s.translate(tr).encode('ascii','replace').decode()
dump, prefix = sys.argv[1], sys.argv[2]; show_f = len(sys.argv) > 3
rows = collections.defaultdict(list)
for line in io.open(dump, encoding='utf-8'):
    k, v, f = (line.rstrip('\n').split('\t') + ['', ''])[:3]
    sh, addr = k.rsplit('!', 1)
    if not A(sh).startswith(prefix): continue
    m = re.match(r'([A-Z]+)(\d+)', addr)
    v = v.strip("'\"") if v.startswith(("'", '"')) else v
    rows[int(m.group(2))].append((m.group(1), v, f))
for r in sorted(rows):
    cells = []
    for col, v, f in rows[r]:
        s = f'{col}={A(v)[:46]}'
        if show_f and f: s += f' {{{A(f)[:60]}}}'
        cells.append(s)
    print(f'R{r}: ' + ' | '.join(cells))
