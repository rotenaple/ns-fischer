#!/bin/sh
# entrypoint.sh - Docker entrypoint script for Fischer notifier
# Reads all config files from /app/configs directory
# Each config can specify its own schedule

set -e

# Create necessary directories
mkdir -p /app/snapshot /app/configs

# Check if configs directory has any JSON files
if [ ! "$(ls -A /app/configs/*.json 2>/dev/null)" ]; then
    echo "Error: No JSON configuration files found in /app/configs/"
    echo ""
    echo "Please mount a directory with config files to /app/configs"
    echo "Example: -v ./configs:/app/configs"
    echo ""
    echo "Each config file should be a JSON file with the following structure:"
    echo '{'
    echo '  "webhook_url": "https://discord.com/api/webhooks/...",  '
    echo '  "nations": ["Nation1", "Nation2"],'
    echo '  "user_agent": "YourNation",'
    echo '  "schedule": "*/15 * * * *"  // Optional: cron expression'
    echo '}'
    exit 1
fi

echo "Found configuration files in /app/configs:"
ls -1 /app/configs/*.json

# Create scheduler script
cat > /app/scheduler.js << 'SCHEDULER_EOF'
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Parse cron expression to determine if current time matches
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

// Load all configs
const configsDir = '/app/configs';
const configFiles = fs.readdirSync(configsDir)
  .filter(f => f.endsWith('.json'))
  .map(f => path.join(configsDir, f));

console.log(`Loaded ${configFiles.length} configuration file(s)`);

// Parse configs and their schedules
const scheduledConfigs = [];
const onDemandConfigs = [];

configFiles.forEach(configPath => {
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const configName = path.basename(configPath);
    
    if (config.schedule) {
      const cronParts = parseSchedule(config.schedule);
      if (cronParts) {
        scheduledConfigs.push({
          name: configName,
          path: configPath,
          schedule: config.schedule,
          cronParts: cronParts,
          lastRun: null
        });
        console.log(`  ${configName}: scheduled (${config.schedule})`);
      } else {
        console.error(`  ${configName}: invalid schedule, treating as on-demand`);
        onDemandConfigs.push({ name: configName, path: configPath });
      }
    } else {
      onDemandConfigs.push({ name: configName, path: configPath });
      console.log(`  ${configName}: on-demand (no schedule)`);
    }
  } catch (error) {
    console.error(`Error loading ${configPath}: ${error.message}`);
  }
});

// If no scheduled configs, run all on-demand configs once and exit
if (scheduledConfigs.length === 0) {
  console.log('\nNo scheduled configs found. Running all configs once...');
  
  const configPaths = configFiles.join(' ');
  const child = spawn('node', ['main.js', ...configFiles], {
    stdio: 'inherit',
    cwd: '/app'
  });
  
  child.on('exit', (code) => {
    console.log(`Completed with exit code ${code}`);
    process.exit(code);
  });
} else {
  // Run scheduler
  console.log('\nStarting scheduler...');
  
  // Run immediately for configs that match current time
  const now = new Date();
  scheduledConfigs.forEach(cfg => {
    if (matchesSchedule(cfg.cronParts, now)) {
      console.log(`[${now.toISOString()}] Running ${cfg.name} (matches current time)`);
      const child = spawn('node', ['main.js', cfg.path], {
        stdio: 'inherit',
        cwd: '/app'
      });
      cfg.lastRun = now.getMinutes();
    }
  });
  
  // Check every minute
  setInterval(() => {
    const now = new Date();
    const currentMinute = now.getMinutes();
    
    scheduledConfigs.forEach(cfg => {
      // Only run once per minute
      if (cfg.lastRun !== currentMinute && matchesSchedule(cfg.cronParts, now)) {
        cfg.lastRun = currentMinute;
        console.log(`[${now.toISOString()}] Running ${cfg.name}`);
        
        const child = spawn('node', ['main.js', cfg.path], {
          stdio: 'inherit',
          cwd: '/app'
        });
        
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
