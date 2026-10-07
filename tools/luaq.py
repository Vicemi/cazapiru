"""Minimal Lua 5.1 bytecode (LuaQ) reader: header, constants, protos and a readable opcode listing.

usage: python tools/luaq.py <file.lua> [--dis]      (plain-text .lua files are echoed as they are)
As a module: parse(bytes) -> Proto; Proto.consts / .code / .protos / .source.
Used to read the data scripts of Cazaproblemas (dialogs, triggers, tiers) without a decompiler.
"""
import struct
import sys

OPS = ['MOVE', 'LOADK', 'LOADBOOL', 'LOADNIL', 'GETUPVAL', 'GETGLOBAL', 'GETTABLE', 'SETGLOBAL', 'SETUPVAL', 'SETTABLE', 'NEWTABLE',
       'SELF', 'ADD', 'SUB', 'MUL', 'DIV', 'MOD', 'POW', 'UNM', 'NOT', 'LEN', 'CONCAT', 'JMP', 'EQ', 'LT', 'LE', 'TEST', 'TESTSET',
       'CALL', 'TAILCALL', 'RETURN', 'FORLOOP', 'FORPREP', 'TFORLOOP', 'SETLIST', 'CLOSE', 'CLOSURE', 'VARARG']
# iABC / iABx / iAsBx
ABX = {'LOADK', 'GETGLOBAL', 'SETGLOBAL', 'CLOSURE'}
ASBX = {'JMP', 'FORLOOP', 'FORPREP'}


class Proto:
    def __init__(self):
        self.source = ''
        self.consts = []
        self.code = []
        self.protos = []
        self.nparams = 0
        self.line = 0
        self.nups = 0


class R:
    def __init__(self, b):
        self.b, self.p = b, 0

    def u8(self):
        v = self.b[self.p]; self.p += 1; return v

    def u32(self):
        v = struct.unpack_from('<I', self.b, self.p)[0]; self.p += 4; return v

    def f64(self):
        v = struct.unpack_from('<d', self.b, self.p)[0]; self.p += 8; return v

    def string(self):
        n = self.u32()
        if n == 0:
            return None
        s = self.b[self.p:self.p + n - 1]; self.p += n
        return s.decode('latin-1')


def proto(r):
    p = Proto()
    p.source = r.string() or ''
    p.line = r.u32(); r.u32()
    p.nups = r.u8(); p.nparams = r.u8(); r.u8(); r.u8()
    p.code = [r.u32() for _ in range(r.u32())]
    for _ in range(r.u32()):
        t = r.u8()
        p.consts.append(None if t == 0 else bool(r.u8()) if t == 1 else r.f64() if t == 3 else r.string())
    p.protos = [proto(r) for _ in range(r.u32())]
    for _ in range(r.u32()): r.u32()               # line info
    for _ in range(r.u32()):                       # locals
        r.string(); r.u32(); r.u32()
    for _ in range(r.u32()): r.string()            # upvalue names
    return p


def parse(b):
    assert b[:4] == b'\x1bLua' and b[4] == 0x51, 'not Lua 5.1 bytecode'
    r = R(b)
    r.p = 12
    return proto(r)


def dis(p, indent=''):
    out = []
    for i, ins in enumerate(p.code):
        op = OPS[ins & 63]; a = (ins >> 6) & 255; c = (ins >> 14) & 511; bb = (ins >> 23) & 511
        if op in ABX:
            bx = (ins >> 14) & 0x3ffff
            arg = '%d %s' % (a, repr(p.consts[bx]) if op != 'CLOSURE' else 'proto%d' % bx) if op != 'CLOSURE' else '%d proto%d' % (a, bx)
        elif op in ASBX:
            arg = '%d %+d' % (a, ((ins >> 14) & 0x3ffff) - 131071)
        else:
            k = lambda x: ('K(%r)' % p.consts[x & 255]) if x >= 256 else 'R%d' % x
            arg = '%d %s %s' % (a, k(bb), k(c))
        out.append('%s%3d %-9s %s' % (indent, i, op, arg))
    for k, sub in enumerate(p.protos):
        out.append('%s-- proto%d (params %d)' % (indent, k, sub.nparams))
        out += dis(sub, indent + '    ')
    return out


def strings(p):
    out = [c for c in p.consts if isinstance(c, str)]
    for s in p.protos: out += strings(s)
    return out


if __name__ == '__main__':
    data = open(sys.argv[1], 'rb').read()
    if data[:4] != b'\x1bLua':
        sys.stdout.write(data.decode('latin-1'))
    else:
        pr = parse(data)
        print('\n'.join(dis(pr) if '--dis' in sys.argv else strings(pr)))
