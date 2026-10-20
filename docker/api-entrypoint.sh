#!/bin/sh
# Applies pending migrations before starting when RUN_MIGRATIONS=true
# (default). Disable it to run migrations as a separate deploy step.
set -e

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  node ace migration:run --force
fi

exec "$@"
