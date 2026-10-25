"""dump_sel.py WORKBOOK OUT SHEETPREFIX... : values+formulas of selected sheets (read-only streaming)."""
import sys, io, openpyxl, warnings
warnings.filterwarnings('ignore')
p, out, prefixes = sys.argv[1], sys.argv[2], sys.argv[3:]
import unicodedata
norm = lambda s: unicodedata.normalize('NFKD', s).encode('ascii','ignore').decode()
wv = openpyxl.load_workbook(p, read_only=True, data_only=True)
wf = openpyxl.load_workbook(p, read_only=True, data_only=False)
f = io.open(out, 'w', encoding='utf-8')
for ws in wv.worksheets:
    if not any(norm(ws.title).startswith(norm(x)) for x in prefixes): continue
    frows = list(wf[ws.title].iter_rows(values_only=True))
    for r, row in enumerate(ws.iter_rows(values_only=True), start=1):
        frow = frows[r-1] if r-1 < len(frows) else ()
        for c, v in enumerate(row, start=1):
            fv = frow[c-1] if c-1 < len(frow) else None
            isf = isinstance(fv, str) and fv.startswith('=')
            if v is None and not isf: continue
            col = openpyxl.utils.get_column_letter(c)
            f.write(f'{ws.title}!{col}{r}\t{v!r}\t{fv if isf else ""}\n')
print('ok')
