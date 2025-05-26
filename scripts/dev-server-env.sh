#!/bin/bash

# Script to close all Next.js servers and start a fresh one on port 3000 with environment variables

echo "🔍 Checking for running Next.js servers..."

# Find and kill all Next.js development servers
NEXT_PIDS=$(ps aux | grep "next dev" | grep -v grep | awk '{print $2}')

if [ -n "$NEXT_PIDS" ]; then
    echo "🛑 Found running Next.js servers. Stopping them..."
    echo "$NEXT_PIDS" | xargs kill -9
    echo "✅ All Next.js servers stopped"
else
    echo "ℹ️  No running Next.js servers found"
fi

# Wait a moment for ports to be released
sleep 2

# Check if port 3000 is still in use and kill any process using it
PORT_3000_PID=$(lsof -ti:3000)
if [ -n "$PORT_3000_PID" ]; then
    echo "🔧 Port 3000 is still in use. Killing process $PORT_3000_PID..."
    kill -9 $PORT_3000_PID
    sleep 1
fi

echo "🚀 Starting fresh Next.js server on port 3000 with environment variables..."

# Start the development server with environment variables
npm run dev:env 