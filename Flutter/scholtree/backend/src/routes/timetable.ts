import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-scholtree-2026-demo-only';
const CACHE_DIR = process.env.CACHE_DIR || path.resolve(__dirname, '../../cache');

// Mock resources
const CLASSES = [
  { code: 'c0000001', name: '1A' }, { code: 'c0000002', name: '1B' },
  { code: 'c0000003', name: '1C' }, { code: 'c0000004', name: '1D' },
  { code: 'c0000005', name: '2A' }, { code: 'c0000006', name: '2B' },
  { code: 'c0000007', name: '2C' }, { code: 'c0000008', name: '2D' },
  { code: 'c0000009', name: '3A' }, { code: 'c0000010', name: '3B' },
  { code: 'c0000011', name: '3C' }, { code: 'c0000012', name: '3D' },
  { code: 'c0000013', name: '4A' }, { code: 'c0000014', name: '4B' },
  { code: 'c0000015', name: '4C' }, { code: 'c0000016', name: '4D' },
  { code: 'c0000017', name: '5A' }, { code: 'c0000018', name: '5B' },
  { code: 'c0000019', name: '5C' }, { code: 'c0000020', name: '5D' },
];

const ROOMS = [
  { code: 's0000001', name: 'LAB FISICA' }, { code: 's0000002', name: 'LAB CHIMICA' },
  { code: 's0000003', name: 'LAB INFORMATICA 1' }, { code: 's0000004', name: 'LAB INFORMATICA 2' },
  { code: 's0000005', name: 'LAB ELETTRONICA' }, { code: 's0000006', name: 'LAB MECCANICA' },
  { code: 's0000007', name: 'PALESTRA' }, { code: 's0000008', name: 'AULA MAGNA' },
  { code: 's0000009', name: 'BIBLIOTECA' }, { code: 's0000010', name: 'LAB LINGUE' },
  { code: 's0000011', name: 'LAB CAD' }, { code: 's0000012', name: 'LAB SISTEMI' },
];

const TEACHERS = [
  { code: 'dPROF001', name: 'Ollari Paolo' }, { code: 'dPROF002', name: 'Rossi Mario' },
  { code: 'dPROF003', name: 'Verdi Anna' }, { code: 'dPROF004', name: 'Neri Luca' },
  { code: 'dPROF005', name: 'Gialli Maria' }, { code: 'dPROF006', name: 'Bianchi Carlo' },
  { code: 'dPROF007', name: 'Marrone Elena' }, { code: 'dPROF008', name: 'Rosa Franco' },
];

// Verify JWT
function checkAuth(req: Request, res: Response): boolean {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'auth required' });
    return false;
  }
  try {
    jwt.verify(header.slice(7), JWT_SECRET);
    return true;
  } catch {
    res.status(401).json({ error: 'token non valido' });
    return false;
  }
}

function sanitize(code: string): string {
  return code.replace(/[^a-zA-Z0-9_-]/g, '');
}

