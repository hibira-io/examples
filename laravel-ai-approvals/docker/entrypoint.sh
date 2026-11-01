#!/bin/sh
# web:    migrate (when RUN_MIGRATIONS=true), cache config, serve on :8000
# worker: run the queue worker (agent turns and approval resumes)
# anything else: run it, e.g. `php artisan demo:reset`
set -e

case "$1" in
  web)
    if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
      php artisan migrate --force
    fi
    php artisan optimize
    exec frankenphp php-server --listen :8000 --root public/
    ;;
  worker)
    php artisan optimize
    # One try per job: the jobs themselves decide what is safe to repeat.
    exec php artisan queue:work --tries=1 --sleep=1 --max-time=3600
    ;;
  *)
    exec "$@"
    ;;
esac
