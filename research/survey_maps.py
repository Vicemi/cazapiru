import glob, os, sys
sys.path.insert(0, 'E:/Vicemi/Proyectos/CazaPira/tools')
import tmx
D = 'F:/Games/Cazaproblemas/data/maps/'
for f in sorted(glob.glob(D + '*.tmx')):
    try:
        m = tmx.load(f)
    except Exception as e:
        print(os.path.basename(f), 'ERR', e)
        continue
    mx = max((max(l['data']) for l in m['layers']), default=0)
    print(os.path.basename(f), m['width'], 'x', m['height'], 'tile', m['tw'], 'maxgid', mx, 'sets', [t['name'] for t in m['tilesets']])
    print('   layers', [(l['name'], l['props'].get('layer'), int(l['visible'])) for l in m['layers']])
    print('   groups', [(g['name'], len(g['objects'])) for g in m['groups']])
