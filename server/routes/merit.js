'use strict';

const express = require('express');
const db = require('../db');

function createMeritRouter(type) {
  const router = express.Router();

  router.post('/merit', (req, res) => {
    if (type === 'user') {
      const { userId, userName, merit, chantCount } = req.body;
      if (!userId || merit === undefined) {
        return res.status(400).json({ error: '缺少 userId 或 merit' });
      }
      try {
        const result = db.upsertUser(userId, userName || '无名氏', String(merit), Number(chantCount || 0));
        return res.json({ success: true, data: result });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    if (type === 'model') {
      const { provider, model, merit, chantCount } = req.body;
      if (!provider || !model || merit === undefined) {
        return res.status(400).json({ error: '缺少 provider、model 或 merit' });
      }
      try {
        const result = db.upsertModel(model, provider, String(merit), Number(chantCount || 0));
        return res.json({ success: true, data: result });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    res.status(400).json({ error: '未知类型' });
  });

  return router;
}

module.exports = createMeritRouter;
