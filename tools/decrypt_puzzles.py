"""Decrypt data/puzzles/puzzles.enc of Cazaproblemas (reverse engineered from Cazaproblemas.exe, encryption.cpp).

  _decrypt_data (0x44dce0): TEA, 32 rounds, delta 0x9e3779b9 (sum starts at 0xc6ef3720), key = 4 little-endian dwords at `_lala` (0x5d6554)
  _decryptBlock (0x44dbc7): n = len / 8 blocks decrypted in place; the plaintext length is the dword stored in the last 4 bytes
                            of the last block (offset n*8-4).

usage: python tools/decrypt_puzzles.py [puzzles.enc] [Cazaproblemas.exe] -> research/puzzles.xml (then tools/build_puzzles.py)
"""
import os
import struct
import sys

import pefile

ENC = sys.argv[1] if len(sys.argv) > 1 else 'F:/Games/Cazaproblemas/data/puzzles/puzzles.enc'
EXE = sys.argv[2] if len(sys.argv) > 2 else 'F:/Games/Cazaproblemas/Cazaproblemas.exe'
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'research', 'puzzles.xml')
M = 0xffffffff


def key_from_exe(path, va=0x5d6554):
    pe = pefile.PE(path, fast_load=True)
    rva = va - pe.OPTIONAL_HEADER.ImageBase
    return struct.unpack('<4I', pe.get_data(rva, 16))


def decrypt_block(v0, v1, k):
    s = 0xc6ef3720
    for _ in range(32):
        v1 = (v1 - ((((v0 << 4) + k[2]) ^ (v0 + s) ^ ((v0 >> 5) + k[3])) & M)) & M
        v0 = (v0 - ((((v1 << 4) + k[0]) ^ (v1 + s) ^ ((v1 >> 5) + k[1])) & M)) & M
        s = (s - 0x9e3779b9) & M
    return v0, v1


def main():
    k = key_from_exe(EXE)
    print('key', [hex(x) for x in k])
    d = bytearray(open(ENC, 'rb').read())
    n = len(d) // 8
    for i in range(n):
        v0, v1 = struct.unpack_from('<2I', d, i * 8)
        struct.pack_into('<2I', d, i * 8, *decrypt_block(v0, v1, k))
    length = struct.unpack_from('<I', d, n * 8 - 4)[0]
    print('blocks', n, 'plaintext length', length)
    text = bytes(d[:length])
    open(OUT, 'wb').write(text)
    print(text[:300])


if __name__ == '__main__':
    main()
