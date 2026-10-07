"""Piracalculos bitmap font (white_font_new*_SDL.png, magenta key) -> public/assets/pira/lang/images/font.json

The atlas is a 12-column grid of glyphs of variable width.  We segment it by projection (rows, then columns inside a row) and
assign characters in reading order using the layout read off the atlas.
"""
import json
import os
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'public', 'assets', 'pira', 'lang', 'images', 'white_font_new_SDL.png')
OUT = os.path.join(ROOT, 'public', 'assets', 'pira', 'lang', 'images', 'font.json')

ROWS = [
    'ABCDEFGHIJKL',
    'MNOPQRSTUVWX',
    'YZabcdefghij',
    'klmnopqrstuv',
    'wxyz01234567',
    '89();,.:+-&☠',
    "'!/?% ÀÁÄÇÉÑ",
    'ÓÚÜßàáâäçèéê',
    'ìîïñóôöùúûü-',
    '\'""„…¡¿$"_',
    'Í',
    'í[]',
]


GAP = int(os.environ.get('GAP', '2'))


def main():
    im = Image.open(SRC).convert('RGB')
    w, h = im.size
    px = im.load()

    def solid(x, y):
        r, g, b = px[x, y]
        return not (r > 250 and g < 6 and b > 250)

    rowhas = [any(solid(x, y) for x in range(w)) for y in range(h)]
    bands, y = [], 0
    while y < h:
        if rowhas[y]:
            y0 = y
            while y < h and rowhas[y]:
                y += 1
            bands.append((y0, y))
        else:
            y += 1
    merged_b = []
    for b in bands:
        if merged_b and b[0] - merged_b[-1][1] <= 8:
            merged_b[-1] = (merged_b[-1][0], b[1])
        else:
            merged_b.append(b)
    bands = merged_b
    print('bands', len(bands), bands)
    glyphs = {}
    for bi, (y0, y1) in enumerate(bands):
        cols = [any(solid(x, y) for y in range(y0, y1)) for x in range(w)]
        segs, x = [], 0
        while x < w:
            if cols[x]:
                x0 = x
                while x < w and cols[x]:
                    x += 1
                segs.append((x0, x))
            else:
                x += 1
        merged = []
        for sg in segs:
            if merged and sg[0] - merged[-1][1] <= GAP:
                merged[-1] = (merged[-1][0], sg[1])
            else:
                merged.append(sg)
        segs = merged
        expect = len([c for c in ROWS[bi] if c != ' ']) if bi < len(ROWS) else 0
        print(bi, len(segs), expect)
        if bi >= len(ROWS):
            continue
        chars = [c for c in ROWS[bi] if c != ' ']
        # bottom of each glyph's own pixels: the most common value is the row baseline (descenders go lower)
        bottoms = []
        for (x0, x1) in segs:
            yb = max((yy for yy in range(y0, y1) if any(solid(xx, yy) for xx in range(x0, x1))), default=y1 - 1) + 1
            bottoms.append(yb)
        base = max(set(bottoms), key=bottoms.count)
        for c, (x0, x1) in zip(chars, segs):
            glyphs[c] = [x0, y0, x1 - x0, y1 - y0, base - y0]
    out = {'glyphs': glyphs, 'baseline': max(g[1] + g[3] for g in (glyphs[c] for c in 'ABCDEFGHI')) if glyphs else 0,
           'capH': glyphs['A'][3]}
    json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False)
    print('glyphs', len(glyphs))


if __name__ == '__main__':
    sys.exit(main())
