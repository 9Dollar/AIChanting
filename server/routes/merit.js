'use strict';

const express = require('express');
const db = require('../db');

// API 语义说明：
// - POST /api/user/merit  : merit = 用户当前总功德（全量，覆盖式）。后端用传入值覆盖该用户记录。
// - POST /api/model/merit : merit = 本次新增功德（增量，累加式）。后端将传入值累加到该模型记录。
function createMeritRouter(type) {
  const router = express.Router();

  router.post('/merit', async (req, res) => {
    if (type === 'user') {
      const { userId, userName, merit, chantCount } = req.body;
      if (!userId || merit === undefined) {
        return res.status(400).json({ error: '缺少 userId 或 merit' });
      }
      try {
        const result = await db.upsertUser(userId, userName || '无名氏', String(merit), Number(chantCount || 0));
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
        const result = await db.upsertModel(model, provider, String(merit), Number(chantCount || 0));
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
