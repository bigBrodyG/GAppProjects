import { Router, Request, Response, NextFunction } from 'express';
import db from '../db';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/require-role';
import { checkAndScrape } from '../scrapers/public-scraper';
import { checkAndScrapePrivate } from '../scrapers/private-scraper';

const router = Router();

router.get('/teacher-map', authenticate, requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const confidence = req.query.confidence as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;

    let q = db('teacher_map');
    if (confidence) q = q.where({ confidence });

    const [data, countResult] = await Promise.all([
      q.clone().limit(limit).offset(offset),
      q.clone().count('timetable_code as total').first(),
    ]);

    res.json({ data, total: Number((countResult as { total: number } | undefined)?.total ?? 0), limit, offset });
  } catch (err) {
    next(err);
  }
});

router.put('/teacher-map/:timetable_code', authenticate, requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { timetable_code } = req.params;
    const { ldap_uid, confirmed } = req.body;

    if (!ldap_uid) {
      res.status(400).json({ error: 'ldap_uid required' });
      return;
    }

    await db('teacher_map').where({ timetable_code }).update({
      ldap_uid,
      confidence: 'manual',
      confirmed_at: confirmed ? new Date() : null,
    });

    const row = await db('teacher_map').where({ timetable_code }).first();
    if (!row) {
      res.status(404).json({ error: 'not found' });
      return;
    }

    res.json(row);
  } catch (err) {
    next(err);
  }
});

router.post('/scrape', authenticate, requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    let publicStatus: 'ok' | 'error' = 'ok';
    let privateStatus: 'ok' | 'error' = 'ok';

    try {
      await checkAndScrape();
    } catch {
      publicStatus = 'error';
    }

    try {
      await checkAndScrapePrivate();
    } catch {
      privateStatus = 'error';
    }

    res.json({ public: publicStatus, private: privateStatus });
  } catch (err) {
    next(err);
  }
});

export default router;
