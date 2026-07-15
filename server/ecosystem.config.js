// PM2 进程守护配置
// 注意：本项目使用 better-sqlite3（单文件 SQLite）+ 应用内写队列，
// 必须 single instance（fork 模式），多实例会导致数据库写入冲突或损坏。
module.exports = {
  apps: [
    {
      name: 'aichanting',
      script: 'server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      merge_logs: true,
      time: true,
      max_memory_restart: '300M',
    },
  ],
};
