'use strict';

// 手动清理历史脏数据脚本：删除 db.sqlite 并重新建表
// 用法：npm run reset

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'db.sqlite');

if (fs.existsSync(DB_PATH)) {
  fs.unlinkSync(DB_PATH);
  console.log('已删除旧数据库: ' + DB_PATH);
}

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
db.close();
console.log('已重新创建空数据库: ' + DB_PATH);
