import { Router } from 'express';
import { authRequired, loadUser, requireRoles } from '../middleware/auth.js';
import {
  getCurrentExchangeRate,
  getExchangeRateHistory,
  getExchangeRateSyncLog,
  patchExchangeRateSettings,
  syncExchangeRate,
} from '../services/exchangeRateService.js';

export const exchangeRateConfigRouter = Router();
exchangeRateConfigRouter.use(authRequired);
exchangeRateConfigRouter.use(loadUser);

exchangeRateConfigRouter.get('/exchange-rate', async (_req, res, next) => {
  try {
    const data = await getCurrentExchangeRate();
    res.json(data);
  } catch (e) {
    next(e);
  }
});

exchangeRateConfigRouter.get('/exchange-rate/history', async (req, res, next) => {
  try {
    const data = await getExchangeRateHistory({
      from: req.query.from,
      to: req.query.to,
      limit: req.query.limit,
      order: req.query.order,
    });
    res.json(data);
  } catch (e) {
    next(e);
  }
});

export const exchangeRateAdminRouter = Router();
exchangeRateAdminRouter.use(authRequired);
exchangeRateAdminRouter.use(requireRoles('SUPER_ADMIN', 'FINANCE_ADMIN'));

exchangeRateAdminRouter.post('/exchange-rate/sync', async (req, res, next) => {
  try {
    const force = Boolean(req.body?.force);
    const result = await syncExchangeRate({
      mode: 'manual',
      userId: req.user.sub,
      userName: req.user.name,
      force,
    });
    res.json(result);
  } catch (e) {
    next(e);
  }
});

exchangeRateAdminRouter.get('/exchange-rate/sync-log', async (req, res, next) => {
  try {
    const data = await getExchangeRateSyncLog(req.query.limit);
    res.json(data);
  } catch (e) {
    next(e);
  }
});

exchangeRateAdminRouter.patch('/exchange-rate/settings', async (req, res, next) => {
  try {
    if (req.body?.kurs_auto_sync_enabled == null) {
      return res.status(400).json({ error: 'Bad Request', message: 'kurs_auto_sync_enabled wajib diisi.' });
    }
    const data = await patchExchangeRateSettings({
      kurs_auto_sync_enabled: req.body.kurs_auto_sync_enabled,
    });
    res.json(data);
  } catch (e) {
    next(e);
  }
});
