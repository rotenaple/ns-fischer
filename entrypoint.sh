#!/bin/sh
# entrypoint.sh - Docker entrypoint script for Fischer notifier

set -e

# Create config directory if it doesn't exist
mkdir -p /app/config /app/snapshot

# Function to generate config.json from environment variables
generate_config() {
    cat > /app/config/config.json <<EOF
{
  "webhook_url": "${WEBHOOK_URL}",
  "nations": $(echo "${NATIONS}" | jq -R 'split(",") | map(gsub("^\\s+|\\s+$";""))'),
  "debug_mode": ${DEBUG_MODE:-false},
  "mention": "${MENTION:-}",
  "no_ping": ${NO_PING:-false},
  "check_cte": ${CHECK_CTE:-true},
  "snapshot_path": "${SNAPSHOT_PATH:-./snapshot/auction_snapshot.json}",
  "check_snapshot": ${CHECK_SNAPSHOT:-false},
  "user_agent": "${USER_AGENT:-}"
}
EOF
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

# If SCHEDULE is set, use cron, otherwise run once
if [ -n "$SCHEDULE" ]; then
    echo "Setting up cron job with schedule: $SCHEDULE"
    
    # Create cron job
    echo "$SCHEDULE cd /app && node main.js /app/config/config.json >> /var/log/cron.log 2>&1" > /etc/crontabs/root
    
    # Create log file
    touch /var/log/cron.log
    
    # Start cron in foreground
    echo "Starting cron daemon..."
    crond -f -l 2
else
    echo "No SCHEDULE set, running once..."
    exec node main.js /app/config/config.json
fi
