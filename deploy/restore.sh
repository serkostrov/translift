#!/usr/bin/env bash
# Восстановление «Транслифт» из резервной копии.
# Запуск из папки deploy:  ./restore.sh 2026-11-25_0330
# (метка — часть имени файлов backups/db_<метка>.dump и backups/files_<метка>.tar.gz)
#
# ВНИМАНИЕ: текущие данные в базе и хранилище файлов будут ЗАМЕНЕНЫ данными из копии.
set -euo pipefail
cd "$(dirname "$0")"

STAMP=${1:-}
DB="backups/db_$STAMP.dump"
FILES="backups/files_$STAMP.tar.gz"
if [[ -z "$STAMP" || ! -f "$DB" || ! -f "$FILES" ]]; then
  echo "Укажите метку копии. Доступные:"
  ls backups/db_*.dump 2>/dev/null | sed 's/.*db_\(.*\)\.dump/  \1/' || echo "  (копий нет)"
  exit 1
fi

read -r -p "Заменить текущие данные копией $STAMP? Введите «да»: " ANSWER
[[ "$ANSWER" == "да" ]] || { echo "Отменено"; exit 1; }

ENV_FILE=${ENV_FILE:-.env}
COMPOSE="docker compose --env-file $ENV_FILE"
PROJECT=$($COMPOSE config --format json 2>/dev/null | grep -o '"name": *"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)"$/\1/')
PROJECT=${PROJECT:-translift-prod}

echo "Останавливаем приложение…"
$COMPOSE stop web backend

echo "Восстанавливаем базу…"
$COMPOSE exec -T postgres pg_restore -U translift -d translift --clean --if-exists --no-owner < "$DB"

echo "Восстанавливаем файлы…"
$COMPOSE stop minio
docker run --rm \
  -v "${PROJECT}_miniodata:/data" \
  -v "$(pwd)/backups:/backup:ro" \
  alpine sh -c "rm -rf /data/* /data/.minio.sys && tar xzf /backup/files_$STAMP.tar.gz -C /data"

echo "Запускаем…"
$COMPOSE up -d
echo "Готово: данные восстановлены из копии $STAMP"
