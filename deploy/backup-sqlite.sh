#!/usr/bin/env bash
# 赛博功德转换器 SQLite 在线热备份脚本
#
# 用法（推荐配合 cron 每日执行）：
#   0 3 * * * /opt/aichanting/deploy/backup-sqlite.sh >> /var/log/aichanting-backup.log 2>&1
#
# 设计要点：
# - 使用 `sqlite3 .backup` 而非 `cp`：走 SQLite 在线备份 API，可在服务运行时安全执行，
#   不会得到撕裂的快照（cp 拷贝正在写的文件可能损坏）
# - 自动清理 14 天前的旧备份，避免磁盘占满

set -euo pipefail

# ===== 配置（按需修改路径） =====
SOURCE_DB="/opt/aichanting/server/db.sqlite"
BACKUP_DIR="/var/backups/aichanting"
RETENTION_DAYS=14
# ================================

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

# 1. 校验源数据库存在
if [[ ! -f "$SOURCE_DB" ]]; then
    log "ERROR: 源数据库不存在: $SOURCE_DB"
    exit 1
fi

# 2. 校验 sqlite3 CLI 可用
if ! command -v sqlite3 >/dev/null 2>&1; then
    log "ERROR: 未找到 sqlite3 命令，请先安装：sudo apt-get install -y sqlite3"
    exit 1
fi

# 3. 创建备份目录（如不存在）
mkdir -p "$BACKUP_DIR"

# 4. 执行在线热备份
TIMESTAMP=$(date '+%Y%m%d')
BACKUP_FILE="$BACKUP_DIR/db-$TIMESTAMP.sqlite"

log "开始备份: $SOURCE_DB -> $BACKUP_FILE"
sqlite3 "$SOURCE_DB" ".backup '$BACKUP_FILE'"

if [[ ! -s "$BACKUP_FILE" ]]; then
    log "ERROR: 备份文件生成失败或为空: $BACKUP_FILE"
    exit 1
fi

BACKUP_SIZE=$(stat -c '%s' "$BACKUP_FILE" 2>/dev/null || stat -f '%z' "$BACKUP_FILE")
log "备份完成: $BACKUP_FILE ($BACKUP_SIZE bytes)"

# 5. 验证备份文件可打开（完整性检查）
if ! sqlite3 "$BACKUP_FILE" "PRAGMA integrity_check;" >/dev/null 2>&1; then
    log "WARNING: 备份文件完整性检查失败: $BACKUP_FILE"
fi

# 6. 清理超过保留期的旧备份
log "清理 ${RETENTION_DAYS} 天前的旧备份..."
find "$BACKUP_DIR" -name 'db-*.sqlite' -type f -mtime +"$RETENTION_DAYS" -print -delete | while read -r old_file; do
    log "已删除: $old_file"
done

log "备份任务结束"
