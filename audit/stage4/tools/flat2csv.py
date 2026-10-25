import csv, sys, openpyxl
wb = openpyxl.load_workbook(sys.argv[1], read_only=True, data_only=True)
ws = wb['Factors by Category']
out = csv.writer(open(sys.argv[2], 'w', newline='', encoding='utf-8'))
n = 0
for i, r in enumerate(ws.iter_rows(values_only=True)):
    if i < 5 or not any(r): continue
    out.writerow([('' if v is None else v) for v in r[:10]]); n += 1
print('rows', n)
