"""Readable pseudo-source of Lua 5.1 bytecode: symbolic register tracking, calls printed as expressions, conditions/jumps annotated.
Good enough to read the Cazaproblemas scripts (research tool).   usage: python tools/luapseudo.py <file.lua>"""
import sys

sys.path.insert(0, __file__.rsplit('\\', 1)[0].rsplit('/', 1)[0])
import luaq


def fmt(v):
    if isinstance(v, float):
        return str(int(v)) if v == int(v) else str(v)
    return repr(v) if isinstance(v, str) else str(v)


def proto_text(p, ind=''):
    R = {}
    out = []
    code = p.code
    K = p.consts
    n = len(code)
    pc = 0

    def rk(x):
        return fmt(K[x - 256]) if x >= 256 else R.get(x, 'R%d' % x)
    labels = {}
    while pc < n:
        ins = code[pc]
        op = luaq.OPS[ins & 63]; a = (ins >> 6) & 255; c = (ins >> 14) & 511; b = (ins >> 23) & 511; bx = (ins >> 14) & 0x3ffff
        sbx = bx - 131071
        pre = '%s%3d ' % (ind, pc)
        if op == 'GETGLOBAL': R[a] = K[bx]
        elif op == 'LOADK': R[a] = fmt(K[bx])
        elif op == 'LOADBOOL': R[a] = 'true' if b else 'false'
        elif op == 'LOADNIL':
            for r in range(a, b + 1): R[r] = 'nil'
        elif op == 'MOVE': R[a] = R.get(b, 'R%d' % b)
        elif op == 'GETUPVAL': R[a] = 'UP%d' % b
        elif op == 'GETTABLE':
            t = R.get(b, 'R%d' % b); k = K[c - 256] if c >= 256 else None
            R[a] = ('%s.%s' % (t, k)) if isinstance(k, str) and k.isidentifier() else '%s[%s]' % (t, rk(c))
        elif op == 'SELF':
            t = R.get(b, 'R%d' % b); k = K[c - 256]
            R[a + 1] = t; R[a] = '%s:%s' % (t, k)
        elif op == 'SETGLOBAL': out.append('%s%s = %s' % (pre, K[bx], R.get(a, 'R%d' % a)))
        elif op == 'SETTABLE': out.append('%s%s[%s] = %s' % (pre, R.get(a, 'R%d' % a), rk(b), rk(c)))
        elif op == 'SETUPVAL': out.append('%sUP%d = %s' % (pre, b, R.get(a, 'R%d' % a)))
        elif op == 'NEWTABLE': R[a] = '{}'
        elif op == 'SETLIST':
            nn = b
            out.append('%s%s = {%s}' % (pre, R.get(a, 'R%d' % a), ', '.join(R.get(a + i, 'R%d' % (a + i)) for i in range(1, nn + 1))))
        elif op in ('ADD', 'SUB', 'MUL', 'DIV', 'MOD', 'POW'):
            R[a] = '(%s %s %s)' % (rk(b), {'ADD': '+', 'SUB': '-', 'MUL': '*', 'DIV': '/', 'MOD': '%', 'POW': '^'}[op], rk(c))
        elif op == 'CONCAT': R[a] = ' .. '.join(R.get(i, 'R%d' % i) for i in range(b, c + 1))
        elif op == 'NOT': R[a] = 'not ' + R.get(b, 'R%d' % b)
        elif op == 'UNM': R[a] = '-' + R.get(b, 'R%d' % b)
        elif op == 'LEN': R[a] = '#' + R.get(b, 'R%d' % b)
        elif op in ('CALL', 'TAILCALL'):
            f = R.get(a, 'R%d' % a)
            nargs = b - 1 if b else 0
            args = [R.get(a + 1 + i, 'R%d' % (a + 1 + i)) for i in range(nargs)]
            if b == 0:
                args = ['...']
            expr = '%s(%s)' % (f, ', '.join(args))
            if c == 2:
                R[a] = expr
            elif c == 1 or c == 0:
                out.append('%s%s' % (pre, expr))
            else:
                for i in range(c - 1): R[a + i] = expr + '[%d]' % i
                out.append('%s-- %s' % (pre, expr))
        elif op == 'RETURN': out.append('%sreturn%s' % (pre, ' ' + ', '.join(R.get(a + i, 'R%d' % (a + i)) for i in range(b - 1)) if b > 1 else ''))
        elif op in ('EQ', 'LT', 'LE'):
            sym = {'EQ': '==', 'LT': '<', 'LE': '<='}[op]
            nxt = code[pc + 1]
            tgt = pc + 2 + (((nxt >> 14) & 0x3ffff) - 131071)
            out.append('%sif %s%s %s %s then (else goto %d)' % (pre, 'NOT ' if a else '', rk(b), sym, rk(c), tgt))
            pc += 1
        elif op == 'TEST':
            nxt = code[pc + 1]
            tgt = pc + 2 + (((nxt >> 14) & 0x3ffff) - 131071)
            out.append('%sif %s%s then (else goto %d)' % (pre, 'NOT ' if c else '', R.get(a, 'R%d' % a), tgt))
            pc += 1
        elif op == 'JMP': out.append('%sgoto %d' % (pre, pc + 1 + sbx))
        elif op == 'CLOSURE':
            sub = p.protos[bx]
            out.append('%sR%d = function#%d (upvals %d)' % (pre, a, bx, sub.nups))
            R[a] = 'function#%d' % bx
            pc += sub.nups
        elif op in ('FORPREP', 'FORLOOP', 'TFORLOOP'): out.append('%s%s %d %d' % (pre, op, a, sbx if op != 'TFORLOOP' else c))
        else: out.append('%s%s %d %d %d' % (pre, op, a, b, c))
        pc += 1
    for i, sub in enumerate(p.protos):
        out.append('%s-- function#%d' % (ind, i))
        out += proto_text(sub, ind + '    ')
    return out


if __name__ == '__main__':
    data = open(sys.argv[1], 'rb').read()
    if data[:4] != b'\x1bLua':
        sys.stdout.write(data.decode('latin-1'))
    else:
        print('\n'.join(proto_text(luaq.parse(data))))