// Generate a timetable-lookalike PNG (900x500, white bg, colored cells)
function generateTimetablePng(code: string, label: string): Buffer {
  const W = 900, H = 500;
  const cellW = 120, cellH = 55;
  const startX = 30, startY = 30;
  const cols = 6, rows = 8;

  // Colors for different subjects
  const colors = [
    [0x42, 0xA5, 0xF5], // blue
    [0xEF, 0x53, 0x50], // red
    [0x66, 0xBB, 0x6A], // green
    [0xFF, 0xA7, 0x26], // orange
    [0xAB, 0x47, 0xBC], // purple
    [0x26, 0xC6, 0xDA], // cyan
    [0xEC, 0x40, 0x7A], // pink
    [0x78, 0x90, 0x9C], // grey
  ];

  // Use code to seed deterministic colors per cell
  const seed = code.split('').reduce((a, c) => a + c.charCodeAt(0), 0);

  // Build PNG manually
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Build raw image data (filter byte + RGB per pixel per row)
  const rawRows: Buffer[] = [];
  for (let y = 0; y < H; y++) {
    const row: number[] = [0]; // filter byte: none
    for (let x = 0; x < W; x++) {
      // Check if pixel is in a cell
      const col = Math.floor((x - startX) / cellW);
      const rowIdx = Math.floor((y - startY) / cellH);
      const inGutter = x < startX || y < startY;
      const inHeader = col === 0 && !inGutter;
      const inRowHeader = rowIdx >= 0 && rowIdx < rows && x < startX + 60 && y >= startY + rowIdx * cellH && y < startY + (rowIdx + 1) * cellH;

      if (col >= 0 && col < cols && rowIdx >= 0 && rowIdx < rows && !inGutter) {
        const colorIdx = ((seed + rowIdx * 7 + col * 13) % colors.length);
        const [r, g, b] = colors[colorIdx];
        row.push(r, g, b);
      } else if (inHeader && y >= startY && y < startY + cellH) {
        // Day headers
        row.push(0x15, 0x65, 0xC0); // darker blue
      } else if (inRowHeader) {
        row.push(0xE0, 0xE0, 0xE0);
      } else {
        row.push(0xFF, 0xFF, 0xFF); // white bg
      }
    }
    rawRows.push(Buffer.from(row));
  }

  const rawData = Buffer.concat(rawRows);

  // Deflate raw data (simple store — no compression for simplicity, or use zlib)
  const zlib = require('zlib');
  const compressed = zlib.deflateSync(rawData);

  function crc32(buf: Buffer): number {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let j = 0; j < 8; j++) {
        c = (c >>> 1) ^ (c & 1 ? 0xEDB88320 : 0);
      }
    }
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function chunk(type: string, data: Buffer): Buffer {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeB = Buffer.from(type, 'ascii');
    const crcData = Buffer.concat([typeB, data]);
    const crcVal = Buffer.alloc(4);
    crcVal.writeUInt32BE(crc32(crcData), 0);
    return Buffer.concat([len, typeB, data, crcVal]);
  }

  const iend = chunk('IEND', Buffer.alloc(0));

  // Draw text label using simple pixel font isn't practical here.
  // The colored grid itself looks like a timetable. Add a title at top.
  // Actually, let's draw text manually at top of image
  // For now the colored grid is sufficient for a demo

  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', compressed), iend]);
}

export const timetableRouter = Router();

timetableRouter.get('/classes', (req, res) => {
  if (!checkAuth(req, res)) return;
  res.json({ data: CLASSES });
});

timetableRouter.get('/rooms', (req, res) => {
  if (!checkAuth(req, res)) return;
  res.json({ data: ROOMS });
});

timetableRouter.get('/teachers', (req, res) => {
  if (!checkAuth(req, res)) return;
  res.json({ data: TEACHERS });
});

timetableRouter.get('/image/:type/:code', (req, res) => {
  if (!checkAuth(req, res)) return;

  const type = req.params.type;
  if (!['class', 'room', 'teacher'].includes(type)) {
    res.status(400).json({ error: 'tipo non valido' });
    return;
  }

  const code = sanitize(req.params.code);
  const filePath = path.join(CACHE_DIR, 'img', type === 'class' ? 'classi' : type === 'room' ? 'aule' : 'docenti', `${code}.png`);

  // Generate on-the-fly if not cached
  if (!fs.existsSync(filePath)) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const png = generateTimetablePng(code, code);
    fs.writeFileSync(filePath, png);
  }

  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.sendFile(filePath);
});

timetableRouter.get('/meta/:type/:code', (req, res) => {
  if (!checkAuth(req, res)) return;
  const type = req.params.type;
  const code = sanitize(req.params.code);
  res.json({
    image_url: `/api/timetable/image/${type}/${code}`,
    last_updated: new Date().toISOString(),
    school_year: '2025-26',
  });
});
