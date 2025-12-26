#!/bin/sh
# entrypoint.sh - Docker entrypoint script for Fischer notifier
# Reads config.json with multiple named configurations
# Each config can specify its own schedule

set -e

# Create snapshot directory
mkdir -p /app/snapshot

# Check if config.json exists
if [ ! -f "/app/config.json" ]; then
    echo "Error: /app/config.json not found!"
    echo ""
    echo "Please mount a config.json file to /app/config.json"
    echo "Example: -v ./config.json:/app/config.json:ro"
    echo ""
    echo "The file should contain named configurations:"
    echo '{'
    echo '  "major": {'
    echo '    "webhook_url": "https://discord.com/api/webhooks/...",  '
    echo '    "nations": ["Nation1", "Nation2"],'
    echo '    "user_agent": "YourNation",'
    echo '    "schedule": "0 * * * *"'
    echo '  },'
    echo '  "minor": {'
    echo '    "webhook_url": "https://discord.com/api/webhooks/...",  '
    echo '    "nations": ["Nation1", "Nation2"],'
    echo '    "user_agent": "YourNation",'
    echo '    "schedule": "*/10 * * * *"'
    echo '  }'
    echo '}'
    exit 1
fi

echo "Loading configuration from /app/config.json"

# Create scheduler script that reads the single config file
cat > /app/scheduler.js << 'SCHEDULER_EOF'
import { spawn } from 'child_process';
import fs from 'fs';

// Parse cron expression
function parseSchedule(cronExpr) {
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length !== 5) {
    console.error(`Invalid cron expression: ${cronExpr}`);
    return null;
  }
  return parts;
}

function matches(cronPart, currentValue, max) {
  if (cronPart === '*') return true;
  if (cronPart.includes('/')) {
    const [base, step] = cronPart.split('/');
    const stepNum = parseInt(step);
    if (base === '*') {
      return currentValue % stepNum === 0;
    } else {
      const baseNum = parseInt(base);
      return currentValue >= baseNum && (currentValue - baseNum) % stepNum === 0;
    }
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

function matchesSchedule(cronParts, now) {
  const [minute, hour, dayOfMonth, month, dayOfWeek] = cronParts;
  
  const currentMinute = now.getMinutes();
  const currentHour = now.getHours();
  const currentDay = now.getDate();
  const currentMonth = now.getMonth() + 1;
  const currentWeekday = now.getDay();
  
  return matches(minute, currentMinute, 59) &&
         matches(hour, currentHour, 23) &&
         matches(dayOfMonth, currentDay, 31) &&
         matches(month, currentMonth, 12) &&
         (dayOfWeek === '*' || matches(dayOfWeek, currentWeekday, 6));
}

// Load config.json with all configurations
const configPath = '/app/config.json';
let allConfigs;

try {
  const configFile = fs.readFileSync(configPath, 'utf8');
  allConfigs = JSON.parse(configFile);
  
  if (typeof allConfigs !== 'object' || allConfigs === null || Array.isArray(allConfigs)) {
    throw new Error('config.json must be an object with named configurations');
  }
} catch (error) {
  console.error(`Error loading config.json: ${error.message}`);
  process.exit(1);
}

const configNames = Object.keys(allConfigs);
console.log(`Loaded ${configNames.length} configuration(s): ${configNames.join(', ')}`);

// Parse configs and their schedules
const scheduledConfigs = [];
const onDemandConfigs = [];

Object.entries(allConfigs).forEach(([name, config]) => {
  if (config.schedule) {
    const cronParts = parseSchedule(config.schedule);
    if (cronParts) {
      scheduledConfigs.push({
        name: name,
        config: config,
        schedule: config.schedule,
        cronParts: cronParts,
        lastRun: null
      });
      console.log(`  ${name}: scheduled (${config.schedule})`);
    } else {
      console.error(`  ${name}: invalid schedule, treating as on-demand`);
      onDemandConfigs.push({ name: name, config: config });
    }
  } else {
    onDemandConfigs.push({ name: name, config: config });
    console.log(`  ${name}: on-demand (no schedule)`);
  }
});

// Function to run a specific config
function runConfig(name, config) {
  // Create a temporary config file for this specific config
  const tempConfigPath = `/tmp/config-${name}.json`;
  fs.writeFileSync(tempConfigPath, JSON.stringify(config, null, 2));
  
  const child = spawn('node', ['main.js', tempConfigPath], {
    stdio: 'inherit',
    cwd: '/app'
  });
  
  return child;
}

// If no scheduled configs, run all on-demand configs once and exit
if (scheduledConfigs.length === 0) {
  console.log('\nNo scheduled configs found. Running all configs once...');
  
  // Run all configs sequentially
  let index = 0;
  function runNext() {
    if (index >= configNames.length) {
      console.log('Completed running all configs');
      process.exit(0);
      return;
    }
    
    const name = configNames[index];
    const config = allConfigs[name];
    console.log(`\nRunning ${name}...`);
    
    const child = runConfig(name, config);
    child.on('exit', (code) => {
      console.log(`${name} finished (exit code: ${code})`);
      index++;
      runNext();
    });
  }
  
  runNext();
} else {
  // Run scheduler
  console.log('\nStarting scheduler...');
  
  // Run immediately for configs that match current time
  const now = new Date();
  scheduledConfigs.forEach(cfg => {
    if (matchesSchedule(cfg.cronParts, now)) {
      console.log(`[${now.toISOString()}] Running ${cfg.name} (matches current time)`);
      runConfig(cfg.name, cfg.config);
      cfg.lastRun = `${now.getHours()}:${now.getMinutes()}`;
    }
  });
  
  // Check every minute
  setInterval(() => {
    const now = new Date();
    const currentTimeKey = `${now.getHours()}:${now.getMinutes()}`;
    
    scheduledConfigs.forEach(cfg => {
      // Only run once per minute
      if (cfg.lastRun !== currentTimeKey && matchesSchedule(cfg.cronParts, now)) {
        cfg.lastRun = currentTimeKey;
        console.log(`[${now.toISOString()}] Running ${cfg.name}`);
        
        const child = runConfig(cfg.name, cfg.config);
        
        child.on('exit', (code) => {
          console.log(`[${new Date().toISOString()}] ${cfg.name} finished (exit code: ${code})`);
        });
      }
    });
  }, 60000); // Check every minute
  
  console.log('Scheduler running. Press Ctrl+C to exit.');
}
SCHEDULER_EOF

# Run the scheduler
exec node /app/scheduler.js
