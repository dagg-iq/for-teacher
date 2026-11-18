#!/usr/bin/env bash
# يختبر الـ migrations والصلاحيات على Postgres محلي:  bash supabase/tests/run.sh
# (محلياً: su postgres -c "bash supabase/tests/run.sh")
set -euo pipefail
cd "$(dirname "$0")/.."
DB=midad_test
PSQL="psql -v ON_ERROR_STOP=1 -q -U postgres"
$PSQL -c "drop database if exists $DB" -c "create database $DB" >/dev/null
$PSQL -d $DB -f tests/auth_stub.sql >/dev/null
# مرتين للتأكد أنها آمنة لإعادة التشغيل
for pass in 1 2; do
  for f in migrations/*.sql; do $PSQL -d $DB -f "$f" >/dev/null; done
done
$PSQL -d $DB -f tests/rls_test.sql
echo "✓ RLS"
