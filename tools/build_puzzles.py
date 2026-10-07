"""research/puzzles.xml (decrypted by tools/decrypt_puzzles.py) -> public/assets/caza/puzzles/puzzles.json

Each exercise: {id, points, clues:[a,b,c], body: layout tree, answers: [{name: value}]}
Layout nodes: {k:'row'|'column', w|h:number (percent), c:[...]} and leaves
  {k:'label', text, size, vcentered}, {k:'image', src}, {k:'mc', src, n, name}, {k:'text', name, w, x, y}, {k:'sudoku'}
"""
import json
import os
import re
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'research', 'puzzles.xml')
OUT = os.path.join(ROOT, 'public', 'assets', 'caza', 'puzzles', 'puzzles.json')


def node(el):
    t = el.tag
    a = el.attrib
    if t in ('row', 'column', 'body'):
        d = {'k': 'row' if t == 'row' else 'col' if t == 'column' else 'body'}
        if 'height' in a:
            d['h'] = float(a['height'])
        if 'width' in a:
            d['w'] = float(a['width'])
        d['c'] = [node(c) for c in el]
        return d
    if t == 'label':
        d = {'k': 'label', 'text': ' '.join((el.text or '').split()), 'size': int(a.get('font_size', 16))}
        if a.get('vcentered') == 'false':
            d['top'] = True
        return d
    if t == 'image':
        return {'k': 'image', 'src': a['image'].replace('data/puzzles/', '')}
    if t == 'multiplechoice':
        return {'k': 'mc', 'src': a['image'].replace('data/puzzles/', ''), 'n': int(a['number']), 'name': a['name']}
    if t == 'text':
        return {'k': 'text', 'name': a['name'], 'w': int(a.get('width', 20)), 'x': int(a.get('x', 0)), 'y': int(a.get('y', 0))}
    if t == 'randomsudoku':
        return {'k': 'sudoku'}
    return {'k': t, 'a': dict(a)}


def main():
    text = open(SRC, 'rb').read().decode('cp1252', errors='replace')
    text = re.sub(r'&(?!(?:amp|lt|gt|quot|apos|#\d+);)', '&amp;', text)   # pugixml tolerated bare ampersands
    root = ET.fromstring(text)
    out = []
    for ex in root.findall('exercise'):
        clues = ex.find('clues')
        out.append({
            'id': int(ex.get('id')), 'points': int(ex.get('points', 0)),
            'clues': [' '.join((clues.find(k).text or '').split()) if clues is not None and clues.find(k) is not None else '' for k in 'abc'],
            'body': node(ex.find('body')),
            'answers': [{v.get('name'): (v.text or '').strip() for v in an.findall('value')} for an in ex.find('answers').findall('answer')],
        })
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(len(out), 'exercises ->', OUT)


if __name__ == '__main__':
    main()
