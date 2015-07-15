#!/bin/bash
set -e

exec "/redis-entrypoint.sh"
exec "/rabbitmq-entrypoint.sh"
exec "/mysql-entrypoint.sh"

exec "$@"

