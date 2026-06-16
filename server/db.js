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

function addMeritStrings(a, b) {
  const bigA = BigInt(a || '0');
  const bigB = BigInt(b || '0');
  return (bigA + bigB).toString();
}

function upsertUser(userId, userName, merit, chantCount) {
  const now = Date.now();
  const existing = db.prepare('SELECT total_merit, chant_count FROM users WHERE user_id = ?').get(userId);

  if (existing) {
    const newMerit = addMeritStrings(existing.total_merit, merit);
    const newCount = existing.chant_count + (chantCount || 0);
    db.prepare(
      'UPDATE users SET user_name = ?, total_merit = ?, chant_count = ?, last_update = ? WHERE user_id = ?'
    ).run(userName, newMerit, newCount, now, userId);
    return { user_id: userId, total_merit: newMerit, chant_count: newCount };
  }

  db.prepare(
    'INSERT INTO users (user_id, user_name, total_merit, chant_count, last_update, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(userId, userName, merit || '0', chantCount || 0, now, now);
  return { user_id: userId, total_merit: merit || '0', chant_count: chantCount || 0 };
}

function upsertModel(name, provider, merit, chantCount) {
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
  ).run(name, provider, merit || '0', chantCount || 0, now, now);
  return { name, provider, total_merit: merit || '0', chant_count: chantCount || 0 };
}

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
  upsertUser,
  upsertModel,
  getUserRanking,
  getModelRanking,
};
