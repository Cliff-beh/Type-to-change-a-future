/**
 * Standalone QR Code Generator for Type to change a future Campaign
 * Pure JavaScript, zero external dependencies.
 * Generates QR Code matrix and renders to Canvas or SVG.
 */
(function(global) {
  'use strict';

  // Galois field GF(256) arithmetic
  const GF_EXP = new Array(512);
  const GF_LOG = new Array(256);
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }

  function gfMul(x, y) {
    if (x === 0 || y === 0) return 0;
    return GF_EXP[GF_LOG[x] + GF_LOG[y]];
  }

  function rsGenPoly(nsym) {
    let g = [1];
    for (let i = 0; i < nsym; i++) {
      const root = GF_EXP[i];
      const nextG = new Array(g.length + 1).fill(0);
      for (let j = 0; j < g.length; j++) {
        nextG[j] ^= gfMul(g[j], root);
        nextG[j + 1] ^= g[j];
      }
      g = nextG;
    }
    return g;
  }

  function rsEncode(msg, nsym) {
    const gen = rsGenPoly(nsym);
    const res = msg.concat(new Array(nsym).fill(0));
    for (let i = 0; i < msg.length; i++) {
      const coef = res[i];
      if (coef !== 0) {
        for (let j = 0; j < gen.length; j++) {
          res[i + j] ^= gfMul(gen[j], coef);
        }
      }
    }
    return res.slice(msg.length);
  }

  // Version specs: [version, totalCodewords, dataCodewords_M, ecCodewords_M, numBlocks_M]
  const VERSION_SPECS = {
    1: { size: 21, total: 26, data: 16, ec: 10, blocks: 1, align: [] },
    2: { size: 25, total: 44, data: 28, ec: 16, blocks: 1, align: [6, 18] },
    3: { size: 29, total: 70, data: 44, ec: 26, blocks: 1, align: [6, 22] },
    4: { size: 33, total: 100, data: 64, ec: 36, blocks: 2, align: [6, 26] },
    5: { size: 37, total: 134, data: 86, ec: 48, blocks: 2, align: [6, 30] },
    6: { size: 41, total: 172, data: 108, ec: 64, blocks: 4, align: [6, 34] }
  };

  function chooseVersion(dataLen) {
    // Byte mode overhead: 4 (mode) + 8 (length) = 12 bits = ~2 bytes
    const needed = dataLen + 2;
    for (let v = 1; v <= 6; v++) {
      if (VERSION_SPECS[v].data >= needed) return v;
    }
    return 6;
  }

  function createMatrix(text) {
    const utf8Bytes = [];
    for (let i = 0; i < text.length; i++) {
      let code = text.charCodeAt(i);
      if (code < 128) {
        utf8Bytes.push(code);
      } else if (code < 2048) {
        utf8Bytes.push((code >> 6) | 192);
        utf8Bytes.push((code & 63) | 128);
      } else {
        utf8Bytes.push((code >> 12) | 224);
        utf8Bytes.push(((code >> 6) & 63) | 128);
        utf8Bytes.push((code & 63) | 128);
      }
    }

    const version = chooseVersion(utf8Bytes.length);
    const spec = VERSION_SPECS[version];
    const size = spec.size;

    const matrix = Array.from({ length: size }, () => Array(size).fill(null));
    const isFunction = Array.from({ length: size }, () => Array(size).fill(false));

    function setFn(r, c, val) {
      matrix[r][c] = val;
      isFunction[r][c] = true;
    }

    // Finder patterns
    function placeFinder(top, left) {
      for (let r = -1; r <= 7; r++) {
        for (let c = -1; c <= 7; c++) {
          const row = top + r;
          const col = left + c;
          if (row >= 0 && row < size && col >= 0 && col < size) {
            isFunction[row][col] = true;
            if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
              if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
                matrix[row][col] = 1;
              } else {
                matrix[row][col] = 0;
              }
            } else {
              matrix[row][col] = 0;
            }
          }
        }
      }
    }

    placeFinder(0, 0);
    placeFinder(0, size - 7);
    placeFinder(size - 7, 0);

    // Timing patterns
    for (let i = 8; i < size - 8; i++) {
      setFn(6, i, i % 2 === 0 ? 1 : 0);
      setFn(i, 6, i % 2 === 0 ? 1 : 0);
    }

    // Alignment patterns
    const coords = spec.align;
    for (let i = 0; i < coords.length; i++) {
      for (let j = 0; j < coords.length; j++) {
        const r = coords[i];
        const c = coords[j];
        if ((r < 9 && c < 9) || (r < 9 && c >= size - 9) || (r >= size - 9 && c < 9)) continue;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const val = Math.max(Math.abs(dr), Math.abs(dc)) !== 1 ? 1 : 0;
            setFn(r + dr, c + dc, val);
          }
        }
      }
    }

    // Dark module
    setFn(4 * version + 9, 8, 1);

    // Format info placeholders
    for (let i = 0; i < 9; i++) {
      if (matrix[8][i] === null) setFn(8, i, 0);
      if (matrix[i][8] === null) setFn(i, 8, 0);
    }
    for (let i = 0; i < 8; i++) {
      setFn(8, size - 1 - i, 0);
      setFn(size - 1 - i, 8, 0);
    }

    // Data encoding: Byte mode (0100) + 8-bit length
    const bits = [0, 1, 0, 0];
    const len = utf8Bytes.length;
    for (let b = 7; b >= 0; b--) bits.push((len >> b) & 1);
    for (let i = 0; i < utf8Bytes.length; i++) {
      const byte = utf8Bytes[i];
      for (let b = 7; b >= 0; b--) bits.push((byte >> b) & 1);
    }

    const dataCapBits = spec.data * 8;
    const term = Math.min(4, dataCapBits - bits.length);
    for (let i = 0; i < term; i++) bits.push(0);
    while (bits.length % 8 !== 0) bits.push(0);

    const pad = [0xec, 0x11];
    let padIdx = 0;
    while (bits.length < dataCapBits) {
      const p = pad[padIdx % 2];
      padIdx++;
      for (let b = 7; b >= 0; b--) bits.push((p >> b) & 1);
    }

    // Codewords
    const dataCodewords = [];
    for (let i = 0; i < bits.length; i += 8) {
      let byte = 0;
      for (let b = 0; b < 8; b++) byte = (byte << 1) | bits[i + b];
      dataCodewords.push(byte);
    }

    // Blocks and EC
    const numBlocks = spec.blocks;
    const ecPerBlock = Math.floor(spec.ec / numBlocks);
    const dataPerBlock = Math.floor(spec.data / numBlocks);

    const dataBlocks = [];
    const ecBlocks = [];
    for (let i = 0; i < numBlocks; i++) {
      const bData = dataCodewords.slice(i * dataPerBlock, (i + 1) * dataPerBlock);
      dataBlocks.push(bData);
      ecBlocks.push(rsEncode(bData, ecPerBlock));
    }

    // Interleave
    const interleaved = [];
    for (let i = 0; i < dataPerBlock; i++) {
      for (let b = 0; b < numBlocks; b++) {
        interleaved.push(dataBlocks[b][i]);
      }
    }
    for (let i = 0; i < ecPerBlock; i++) {
      for (let b = 0; b < numBlocks; b++) {
        interleaved.push(ecBlocks[b][i]);
      }
    }

    const finalBits = [];
    for (let i = 0; i < interleaved.length; i++) {
      for (let b = 7; b >= 0; b--) finalBits.push((interleaved[i] >> b) & 1);
    }

    // Place into matrix (zig-zag upward/downward)
    let bitIdx = 0;
    let col = size - 1;
    let goingUp = true;
    while (col > 0) {
      if (col === 6) col--;
      const rows = goingUp
        ? Array.from({ length: size }, (_, i) => size - 1 - i)
        : Array.from({ length: size }, (_, i) => i);

      for (let r of rows) {
        for (let c of [col, col - 1]) {
          if (!isFunction[r][c]) {
            matrix[r][c] = bitIdx < finalBits.length ? finalBits[bitIdx++] : 0;
          }
        }
      }
      goingUp = !goingUp;
      col -= 2;
    }

    // Mask pattern 0: (r + c) % 2 === 0
    const mask = 0;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!isFunction[r][c]) {
          if ((r + c) % 2 === 0) matrix[r][c] ^= 1;
        }
      }
    }

    // Format bits for ECL M (00) and Mask 0 (000) -> 0x5412 mask XOR
    // ECL M = 00, Mask 0 = 000 -> data = 0
    // Remainder calculation with 0x537 poly:
    // 00000 << 10 = 0, rem = 0 -> format bits = 0 ^ 0x5412 = 0x5412
    const fmtVal = 0x5412;
    const fmtBits = [];
    for (let i = 14; i >= 0; i--) fmtBits.push((fmtVal >> i) & 1);

    const fmtCoords1 = [
      [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
      [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]
    ];
    for (let i = 0; i < fmtCoords1.length; i++) {
      const [r, c] = fmtCoords1[i];
      matrix[r][c] = fmtBits[i];
    }

    const fmtCoords2 = [
      [size - 1, 8], [size - 2, 8], [size - 3, 8], [size - 4, 8],
      [size - 5, 8], [size - 6, 8], [size - 7, 8],
      [8, size - 8], [8, size - 7], [8, size - 6], [8, size - 5],
      [8, size - 4], [8, size - 3], [8, size - 2], [8, size - 1]
    ];
    for (let i = 0; i < fmtCoords2.length; i++) {
      const [r, c] = fmtCoords2[i];
      matrix[r][c] = fmtBits[i];
    }

    return matrix;
  }

  function renderToCanvas(text, canvas, options = {}) {
    const matrix = createMatrix(text);
    const size = matrix.length;
    const margin = options.margin !== undefined ? options.margin : 4;
    const cellSize = options.cellSize || Math.max(4, Math.floor((options.size || 220) / (size + margin * 2)));
    const totalDim = (size + margin * 2) * cellSize;

    canvas.width = totalDim;
    canvas.height = totalDim;
    const ctx = canvas.getContext('2d');

    const darkColor = options.darkColor || '#0f172a';
    const lightColor = options.lightColor || '#ffffff';

    ctx.fillStyle = lightColor;
    ctx.fillRect(0, 0, totalDim, totalDim);

    ctx.fillStyle = darkColor;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (matrix[r][c] === 1) {
          ctx.fillRect((c + margin) * cellSize, (r + margin) * cellSize, cellSize, cellSize);
        }
      }
    }
    return canvas;
  }

  function renderToSVG(text, options = {}) {
    const matrix = createMatrix(text);
    const size = matrix.length;
    const margin = options.margin !== undefined ? options.margin : 4;
    const cellSize = options.cellSize || 8;
    const totalDim = (size + margin * 2) * cellSize;
    const darkColor = options.darkColor || '#0f172a';
    const lightColor = options.lightColor || '#ffffff';

    let rects = '';
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (matrix[r][c] === 1) {
          rects += `<rect x="${(c + margin) * cellSize}" y="${(r + margin) * cellSize}" width="${cellSize}" height="${cellSize}" fill="${darkColor}"/>`;
        }
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalDim} ${totalDim}" width="${totalDim}" height="${totalDim}">
      <rect width="${totalDim}" height="${totalDim}" fill="${lightColor}"/>
      ${rects}
    </svg>`;
  }

  global.CharityQR = {
    createMatrix,
    renderToCanvas,
    renderToSVG
  };
})(typeof window !== 'undefined' ? window : this);
