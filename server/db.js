'use strict';

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'db.sqlite');

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT UNIQUE NOT NULL,
    user_name TEXT NOT NULL,
    total_merit TEXT NOT NULL DEFAULT '0',
    chant_count INTEGER NOT NULL DEFAULT 0,
    last_update INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    provider TEXT NOT NULL,
    total_merit TEXT NOT NULL DEFAULT '0',
    chant_count INTEGER NOT NULL DEFAULT 0,
    last_update INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
`);

// 全局写操作队列：串行化所有写操作，避免并发更新丢失或脏读
let writeQueue = Promise.resolve();

// 将写操作入队，返回 Promise 携带结果。
// fn 内异常会传播给调用方，但队列链不断（用 () => fn() 包裹确保前一个失败不阻塞后一个）
function enqueueWrite(fn) {
  const run = () => Promise.resolve().then(fn);
  writeQueue = writeQueue.then(run, run);
  return writeQueue;
}

function addMeritStrings(a, b) {
  const bigA = BigInt(a || '0');
  const bigB = BigInt(b || '0');
  return (bigA + bigB).toString();
}

// 用户功德：覆盖式（全量上传语义）
// merit / chantCount 为用户当前总值，直接覆盖
function upsertUser(userId, userName, merit, chantCount) {
  return enqueueWrite(() => {
    const now = Date.now();
    const existing = db
      .prepare('SELECT id FROM users WHERE user_id = ?')
      .get(userId);

    if (existing) {
      db.prepare(
        'UPDATE users SET user_name = ?, total_merit = ?, chant_count = ?, last_update = ? WHERE user_id = ?'
      ).run(userName, String(merit || '0'), Number(chantCount || 0), now, userId);
      return { user_id: userId, total_merit: String(merit || '0'), chant_count: Number(chantCount || 0) };
    }

    db.prepare(
      'INSERT INTO users (user_id, user_name, total_merit, chant_count, last_update, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(userId, userName, String(merit || '0'), Number(chantCount || 0), now, now);
    return { user_id: userId, total_merit: String(merit || '0'), chant_count: Number(chantCount || 0) };
  });
}

// 模型功德：累加式（增量上传语义）
// merit / chantCount 为本次新增值，累加到现有记录
function upsertModel(name, provider, merit, chantCount) {
  return enqueueWrite(() => {
    const now = Date.now();
    const existing = db
      .prepare('SELECT total_merit, chant_count FROM models WHERE name = ? AND provider = ?')
      .get(name, provider);

    if (existing) {
      const newMerit = addMeritStrings(existing.total_merit, merit);
      const newCount = existing.chant_count + (chantCount || 0);
      db.prepare(
        'UPDATE models SET total_merit = ?, chant_count = ?, last_update = ? WHERE name = ? AND provider = ?'
      ).run(newMerit, newCount, now, name, provider);
      return { name, provider, total_merit: newMerit, chant_count: newCount };
    }

    db.prepare(
      'INSERT INTO models (name, provider, total_merit, chant_count, last_update, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(name, provider, String(merit || '0'), Number(chantCount || 0), now, now);
    return { name, provider, total_merit: String(merit || '0'), chant_count: Number(chantCount || 0) };
  });
}

// 读操作不经过队列，直接同步读
function sortByMeritDesc(rows) {
  return rows.sort((a, b) => {
    const sa = String(a.total_merit || '0');
    const sb = String(b.total_merit || '0');
    if (sa.length !== sb.length) return sb.length - sa.length;
    return sb.localeCompare(sa);
  });
}

function getUserRanking(limit) {
  const rows = db.prepare('SELECT user_id, user_name, total_merit, chant_count FROM users ORDER BY id').all();
  return sortByMeritDesc(rows).slice(0, limit);
}

function getModelRanking(limit) {
  const rows = db.prepare('SELECT name, provider, total_merit, chant_count FROM models ORDER BY id').all();
  return sortByMeritDesc(rows).slice(0, limit);
}

module.exports = {
  db,
  enqueueWrite,
  upsertUser,
  upsertModel,
  getUserRanking,
  getModelRanking,
};
