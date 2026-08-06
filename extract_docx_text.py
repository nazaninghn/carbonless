import sys
import xml.etree.ElementTree as ET

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
NS = {'w': W.strip('{}')}

def para_text(p):
    texts = []
    for t in p.iter(W + 't'):
        if t.text:
            texts.append(t.text)
    return ''.join(texts)

def is_heading(p):
    pPr = p.find(W + 'pPr')
    if pPr is not None:
        pStyle = pPr.find(W + 'pStyle')
        if pStyle is not None:
            val = pStyle.get(W + 'val', '')
            if 'Heading' in val or 'Title' in val:
                return True
    return False

def render(container, out):
    for child in list(container):
        tag = child.tag.split('}')[-1]
        if tag == 'p':
            line = para_text(child)
            if is_heading(child) and line.strip():
                out.append('\n### ' + line)
            else:
                out.append(line)
        elif tag == 'tbl':
            out.append('\n[TABLE]')
            for row in child.findall(W + 'tr'):
                cells = []
                for cell in row.findall(W + 'tc'):
                    cell_lines = []
                    render(cell, cell_lines)
                    cells.append(' / '.join(x for x in cell_lines if x.strip()))
                out.append(' | '.join(cells))
            out.append('[/TABLE]\n')

def extract_body_text(path):
    tree = ET.parse(path)
    root = tree.getroot()
    body = root.find(W + 'body')
    out = []
    render(body, out)
    return '\n'.join(out)

if __name__ == '__main__':
    path = sys.argv[1]
    text = extract_body_text(path)
    out_path = sys.argv[2] if len(sys.argv) > 2 else None
    if out_path:
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(text)
        print(f'Wrote {len(text)} chars to {out_path}')
    else:
        print(text)
