"""Cazaproblemas data -> public/assets/caza/ (web layout).

  * every file of data/ is copied as it is (images, ogg, ttf/otf, compiled Lua scripts) except the TMX maps and the .enc puzzle bank
  * data/maps/*.tmx  -> maps/<id>.map.json (CSV layers as arrays, tilesets, tile properties, object/waypoint groups)
  * every .xml       -> <same path>.json (generic tree {t: tag, a: attrs, c: children, x: text})
  * puzzles.enc is decrypted by tools/decrypt_puzzles.py into puzzles/puzzles.json

usage: python tools/build_caza.py [path to Cazaproblemas/data]
"""
import json
import os
import shutil
import sys
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tmx

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = sys.argv[1] if len(sys.argv) > 1 else 'F:/Games/Cazaproblemas/data'
OUT = os.path.join(ROOT, 'public', 'assets', 'caza')
SKIP_EXT = {'.tmx', '.enc', '.xml~'}


def xml_tree(el):
    d = {'t': el.tag}
    if el.attrib:
        d['a'] = dict(el.attrib)
    kids = [xml_tree(c) for c in el]
    if kids:
        d['c'] = kids
    txt = (el.text or '').strip()
    if txt:
        d['x'] = txt
    return d


def parse_xml(path):
    raw = open(path, 'rb').read()
    try:
        text = raw.decode('utf-8')
    except UnicodeDecodeError:
        text = raw.decode('cp1252', errors='replace')
    text = text.lstrip('\ufeff')
    if text.lstrip().startswith('<?xml'):
        text = text[text.index('?>') + 2:]
    return ET.fromstring(text)


def convert_map(path):
    m = tmx.load(path)
    return {'w': m['width'], 'h': m['height'], 'tw': m['tw'], 'th': m['th'],
            'tilesets': [{'first': t['first'], 'name': t['name'], 'image': os.path.basename(t['image']), 'cols': t['cols']} for t in m['tilesets']],
            'tileprops': {str(k): v for k, v in m['tileprops'].items()},
            'layers': [{'name': l['name'], 'layer': int(l['props']['layer']) if l['props'].get('layer') is not None else None, 'data': l['data']}
                       for l in m['layers']],
            'groups': {g['name']: [{k: o[k] for k in ('name', 'type', 'x', 'y', 'w', 'h', 'props', 'pts') if k in o} for o in g['objects']] for g in m['groups']}}


def main():
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    n = 0
    for base, _dirs, files in os.walk(SRC):
        for f in files:
            src = os.path.join(base, f)
            rel = os.path.relpath(src, SRC).replace(os.sep, '/')
            ext = os.path.splitext(f)[1].lower()
            if ' ' in f or '(' in f:        # editor leftovers ("(Copia conflictiva ...)")
                continue
            dst = os.path.join(OUT, rel)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            if ext == '.tmx':
                json.dump(convert_map(src), open(os.path.join(OUT, rel[:-4] + '.map.json'), 'w'), separators=(',', ':'))
            elif ext == '.xml':
                json.dump(xml_tree(parse_xml(src)), open(dst + '.json', 'w', encoding='utf-8'), separators=(',', ':'), ensure_ascii=False)
            elif ext in SKIP_EXT:
                continue
            else:
                shutil.copy2(src, dst)
            n += 1
    # the decrypted puzzle bank (tools/decrypt_puzzles.py -> research/puzzles.xml) is part of this build
    import build_puzzles
    if os.path.exists(build_puzzles.SRC):
        build_puzzles.main()
    # manifest of everything shipped (the engine resolves optional images through it)
    listing = []
    for base, _d, files in os.walk(OUT):
        for f in files:
            listing.append(os.path.relpath(os.path.join(base, f), OUT).replace(os.sep, '/'))
    json.dump(sorted(listing), open(os.path.join(OUT, 'manifest.json'), 'w'), separators=(',', ':'))
    print('files', n, '->', OUT)


if __name__ == '__main__':
    main()
