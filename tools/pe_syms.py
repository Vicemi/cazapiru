"""List / disassemble symbols of a MinGW PE (COFF symbol table) - used to read the puzzle-bank decryption of Cazaproblemas.exe.

usage: python tools/pe_syms.py <exe> grep <substring>
       python tools/pe_syms.py <exe> dis <symbol> [bytes]
"""
import struct
import sys

import pefile
from capstone import CS_ARCH_X86, CS_MODE_32, Cs

exe = sys.argv[1]
pe = pefile.PE(exe, fast_load=True)
data = open(exe, 'rb').read()
ptr, n = pe.FILE_HEADER.PointerToSymbolTable, pe.FILE_HEADER.NumberOfSymbols
strtab = ptr + n * 18
base = pe.OPTIONAL_HEADER.ImageBase
sections = pe.sections


def name_at(off):
    end = data.index(b'\0', strtab + off)
    return data[strtab + off:end].decode('latin-1')


syms = []
i = 0
while i < n:
    e = data[ptr + i * 18: ptr + i * 18 + 18]
    if e[:4] == b'\0\0\0\0':
        nm = name_at(struct.unpack('<I', e[4:8])[0])
    else:
        nm = e[:8].rstrip(b'\0').decode('latin-1')
    value, sec, typ, cls, aux = struct.unpack('<IhHBB', e[8:18])
    if sec > 0:
        s = sections[sec - 1]
        syms.append((base + s.VirtualAddress + value, nm))
    i += 1 + aux
syms.sort()


def va_to_off(va):
    for s in sections:
        a = base + s.VirtualAddress
        if a <= va < a + s.Misc_VirtualSize:
            return s.PointerToRawData + (va - a)
    return None


if sys.argv[2] == 'grep':
    for va, nm in syms:
        if sys.argv[3].lower() in nm.lower():
            print(hex(va), nm)
elif sys.argv[2] == 'dis':
    target = [(va, nm) for va, nm in syms if nm == sys.argv[3]]
    if not target:
        target = [(va, nm) for va, nm in syms if sys.argv[3] in nm]
    va, nm = target[0]
    nxt = next((v for v, _ in syms if v > va), va + 512)
    size = min(int(sys.argv[4]) if len(sys.argv) > 4 else nxt - va, 4096)
    off = va_to_off(va)
    md = Cs(CS_ARCH_X86, CS_MODE_32)
    print(nm, hex(va), 'size', size)
    sym_at = {v: k for v, k in syms}
    for ins in md.disasm(data[off:off + size], va):
        op = ins.op_str
        for tok in op.replace('[', ' ').replace(']', ' ').replace(',', ' ').split():
            if tok.startswith('0x'):
                try:
                    v = int(tok, 16)
                    if v in sym_at:
                        op += '   ; ' + sym_at[v]
                except ValueError:
                    pass
        print('%08x  %-6s %s' % (ins.address, ins.mnemonic, op))
