import re, subprocess, collections, sys
out = subprocess.run(['python', 'E:/Vicemi/Proyectos/CazaPira/tools/pe_syms.py', 'F:/Games/Cazaproblemas/Cazaproblemas.exe', 'grep', '_ZN2TC'], capture_output=True, text=True).stdout
cls = collections.defaultdict(set)
for l in out.splitlines():
    nm = l.split()[1]
    m = re.match(r'_+ZN2TC(\d+)', nm)
    if not m:
        continue
    n = int(m.group(1))
    rest = nm[m.end():]
    c = rest[:n]
    r2 = rest[n:]
    m2 = re.match(r'(\d+)', r2)
    meth = r2[len(m2.group(1)):len(m2.group(1)) + int(m2.group(1))] if m2 else r2[:20]
    cls[c].add(meth)
for c in sorted(cls):
    print(c, ':', ', '.join(sorted(cls[c]))[:400])
