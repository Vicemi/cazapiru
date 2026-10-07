from PIL import Image
import glob, collections, os
R = 'F:/Games/Piracalculos/piracalculos/Piracalculos.activity/assets/images/'
modes = collections.Counter()
for f in glob.glob(R + '**/*.*', recursive=True):
    if not f.lower().endswith(('png', 'jpg')):
        continue
    im = Image.open(f)
    modes[(im.mode, os.path.relpath(f, R).replace(os.sep, '/').split('/')[0])] += 1
for k, v in sorted(modes.items()):
    print(k, v)
im = Image.open(R + 'characters/Pi/Pi_Caminar_01.png')
print(im.mode, im.size, im.getpixel((0, 0)))
