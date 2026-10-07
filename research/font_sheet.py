from PIL import Image, ImageDraw, ImageFont
import glob, os
D = 'F:/Games/Cazaproblemas/data/fonts/'
fs = sorted(glob.glob(D + '*.otf') + glob.glob(D + '*.ttf'))
img = Image.new('RGB', (1100, 38 * len(fs)), (40, 40, 60))
d = ImageDraw.Draw(img)
for i, f in enumerate(fs):
    try:
        font = ImageFont.truetype(f, 26)
        d.text((10, i * 38 + 2), os.path.basename(f), fill=(255, 200, 120), font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 14))
        d.text((200, i * 38), 'Cazaproblemas Piracálculos ¿Qué? 0123456789 áéñ', fill=(255, 255, 255), font=font)
    except Exception as e:
        d.text((200, i * 38), 'ERR ' + str(e), fill=(255, 0, 0))
img.save('E:/Vicemi/Proyectos/CazaPira/research/shots/fonts.png')
