#!/bin/sh
set -eu

: "${APP_PATH:?Set APP_PATH to the unpacked RAPP Zoo.app bundle}"
ZIP_PATH="${ZIP_PATH:-}"
CDP_PORT="${RAPP_ZOO_CDP_PORT:-9224}"
EXECUTABLE="$APP_PATH/Contents/MacOS/RAPP Zoo"
UNPACKED="$APP_PATH/Contents/Resources/app.asar.unpacked"
LOG_PATH="${TMPDIR:-/tmp}/dimensional-bottles-codesign-app.log"
APP_PID=""

cleanup() {
  if [ -n "$APP_PID" ] && kill -0 "$APP_PID" 2>/dev/null; then
    kill -TERM "$APP_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

echo "captured_utc=$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "app_path=<RAPP_ZOO_APP>"
echo "command=codesign --verify --deep --strict --verbose=2 <RAPP_ZOO_APP>"
codesign --verify --deep --strict --verbose=2 "$APP_PATH"
echo "prelaunch_signature_status=0"

echo "command=find <RAPP_ZOO_APP>/Contents/Resources/app.asar.unpacked -name __pycache__ -o -name '*.pyc'"
BEFORE_COUNT="$(find "$UNPACKED" \( -name '__pycache__' -o -name '*.pyc' \) | wc -l | tr -d ' ')"
echo "prelaunch_bytecode_count=$BEFORE_COUNT"

echo "command=RAPP_ZOO_HEADLESS=1 RAPP_ZOO_DESKTOP_DEV=1 RAPP_ZOO_CDP_PORT=$CDP_PORT <RAPP_ZOO_APP>/Contents/MacOS/RAPP\\ Zoo"
RAPP_ZOO_HEADLESS=1 \
RAPP_ZOO_DESKTOP_DEV=1 \
RAPP_ZOO_CDP_PORT="$CDP_PORT" \
"$EXECUTABLE" >"$LOG_PATH" 2>&1 &
APP_PID=$!
echo "launch_pid=$APP_PID"
echo "launch_utc=$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

READY=0
for _ in $(seq 1 90); do
  if curl -fsS http://127.0.0.1:7070/api/health >/dev/null 2>&1 \
    && curl -fsS http://127.0.0.1:7072/health >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 1
done
echo "runtime_health_status=$READY"
if [ "$READY" -ne 1 ]; then
  echo "runtime_log_begin"
  tail -100 "$LOG_PATH" || true
  echo "runtime_log_end"
  exit 1
fi

kill -TERM "$APP_PID"
for _ in $(seq 1 30); do
  if ! kill -0 "$APP_PID" 2>/dev/null; then
    break
  fi
  sleep 1
done
if kill -0 "$APP_PID" 2>/dev/null; then
  kill -KILL "$APP_PID"
fi
wait "$APP_PID" 2>/dev/null || true
APP_PID=""
echo "shutdown_utc=$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

echo "command=codesign --verify --deep --strict --verbose=2 <RAPP_ZOO_APP>"
codesign --verify --deep --strict --verbose=2 "$APP_PATH"
echo "postlaunch_signature_status=0"
echo "command=codesign -dv --verbose=2 <RAPP_ZOO_APP>"
codesign -dv --verbose=2 "$APP_PATH"

echo "command=find <RAPP_ZOO_APP>/Contents/Resources/app.asar.unpacked -name __pycache__ -o -name '*.pyc'"
AFTER_COUNT="$(find "$UNPACKED" \( -name '__pycache__' -o -name '*.pyc' \) | wc -l | tr -d ' ')"
echo "postlaunch_bytecode_count=$AFTER_COUNT"

if [ -n "$ZIP_PATH" ]; then
  echo "command=shasum -a 256 <RAPP_ZOO_RELEASE_ZIP>"
  shasum -a 256 "$ZIP_PATH" | sed 's#  .*#  <RAPP_ZOO_RELEASE_ZIP>#'
fi

if [ "$BEFORE_COUNT" -ne 0 ] || [ "$AFTER_COUNT" -ne 0 ]; then
  echo "bytecode_check=failed"
  exit 1
fi
echo "bytecode_check=passed"
