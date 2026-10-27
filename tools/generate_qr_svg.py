"""
Standalone QR Code Generator in pure Python (creates standard ISO/IEC 18004 QR codes)
Produces clean SVG files for any text/URL.
"""
import sys

# GF(256) Math
GF_EXP = [0] * 512
GF_LOG = [0] * 256
x = 1
for i in range(255):
    GF_EXP[i] = x
    GF_LOG[x] = i
    x <<= 1
    if x & 0x100:
        x ^= 0x11d
for i in range(255, 512):
    GF_EXP[i] = GF_EXP[i - 255]

def gf_mul(x, y):
    if x == 0 or y == 0:
        return 0
    return GF_EXP[GF_LOG[x] + GF_LOG[y]]

def rs_generator_poly(nsym):
    g = [1]
    for i in range(nsym):
        root = GF_EXP[i]
        next_g = [0] * (len(g) + 1)
        for j in range(len(g)):
            next_g[j] ^= gf_mul(g[j], root)
            next_g[j + 1] ^= g[j]
        g = next_g
    return g

def rs_encode(msg, nsym):
    gen = rs_generator_poly(nsym)
    res = list(msg) + [0] * nsym
    for i in range(len(msg)):
        coef = res[i]
        if coef != 0:
            for j in range(len(gen)):
                res[i + j] ^= gf_mul(gen[j], coef)
    return res[len(msg):]

# Version table: Version -> (size, total_codewords, ec_codewords_M, ec_blocks_M)
# Version 3-M: size 29, total codewords 70, ec codewords 26 (1 block), data codewords 44
# Version 4-M: size 33, total codewords 100, ec codewords 36 (2 blocks of 18), data codewords 64 (2 blocks of 32)
# Version 4-L: size 33, total codewords 100, ec codewords 20 (1 block of 20), data codewords 80
# Alignment pattern coordinates:
ALIGNMENT_COORDS = {
    1: [],
    2: [6, 18],
    3: [6, 22],
    4: [6, 26],
    5: [6, 30],
    6: [6, 34],
}

