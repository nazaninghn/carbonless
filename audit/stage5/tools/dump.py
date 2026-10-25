"""dump.py WORKBOOK OUT.txt  -> every non-empty cell: Sheet!Addr<TAB>value<TAB>=formula (if any). UTF-8."""
import sys, io, openpyxl, warnings
warnings.filterwarnings('ignore')
p, out = sys.argv[1], sys.argv[2]
wv = openpyxl.load_workbook(p, data_only=True)
wf = openpyxl.load_workbook(p, data_only=False)
f = io.open(out, 'w', encoding='utf-8')
for ws in wv.worksheets:
    wsf = wf[ws.title]
    for row in ws.iter_rows():
        for c in row:
            fv = wsf[c.coordinate].value
            isf = isinstance(fv, str) and fv.startswith('=')
            if c.value is None and not isf: continue
            f.write(f'{ws.title}!{c.coordinate}\t{c.value!r}\t{fv if isf else ""}\n')
print('ok', out)
