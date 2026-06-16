'use strict';

const express = require('express');
const path = require('path');
const createMeritRouter = require('./routes/merit');
const rankingRoutes = require('./routes/ranking');
const rateLimit = require('./middleware/rateLimit');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(rateLimit);

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: Date.now() });
});

app.use('/api/user', createMeritRouter('user'));
app.use('/api/model', createMeritRouter('model'));
app.use('/api', rankingRoutes);

app.use(express.static(path.join(__dirname, '..')));

app.listen(PORT, () => {
  console.log('赛博功德转换器服务器已启动：http://localhost:' + PORT);
});
