#!/bin/sh
set -e

echo "[entrypoint] Starting Fluent Bit..."
fluent-bit -c /etc/fluent-bit/fluent-bit.conf &
FLUENT_BIT_PID=$!

echo "[entrypoint] Starting Node.js app on port ${PORT}..."
exec node index.js
