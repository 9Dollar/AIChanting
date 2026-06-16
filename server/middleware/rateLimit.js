'use strict';

const LIMIT = 60;
const WINDOW_MS = 60 * 1000;
const requests = new Map();

function rateLimit(req, res, next) {
  const key = req.ip || 'unknown';
  const now = Date.now();
  const record = requests.get(key) || { count: 0, resetAt: now + WINDOW_MS };

  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + WINDOW_MS;
  }

  record.count += 1;
  requests.set(key, record);

  if (record.count > LIMIT) {
    return res.status(429).json({ error: '请求过于频繁，请稍后再试' });
  }

  next();
}

module.exports = rateLimit;
