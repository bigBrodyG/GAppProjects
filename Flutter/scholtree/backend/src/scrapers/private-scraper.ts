import fs from 'fs';
import path from 'path';
import { CACHE_DIR } from '../config';
import { parseRessourceJs, parseSignature } from './parse-ressource';
import { fetchTextNtlm, fetchBinaryNtlm } from '../services/ntlm.service';
import db from '../db';

const BASE_URL = 'https://dati.itis.pr.it/orariodiurnoriservata';
const SCHOOL_YEAR = '2025-26';

function savePng(buffer: Buffer, code: string): string {
  const safeCode = code.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safeCode) throw new Error(`invalid code: ${code}`);
  const dir = path.join(CACHE_DIR, 'img', 'teacher');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${safeCode}.png`), buffer);
  return `img/teacher/${safeCode}.png`;
}

function normalizeSurname(name: string): string {
  return name
    .trim()
    .split(/\s+/)[0]
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export async function runPrivateScraper(): Promise<void> {
  const sigRaw = await fetchTextNtlm(`${BASE_URL}/js_to_replace/_signature.js`);
  const newSig = parseSignature(sigRaw);

  const last = await db('scrape_log').where({ source: 'private' }).orderBy('id', 'desc').first();
  if (last && last.signature === newSig) {
    console.log('private scraper: signature unchanged, skip');
    return;
  }

  const startedAt = new Date();
  let itemsCount = 0;
  let failedImages = 0;

  try {
    const ressourceRaw = await fetchTextNtlm(`${BASE_URL}/js_to_replace/_ressource.js`);
    const resources = parseRessourceJs(ressourceRaw).filter(
      r => r.type === 'IND' && !r.code.startsWith('c') && !r.code.startsWith('s'),
    );

    for (const r of resources) {
      await db('resources')
        .insert({ type: 'teacher', code: r.code, name: r.name, school_year: SCHOOL_YEAR })
        .onConflict(['type', 'code', 'school_year'])
        .merge();
      itemsCount++;
    }

    for (const r of resources) {
      try {
        const buf = await fetchBinaryNtlm(`${BASE_URL}/img/docenti/${r.code}_${encodeURIComponent(r.name)}.png`);
        const cachePath = savePng(buf, r.code);
        await db('timetable_images')
          .insert({ resource_code: r.code, cache_path: cachePath })
          .onConflict(['resource_code'])
          .merge();
      } catch (err) {
        console.error(`private scraper: image failed for ${r.code}:`, err);
        failedImages++;
      }
    }

    const dbTeachers = await db('users')
      .where({ role: 'teacher', active: 1, school_year: SCHOOL_YEAR })
      .select('id', 'ldap_uid', 'name');

    const normalizedMap = new Map<string, { id: number; ldap_uid: string; name: string }[]>();
    for (const u of dbTeachers) {
      const key = normalizeSurname(u.name);
      const arr = normalizedMap.get(key) ?? [];
      arr.push(u);
      normalizedMap.set(key, arr);
    }

    for (const r of resources) {
      const key = normalizeSurname(r.name);
      const matches = normalizedMap.get(key) ?? [];
      if (matches.length > 1) {
        console.warn(`private scraper: ambiguous teacher match for ${r.code} (${r.name}), using first`);
      }
      await db('teacher_map')
        .insert({
          timetable_code: r.code,
          ldap_uid: matches.length > 0 ? matches[0].ldap_uid : null,
          display_name: r.name,
          confidence: 'auto',
        })
        .onConflict(['timetable_code'])
        .merge();
    }

    await db('scrape_log').insert({
      source: 'private',
      status: failedImages > 0 ? 'partial' : 'ok',
      started_at: startedAt,
      completed_at: new Date(),
      items_count: itemsCount,
      signature: newSig,
    });
  } catch (err) {
    await db('scrape_log').insert({
      source: 'private',
      status: 'error',
      started_at: startedAt,
      completed_at: new Date(),
      items_count: itemsCount,
      errors: err instanceof Error ? err.message : String(err),
      signature: newSig,
    });
    throw err;
  }
}

export async function checkAndScrapePrivate(): Promise<void> {
  await runPrivateScraper();
}
