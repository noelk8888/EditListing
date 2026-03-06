#!/bin/bash
echo "🧹 Checking for ghost processes..."
# Find all Next.js dev processes, excluding the current script's PID and its parent shell
CURRENT_PID=$$
PARENT_PID=$PPID
PIDS=$(ps aux | grep "next dev" | grep -v grep | awk '{print $2}' | grep -v "$CURRENT_PID" | grep -v "$PARENT_PID")

if [ -n "$PIDS" ]; then
  echo "Stopping ghost processes: $PIDS"
  echo "$PIDS" | xargs kill -9 2>/dev/null || true
fi
echo "✅ Environment clean."
