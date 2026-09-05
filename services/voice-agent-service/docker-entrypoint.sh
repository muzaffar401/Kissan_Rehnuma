#!/bin/sh
# Voice agent entrypoint — runs Alembic migrations (with retry while
# postgres finishes booting), then starts the requested process.
set -e

if [ "$1" = "agent" ]; then
    n=0
    until [ $n -ge 5 ]; do
        if alembic upgrade head; then
            echo "[voice-agent] Migrations applied successfully."
            break
        fi
        n=$((n+1))
        echo "[voice-agent] Migration attempt $n failed — retrying in 5s"
        sleep 5
    done

    if [ $n -ge 5 ]; then
        echo "[voice-agent] Migrations failed after 5 attempts, exiting."
        exit 1
    fi

    # "start" runs the production worker: registers with LiveKit
    # Cloud and waits for dispatched room jobs.
    exec python -m app.main start
elif [ "$1" = "token-server" ]; then
    exec python token_server.py
else
    exec "$@"
fi
