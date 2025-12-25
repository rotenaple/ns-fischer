# Docker Quick Reference

## Quick Start

```bash
# 1. Copy and configure
cp config.json.example config.json
nano config.json  # Edit with your settings

# 2. Run with Docker Compose
docker-compose up -d

# 3. View logs
docker-compose logs -f

# 4. Stop
docker-compose down
```

## Essential Commands

```bash
# Build image
docker-compose build

# Restart after config changes
docker-compose restart

# View real-time logs
docker-compose logs -f fischer

# Check status
docker-compose ps

# Run once without scheduling
docker run --rm -v $(pwd)/configs:/app/configs -v $(pwd)/snapshot:/app/snapshot fischer-notifier:latest
```

## Configuration File (Required)

All configuration is in a single `config.json` file with named sections:

```json
{
  "major": {
    "webhook_url": "https://discord.com/api/webhooks/YOUR_ID/YOUR_TOKEN",
    "nations": ["Nation1", "Nation2"],
    "user_agent": "YourMainNation",
    "schedule": "0 * * * *"
  },
  "minor": {
    "webhook_url": "https://discord.com/api/webhooks/YOUR_ID/YOUR_TOKEN",
    "nations": ["Nation1", "Nation2"],
    "user_agent": "YourMainNation",
    "schedule": "*/10 * * * *",
    "no_ping": true
  }
}
```

**Required fields:**
- `webhook_url` - Discord webhook URL
- `nations` - Array of nations to monitor
- `user_agent` - Your nation name (NationStates API compliance)

**Optional:**
- `schedule` - Cron expression (e.g., `"0 * * * *"`)
- `mention` - Discord role/user to ping
- `check_snapshot` - Only notify on new auctions
- `debug_mode` - Verbose logging

## Common Schedules

Add to your config's `schedule` field:

```json
{
  "schedule": "*/15 * * * *"  // Every 15 minutes
}
```

Common patterns:
- `"0 * * * *"` - Every hour
- `"*/15 * * * *"` - Every 15 minutes
- `"*/30 * * * *"` - Every 30 minutes
- `"0 12 * * *"` - Every day at noon UTC
- `"10,20,30,40,50 * * * *"` - Every 10 min except on the hour

## Troubleshooting

**No messages sent?**
- Check logs: `docker-compose logs -f`
- Verify webhook_url is correct in your config
- Set `"check_snapshot": false` to see all auctions
- Set `"debug_mode": true` for verbose logging

**Container exits immediately?**
- Check that configs directory has .json files
- View logs: `docker logs fischer-notifier`
- Ensure required fields are set (webhook_url, nations, user_agent)

**See loaded configs:**
```bash
docker logs fischer-notifier | head -20
```

For complete documentation, see [DOCKER.md](DOCKER.md) and [configs/README.md](configs/README.md)
