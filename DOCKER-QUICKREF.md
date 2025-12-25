# Docker Quick Reference

## Quick Start

```bash
# 1. Copy and configure environment file
cp .env.example .env
nano .env  # Edit with your settings

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
docker run --rm --env-file .env -v $(pwd)/snapshot:/app/snapshot fischer-notifier:latest
```

## Environment Variables (Required)

```bash
WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_ID/YOUR_TOKEN
NATIONS=Nation1,Nation2,Nation3
USER_AGENT=YourMainNation  # REQUIRED for NationStates API compliance
```

## Common Schedules

```bash
# Every 15 minutes
SCHEDULE=*/15 * * * *

# Every hour
SCHEDULE=0 * * * *

# Every 30 minutes
SCHEDULE=*/30 * * * *

# Every day at noon UTC
SCHEDULE=0 12 * * *
```

## Troubleshooting

**No messages sent?**
- Check logs: `docker-compose logs -f`
- Verify WEBHOOK_URL is correct
- Set `CHECK_SNAPSHOT=false` to see all auctions
- Set `DEBUG_MODE=true` for verbose logging

**Container exits immediately?**
- Check required env vars are set (WEBHOOK_URL, NATIONS, USER_AGENT)
- USER_AGENT is now required for NationStates API compliance
- View logs: `docker logs fischer-notifier`

**See the generated config:**
```bash
docker exec fischer-notifier cat /app/config/config.json
```

For complete documentation, see [DOCKER.md](DOCKER.md)
