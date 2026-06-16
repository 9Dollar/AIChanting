'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/user/ranking', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '100', 10), 1000);
  try {
    const rows = db.getUserRanking(limit);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/model/ranking', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '100', 10), 1000);
  try {
    const rows = db.getModelRanking(limit);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
