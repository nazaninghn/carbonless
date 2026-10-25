import sys, io
from pypdf import PdfReader
out = io.open(sys.argv[2], 'w', encoding='utf-8')
r = PdfReader(sys.argv[1]); out.write(f'pages {len(r.pages)}\n')
for i, p in enumerate(r.pages): out.write(f'--- page {i+1}\n{p.extract_text()}\n')