def create_qr_matrix(text, version=3, ecl='M'):
    # For version 3-M:
    # Total codewords = 70. EC codewords = 26. Data codewords = 44.
    size = 17 + 4 * version
    matrix = [[None for _ in range(size)] for _ in range(size)]
    is_function = [[False for _ in range(size)] for _ in range(size)]

    def set_fn(r, c, val):
        matrix[r][c] = val
        is_function[r][c] = True

    # 1. Finder patterns (7x7) + separators (8x8)
    def place_finder(top, left):
        for r in range(-1, 8):
            for c in range(-1, 8):
                row = top + r
                col = left + c
                if 0 <= row < size and 0 <= col < size:
                    is_function[row][col] = True
                    if 0 <= r <= 6 and 0 <= c <= 6:
                        if r in (0, 6) or c in (0, 6) or (2 <= r <= 4 and 2 <= c <= 4):
                            matrix[row][col] = 1
                        else:
                            matrix[row][col] = 0
                    else:
                        matrix[row][col] = 0

    place_finder(0, 0)
    place_finder(0, size - 7)
    place_finder(size - 7, 0)

    # 2. Timing patterns
    for i in range(8, size - 8):
        set_fn(6, i, 1 if i % 2 == 0 else 0)
        set_fn(i, 6, 1 if i % 2 == 0 else 0)

    # 3. Alignment patterns
    coords = ALIGNMENT_COORDS.get(version, [])
    for r in coords:
        for c in coords:
            # Skip if overlaps finder pattern
            if (r < 9 and c < 9) or (r < 9 and c >= size - 9) or (r >= size - 9 and c < 9):
                continue
            for dr in range(-2, 3):
                for dc in range(-2, 3):
                    val = 1 if max(abs(dr), abs(dc)) in (0, 2) else 0
                    set_fn(r + dr, c + dc, val)

    # 4. Dark module
    set_fn(4 * version + 9, 8, 1)

    # 5. Format info placeholders
    for i in range(9):
        if matrix[8][i] is None:
            set_fn(8, i, 0)
        if matrix[i][8] is None:
            set_fn(i, 8, 0)
    for i in range(8):
        set_fn(8, size - 1 - i, 0)
        set_fn(size - 1 - i, 8, 0)

    # Encode Data
    # Mode indicator: Byte mode = 0100 (4 bits)
    # Character count indicator: 8 bits for version 1-9
    raw_bytes = text.encode('utf-8')
    data_bits = []
    # 0100
    data_bits.extend([0, 1, 0, 0])
    # Char count (8 bits)
    count = len(raw_bytes)
    for b in range(7, -1, -1):
        data_bits.append((count >> b) & 1)
    # Data bytes
    for byte in raw_bytes:
        for b in range(7, -1, -1):
            data_bits.append((byte >> b) & 1)

    # Capacity in bits:
    if version == 3 and ecl == 'M':
        data_cap_bytes = 44
        ec_bytes = 26
        num_blocks = 1
    elif version == 4 and ecl == 'M':
        data_cap_bytes = 64
        ec_bytes = 36 # 2 blocks of 18 EC, 32 data each
        num_blocks = 2
    else:
        raise ValueError(f"Version {version}-{ecl} not specifically mapped in generator")

    data_cap_bits = data_cap_bytes * 8
    # Terminator (up to 4 zeroes)
    needed = min(4, data_cap_bits - len(data_bits))
    data_bits.extend([0] * needed)

    # Pad to byte boundary
    while len(data_bits) % 8 != 0:
        data_bits.append(0)

    # Pad bytes 0xEC, 0x11
    pad_bytes = [0xEC, 0x11]
    pad_idx = 0
    while len(data_bits) < data_cap_bits:
        b = pad_bytes[pad_idx % 2]
        pad_idx += 1
        for i in range(7, -1, -1):
            data_bits.append((b >> i) & 1)

    # Convert to data codewords
    data_codewords = []
    for i in range(0, len(data_bits), 8):
        byte_val = 0
        for bit in data_bits[i:i+8]:
            byte_val = (byte_val << 1) | bit
        data_codewords.append(byte_val)

    # Compute EC codewords
    if num_blocks == 1:
        ec_codewords = rs_encode(data_codewords, ec_bytes)
        final_codewords = data_codewords + ec_codewords
    else:
        # 2 blocks
        b1_data = data_codewords[:len(data_codewords)//2]
        b2_data = data_codewords[len(data_codewords)//2:]
        b1_ec = rs_encode(b1_data, ec_bytes // 2)
        b2_ec = rs_encode(b2_data, ec_bytes // 2)
        # Interleave
        final_codewords = []
        for i in range(len(b1_data)):
            final_codewords.append(b1_data[i])
            final_codewords.append(b2_data[i])
        for i in range(len(b1_ec)):
            final_codewords.append(b1_ec[i])
            final_codewords.append(b2_ec[i])

    # Convert final codewords to bits
    all_bits = []
    for byte in final_codewords:
        for b in range(7, -1, -1):
            all_bits.append((byte >> b) & 1)

    # Remainder bits (for version 3 it is 0, for version 4 it is 0)
    # Place data in zig-zag
    bit_idx = 0
    col = size - 1
    going_up = True
    while col > 0:
        if col == 6:
            col -= 1 # Skip vertical timing column
        rows = range(size - 1, -1, -1) if going_up else range(size)
        for r in rows:
            for c in (col, col - 1):
                if not is_function[r][c]:
                    if bit_idx < len(all_bits):
                        matrix[r][c] = all_bits[bit_idx]
                        bit_idx += 1
                    else:
                        matrix[r][c] = 0
        going_up = not going_up
        col -= 2

    # Masking: choose mask 0: (r + c) % 2 == 0
    # Let's use mask 0
    mask_pattern = 0
    for r in range(size):
        for c in range(size):
            if not is_function[r][c]:
                # mask 0: (r + c) % 2 == 0
                if (r + c) % 2 == 0:
                    matrix[r][c] ^= 1

    # Format info for ECL 'M' (00) and Mask 0 (000):
    # ECL bits: L=01, M=00, Q=11, H=10.
    # M = 00. Mask 0 = 000 -> data = 00000 -> (0 << 3) | 0 = 0
    # BCH code for 5-bit format info: generator poly = 10100110111 (0x537)
    # Mask with 101010000010010 (0x5412)
    def calc_format_bits(ecl_bits, mask):
        data = (ecl_bits << 3) | mask
        rem = data << 10
        for i in range(4, -1, -1):
            if (rem >> (i + 10)) & 1:
                rem ^= (0x537 << i)
        fmt = (data << 10) | rem
        return fmt ^ 0x5412

    fmt_bits_val = calc_format_bits(0, mask_pattern) # ECL M=0, mask=0
    fmt_bits = [(fmt_bits_val >> (14 - i)) & 1 for i in range(15)]

    # Place format bits
    # Around top-left finder:
    # (8,0)..(8,5), (8,7), (8,8), (7,8), (5,8)..(0,8)
    # Note: row 6 col 8 is timing, handled by skips
    fmt_coords_1 = [
        (8, 0), (8, 1), (8, 2), (8, 3), (8, 4), (8, 5), (8, 7), (8, 8),
        (7, 8), (5, 8), (4, 8), (3, 8), (2, 8), (1, 8), (0, 8)
    ]
    for i, (r, c) in enumerate(fmt_coords_1):
        matrix[r][c] = fmt_bits[i]

    # Around bottom-left and top-right finders:
    fmt_coords_2 = [
        (size - 1, 8), (size - 2, 8), (size - 3, 8), (size - 4, 8),
        (size - 5, 8), (size - 6, 8), (size - 7, 8),
        (8, size - 8), (8, size - 7), (8, size - 6), (8, size - 5),
        (8, size - 4), (8, size - 3), (8, size - 2), (8, size - 1)
    ]
    for i, (r, c) in enumerate(fmt_coords_2):
        matrix[r][c] = fmt_bits[i]

    return matrix

def matrix_to_svg(matrix, margin=4, module_size=10, fill_color="#000000", bg_color="#ffffff"):
    size = len(matrix)
    total_size = (size + 2 * margin) * module_size
    
    rects = []
    for r in range(size):
        for c in range(size):
            if matrix[r][c] == 1:
                x = (c + margin) * module_size
                y = (r + margin) * module_size
                rects.append(f'<rect x="{x}" y="{y}" width="{module_size}" height="{module_size}" fill="{fill_color}"/>')
                
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {total_size} {total_size}" width="{total_size}" height="{total_size}">
  <rect width="{total_size}" height="{total_size}" fill="{bg_color}"/>
  {''.join(rects)}
</svg>'''
    return svg

def matrix_to_png(matrix, margin=4, scale=12):
    import struct, zlib
    size = len(matrix)
    dim = (size + 2 * margin) * scale
    rgba = bytearray(dim * dim * 4)
    # Default white background
    for i in range(0, len(rgba), 4):
        rgba[i] = 255
        rgba[i+1] = 255
        rgba[i+2] = 255
        rgba[i+3] = 255
        
    dark_rgb = (15, 23, 42) # Slate-900

    for r in range(size):
        for c in range(size):
            if matrix[r][c] == 1:
                start_x = (c + margin) * scale
                start_y = (r + margin) * scale
                for y in range(start_y, start_y + scale):
                    row_offset = y * dim * 4
                    for x in range(start_x, start_x + scale):
                        idx = row_offset + x * 4
                        rgba[idx] = dark_rgb[0]
                        rgba[idx+1] = dark_rgb[1]
                        rgba[idx+2] = dark_rgb[2]
                        rgba[idx+3] = 255

    raw = bytearray()
    for y in range(dim):
        raw.append(0)
        start = y * dim * 4
        raw.extend(rgba[start:start + dim * 4])

    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)

    header = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', dim, dim, 8, 6, 0, 0, 0))
    idat = chunk(b'IDAT', zlib.compress(bytes(raw), 9))
    iend = chunk(b'IEND', b'')
    return header + ihdr + idat + iend

if __name__ == "__main__":
    give_url = "https://give.asia/s/sh35662316-z9x6gd"
    mat_give = create_qr_matrix(give_url, version=3, ecl='M')
    svg_give = matrix_to_svg(mat_give, margin=4, module_size=10, fill_color="#0F172A", bg_color="#FFFFFF")
    with open("give_asia_qr.svg", "w") as f:
        f.write(svg_give)
    png_give = matrix_to_png(mat_give, margin=4, scale=14)
    with open("give_asia_qr.png", "wb") as f:
        f.write(png_give)
        
    # Website Challenge QR Code
    web_url = "https://typetochangethefuture.org"
    mat_web = create_qr_matrix(web_url, version=3, ecl='M')
    svg_web = matrix_to_svg(mat_web, margin=4, module_size=10, fill_color="#0F172A", bg_color="#FFFFFF")
    with open("website_qr.svg", "w") as f:
        f.write(svg_web)
    png_web = matrix_to_png(mat_web, margin=4, scale=14)
    with open("website_qr.png", "wb") as f:
        f.write(png_web)
        
    print("Generated website_qr.svg, website_qr.png, give_asia_qr.svg and give_asia_qr.png successfully!")

