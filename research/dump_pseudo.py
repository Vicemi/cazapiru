import glob, os, sys, re, collections
sys.path.insert(0, 'E:/Vicemi/Proyectos/CazaPira/tools')
import luaq, luapseudo
D = 'F:/Games/Cazaproblemas/data/'
out = []
calls = collections.Counter()
for f in sorted(glob.glob(D + '**/*.lua', recursive=True)):
    b = open(f, 'rb').read()
    if b[:4] != b'\x1bLua':
        continue
    txt = '\n'.join(luapseudo.proto_text(luaq.parse(b)))
    out.append('#### ' + f.replace(D, '').replace('\\', '/'))
    out.append(txt)
    for m in re.findall(r"(\w+(?:\.\w+)*:\w+)\(", txt):
        calls[m] += 1
    for m in re.findall(r"\b(player|map|get_entity\('[\w]+'\))\.(\w+)", txt):
        calls['.'.join(m) if m[0] != 'player' else 'player.' + m[1]] += 1
open('E:/Vicemi/Proyectos/CazaPira/research/scripts_pseudo.txt', 'w', encoding='utf-8').write('\n'.join(out))
for k, v in calls.most_common(80):
    print(v, k)
