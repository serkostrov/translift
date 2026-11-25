#!/usr/bin/env bash
# Резервная копия «Транслифт»: база данных + файлы (фото и документы).
# Запуск из папки deploy:  ./backup.sh
# Для ежедневного запуска — строка в crontab (crontab -e):
#   30 3 * * * cd /opt/translift/deploy && ./backup.sh >> backups/backup.log 2>&1
#
# Копии кладутся в deploy/backups и хранятся BACKUP_KEEP_DAYS дней (из .env, по умолчанию 14).
# Важно: копия на том же сервере не спасёт от поломки диска — регулярно переносите
# папку backups на другой сервер или в облачное хранилище.
set -euo pipefail
cd "$(dirname "$0")"

KEEP_DAYS=$(grep -E '^BACKUP_KEEP_DAYS=' "${ENV_FILE:-.env}" 2>/dev/null | cut -d= -f2 || true)
KEEP_DAYS=${KEEP_DAYS:-14}
STAMP=$(date +%Y-%m-%d_%H%M)
DIR=backups
mkdir -p "$DIR"

ENV_FILE=${ENV_FILE:-.env}
COMPOSE="docker compose --env-file $ENV_FILE"
PROJECT=$($COMPOSE config --format json 2>/dev/null | grep -o '"name": *"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)"$/\1/')
PROJECT=${PROJECT:-translift-prod}

echo "[$(date '+%F %T')] Резервная копия $STAMP"

# 1. База: формат custom (-Fc) — компактный, восстанавливается pg_restore
$COMPOSE exec -T postgres pg_dump -U translift -d translift -Fc > "$DIR/db_$STAMP.dump"
echo "  база: $(du -h "$DIR/db_$STAMP.dump" | cut -f1)"

# 2. Файлы: архив тома MinIO (без остановки — файлы в хранилище не изменяются после записи)
docker run --rm \
  -v "${PROJECT}_miniodata:/data:ro" \
  -v "$(pwd)/$DIR:/backup" \
  alpine tar czf "/backup/files_$STAMP.tar.gz" -C /data .
echo "  файлы: $(du -h "$DIR/files_$STAMP.tar.gz" | cut -f1)"

# 3. Старые копии — удаляем
find "$DIR" -maxdepth 1 -type f \( -name 'db_*.dump' -o -name 'files_*.tar.gz' \) -mtime +"$KEEP_DAYS" -delete
echo "  готово, копии старше $KEEP_DAYS дн. удалены"
