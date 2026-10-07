"""TMX (Tiled, CSV layers) reader/renderer for the Cazaproblemas maps.

usage: python tools/tmx.py <map.tmx> <out.png> [--collisions]
As a module: load(path) -> dict(width,height,tw,th,tilesets=[(firstgid,name,image,cols,count)],layers=[(name,visible,[gid...])],objects=[...])
"""
import os
import sys
import xml.etree.ElementTree as ET

from PIL import Image


def load(path):
    root = ET.parse(path).getroot()
    base = os.path.dirname(path)
    m = {'width': int(root.get('width')), 'height': int(root.get('height')), 'tw': int(root.get('tilewidth')), 'th': int(root.get('tileheight')),
         'tilesets': [], 'layers': [], 'groups': [], 'tileprops': {}}
    for ts in root.findall('tileset'):
        im = ts.find('image')
        w = int(im.get('width'))
        first = int(ts.get('firstgid'))
        m['tilesets'].append({'first': first, 'name': ts.get('name'), 'image': os.path.normpath(os.path.join(base, im.get('source'))),
                              'cols': w // m['tw'], 'w': w, 'h': int(im.get('height'))})
        for t in ts.findall('tile'):
            props = {p.get('name'): p.get('value') for p in t.findall('properties/property')}
            if props:
                m['tileprops'][first + int(t.get('id'))] = props
    for ly in root.findall('layer'):
        vals = [int(v) for v in ly.find('data').text.replace('\n', '').split(',') if v.strip() != '']
        props = {p.get('name'): p.get('value') for p in ly.findall('properties/property')}
        m['layers'].append({'name': ly.get('name'), 'visible': ly.get('visible') != '0', 'data': vals, 'props': props, 'opacity': float(ly.get('opacity') or 1)})
    for og in root.findall('objectgroup'):
        objs = []
        for o in og.findall('object'):
            props = {p.get('name'): p.get('value') for p in o.findall('properties/property')}
            poly = o.find('polygon')
            if poly is None:
                poly = o.find('polyline')
            pts = [[float(v) for v in pt.split(',')] for pt in poly.get('points').split()] if poly is not None else None
            d = {'name': o.get('name'), 'type': o.get('type'), 'x': float(o.get('x')), 'y': float(o.get('y')),
                 'w': float(o.get('width') or 0), 'h': float(o.get('height') or 0), 'props': props}
            if pts:
                d['pts'] = pts
            objs.append(d)
        m['groups'].append({'name': og.get('name'), 'visible': og.get('visible') != '0', 'objects': objs})
    return m


def render(m, collisions=False):
    tw, th = m['tw'], m['th']
    out = Image.new('RGBA', (m['width'] * tw, m['height'] * th), (30, 30, 40, 255))
    sheets = {}
    for ts in m['tilesets']:
        sheets[ts['first']] = Image.open(ts['image']).convert('RGBA')
    firsts = sorted(sheets, reverse=True)
    for ly in m['layers']:
        if ly['name'] == 'collisions' and not collisions:
            continue
        if not ly['visible'] and ly['name'] != 'collisions':
            continue
        for i, g in enumerate(ly['data']):
            if g == 0:
                continue
            g &= 0x0fffffff
            first = next(f for f in firsts if f <= g)
            ts = next(t for t in m['tilesets'] if t['first'] == first)
            k = g - first
            sx, sy = (k % ts['cols']) * tw, (k // ts['cols']) * th
            tile = sheets[first].crop((sx, sy, sx + tw, sy + th))
            out.alpha_composite(tile, ((i % m['width']) * tw, (i // m['width']) * th + int(m['tileprops'].get(g, {}).get('y', 0)) * 0))
    return out


if __name__ == '__main__':
    m = load(sys.argv[1])
    print({k: v for k, v in m.items() if k in ('width', 'height')}, [(l['name'], l['visible']) for l in m['layers']], [(g['name'], len(g['objects'])) for g in m['groups']])
    render(m, '--collisions' in sys.argv).save(sys.argv[2])
