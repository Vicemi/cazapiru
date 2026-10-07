"""Piracalculos assets -> public/assets/pira/.

The original ships its 1200x900 pictures inside 2048x1024 power-of-two canvases padded with magenta: those JPGs are cropped to
1200x900 here. Sprites keep their magenta color key (the engine keys it at load time, see core/assets.ts).

usage: python tools/build_pira.py [path to Piracalculos.activity/assets]
"""
import os
import shutil
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = sys.argv[1] if len(sys.argv) > 1 else 'F:/Games/Piracalculos/piracalculos/Piracalculos.activity/assets'
OUT = os.path.join(ROOT, 'public', 'assets', 'pira')


def main():
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    n = cropped = 0
    for base, _d, files in os.walk(SRC):
        for f in files:
            src = os.path.join(base, f)
            rel = os.path.relpath(src, SRC).replace(os.sep, '/')
            dst = os.path.join(OUT, rel)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            if f.lower().endswith('.jpg'):
                im = Image.open(src)
                if im.size == (2048, 1024):
                    im.crop((0, 0, 1200, 900)).save(dst, quality=92)
                    cropped += 1
                    n += 1
                    continue
            shutil.copy2(src, dst)
            n += 1
    print('files', n, 'cropped', cropped, '->', OUT)


if __name__ == '__main__':
    main()
