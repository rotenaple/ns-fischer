#!/bin/sh
# entrypoint.sh - Docker entrypoint script for Fischer notifier

set -e

# Create config directory if it doesn't exist
mkdir -p /app/config /app/snapshot

# Function to generate config.json from environment variables using Node.js
generate_config() {
    node -e "
const config = {
  webhook_url: process.env.WEBHOOK_URL || '',
  nations: (process.env.NATIONS || '').split(',').map(n => n.trim()).filter(n => n),
  debug_mode: process.env.DEBUG_MODE === 'true',
  mention: process.env.MENTION || '',
  no_ping: process.env.NO_PING === 'true',
  check_cte: process.env.CHECK_CTE !== 'false',
  snapshot_path: process.env.SNAPSHOT_PATH || './snapshot/auction_snapshot.json',
  check_snapshot: process.env.CHECK_SNAPSHOT === 'true',
  user_agent: process.env.USER_AGENT || ''
};
console.log(JSON.stringify(config, null, 2));
" > /app/config/config.json
}

# Check if required environment variables are set
if [ -z "$WEBHOOK_URL" ] || [ -z "$NATIONS" ]; then
    echo "Error: WEBHOOK_URL and NATIONS environment variables are required!"
    echo "Please set these variables in your .env file or docker-compose.yml"
    exit 1
fi

# Generate configuration file
generate_config

echo "Configuration file generated at /app/config/config.json"

# If SCHEDULE is set, use a simple loop-based scheduler, otherwise run once
if [ -n "$SCHEDULE" ]; then
    echo "Scheduled mode enabled. Using node-cron for scheduling..."
    
    # Create a simple scheduler using Node.js
    node -e "
const { spawn } = require('child_process');
const schedule = process.env.SCHEDULE || '*/15 * * * *';

console.log('Schedule pattern:', schedule);
console.log('Starting scheduler...');

// Simple cron-like parser - for common patterns
function parseSchedule(cronExpr) {
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length !== 5) {
    console.error('Invalid cron expression. Expected 5 parts (minute hour day month weekday)');
    process.exit(1);
  }
  return parts;
}

function matchesSchedule(cronParts, now) {
  const [minute, hour, dayOfMonth, month, dayOfWeek] = cronParts;
  
  const currentMinute = now.getMinutes();
  const currentHour = now.getHours();
  const currentDay = now.getDate();
  const currentMonth = now.getMonth() + 1;
  const currentWeekday = now.getDay();
  
  function matches(cronPart, currentValue, max) {
    if (cronPart === '*') return true;
    if (cronPart.includes('/')) {
      const [base, step] = cronPart.split('/');
      const stepNum = parseInt(step);
      return currentValue % stepNum === 0;
    }
    if (cronPart.includes(',')) {
      return cronPart.split(',').some(p => parseInt(p) === currentValue);
    }
    if (cronPart.includes('-')) {
      const [start, end] = cronPart.split('-').map(Number);
      return currentValue >= start && currentValue <= end;
    }
    return parseInt(cronPart) === currentValue;
  }
  
  return matches(minute, currentMinute, 59) &&
         matches(hour, currentHour, 23) &&
         matches(dayOfMonth, currentDay, 31) &&
         matches(month, currentMonth, 12) &&
         (dayOfWeek === '*' || matches(dayOfWeek, currentWeekday, 6));
}

const cronParts = parseSchedule(schedule);
let lastRun = null;

function runTask() {
  const now = new Date();
  console.log(\`[\${now.toISOString()}] Running notifier...\`);
  
  const child = spawn('node', ['main.js', '/app/config/config.json'], {
    stdio: 'inherit',
    cwd: '/app'
  });
  
  child.on('exit', (code) => {
    console.log(\`[\${new Date().toISOString()}] Notifier finished with code \${code}\`);
  });
}

// Check every minute
setInterval(() => {
  const now = new Date();
  const currentMinute = now.getMinutes();
  
  // Only run once per minute
  if (lastRun !== currentMinute && matchesSchedule(cronParts, now)) {
    lastRun = currentMinute;
    runTask();
  }
}, 60000); // Check every minute

console.log('Scheduler running. Press Ctrl+C to exit.');

// Run immediately if it matches current time
const now = new Date();
if (matchesSchedule(cronParts, now)) {
  console.log('Running immediately as schedule matches current time...');
  runTask();
}
"
else
    echo "No SCHEDULE set, running once..."
    exec node main.js /app/config/config.json
fi
