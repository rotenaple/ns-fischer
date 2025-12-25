# Docker Deployment Guide for Fischer Auction Notifier

This guide explains how to run the Fischer auction notifier using Docker with centralized JSON configuration.

## Table of Contents

- [Quick Start](#quick-start)
- [Prerequisites](#prerequisites)
- [Configuration](#configuration)
- [Running with Docker Compose](#running-with-docker-compose)
- [Running with Docker CLI](#running-with-docker-cli)
- [Scheduling](#scheduling)
- [Volumes and Persistence](#volumes-and-persistence)
- [Troubleshooting](#troubleshooting)
- [Advanced Usage](#advanced-usage)

## Quick Start

1. Clone the repository:
   ```bash
   git clone https://github.com/rotenaple/fischer.git
   cd fischer
   ```

2. Create your configuration file:
   ```bash
   cp config.json.example config.json
   ```

3. Edit config.json with your settings:
   ```bash
   nano config.json  # or use your preferred editor
   ```

4. Run with Docker Compose:
   ```bash
   docker-compose up -d
   ```

## Prerequisites

- Docker (version 20.10 or later)
- Docker Compose (version 1.29 or later)
- A Discord webhook URL

## Configuration

All configuration is done via a single `config.json` file with named sections. Each section can specify its own schedule, webhook, nations, and other settings.

**No environment variables or `.env` file needed!**

### Configuration File Structure

Create `config.json` with named configurations:

```json
{
  "major": {
    "webhook_url": "https://discord.com/api/webhooks/...",
    "nations": ["Nation1", "Nation2"],
    "user_agent": "YourMainNation",
    "schedule": "0 * * * *",
    "mention": "<@&ROLE_ID>",
    "check_snapshot": true,
    "snapshot_path": "./snapshot/major.json"
  },
  "minor": {
    "webhook_url": "https://discord.com/api/webhooks/...",
    "nations": ["Nation1", "Nation2"],
    "user_agent": "YourMainNation",
    "schedule": "*/10 * * * *",
    "no_ping": true,
    "snapshot_path": "./snapshot/minor.json"
  }
}
```

You can add as many named configurations as you want (major, minor, alerts, etc.).

### Required Fields

- **webhook_url**: Your Discord webhook URL
- **nations**: Array of nation names to monitor
- **user_agent**: Your nation name (required for NationStates API compliance)

### Optional Fields

- **schedule**: Cron expression for when to run (e.g., `"0 * * * *"` for hourly)
  - If omitted, the config runs once on container startup
- **mention**: Discord role/user to mention
- **no_ping**: Set to `true` to send messages without pinging
- **check_snapshot**: Only send messages for new auctions
- **snapshot_path**: Path to snapshot file
- **debug_mode**: Enable verbose logging

See `config.json.example` for a complete example with comments.

## Running with Docker Compose

Docker Compose is the recommended way to run the application.

### Basic Usage

```bash
# Build and start the container
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the container
docker-compose down

# Restart the container
docker-compose restart

# Rebuild after code changes
docker-compose up -d --build
```

### Custom docker-compose.yml

The default configuration mounts the `configs/` directory:

```yaml
version: '3.8'

services:
  fischer:
    build: .
    image: fischer-notifier:latest
    container_name: fischer-notifier
    volumes:
      - ./snapshot:/app/snapshot
      - ./configs:/app/configs
    restart: unless-stopped
    environment:
      - NODE_ENV=production
```

## Running with Docker CLI

You can also run the container using Docker commands directly:

### Build the Image

```bash
docker build -t fischer-notifier:latest .
```

### Run with Config Directory

```bash
docker run -d \
  --name fischer-notifier \
  -v $(pwd)/snapshot:/app/snapshot \
  -v $(pwd)/configs:/app/configs \
  --restart unless-stopped \
  fischer-notifier:latest
```

### Run Once (No Scheduling)

For configs without a `schedule` field, or to test:

```bash
docker run --rm \
  -v $(pwd)/configs:/app/configs \
  -v $(pwd)/snapshot:/app/snapshot \
  fischer-notifier:latest
```

```

## Scheduling

Scheduling is now done per-config within each JSON file. Each config can have its own schedule.

### Adding a Schedule to a Config

Simply add a `schedule` field with a cron expression:

```json
{
  "webhook_url": "...",
  "nations": ["Nation1"],
  "user_agent": "YourNation",
  "schedule": "0 * * * *"
}
```

### Common Cron Patterns

```
*/15 * * * *  - Every 15 minutes
0 * * * *     - Every hour (on the hour)
*/30 * * * *  - Every 30 minutes
0 0 * * *     - Every day at midnight UTC
0 9-17 * * *  - Every hour from 9 AM to 5 PM UTC
10,20,30,40,50 * * * * - Every 10 minutes except on the hour
```

### Cron Expression Format

```
* * * * *
│ │ │ │ │
│ │ │ │ └─── Day of week (0-7, Sunday = 0 or 7)
│ │ │ └───── Month (1-12)
│ │ └─────── Day of month (1-31)
│ └───────── Hour (0-23)
└─────────── Minute (0-59)
```

### Running Without Scheduling

To run the notifier once without scheduling, either:

1. Don't set the `SCHEDULE` variable
2. Use `docker run` with `--rm` flag for a one-time execution

## Volumes and Persistence

The application uses volumes to persist data between container restarts.

### Snapshot Directory

The snapshot directory stores information about previously seen auctions:

```yaml
volumes:
  - ./snapshot:/app/snapshot
```

This ensures that the application can track which auctions are new across container restarts.

### Config Directory

The config directory contains the generated configuration file:

```yaml
volumes:
  - ./config:/app/config
```

**Note:** This is automatically generated from environment variables and generally doesn't need to be manually modified.

## Troubleshooting

### Viewing Logs

```bash
# Docker Compose
docker-compose logs -f

# Docker CLI
docker logs -f fischer-notifier
```

### Common Issues

### Common Issues

#### Container Exits Immediately

**Cause:** No configuration files found in `/app/configs`.

**Solution:** Ensure you've mounted the configs directory and it contains `.json` files:
```bash
docker run -v $(pwd)/configs:/app/configs ...
```

#### No Messages Sent

**Causes:**
1. No active auctions for monitored nations
2. `check_snapshot: true` and no new auctions since last run

**Solution:** 
- Check logs for "No active auctions" message
- Try setting `check_snapshot: false` in your config to see all auctions
- Verify nations are spelled correctly

#### Invalid Schedule

**Cause:** Invalid cron expression in config's `schedule` field.

**Solution:** Verify your cron expression using a cron validator. The config will run once on startup if the schedule is invalid.

#### Permission Errors with Volumes

**Cause:** Docker volume mount permissions.

**Solution:**
```bash
# Create directories with correct permissions
mkdir -p snapshot configs
chmod 755 snapshot configs
```

### Debug Mode

Enable debug mode in your config file:

```json
{
  "webhook_url": "...",
  "nations": ["Nation1"],
  "user_agent": "YourNation",
  "debug_mode": true
}
```

### Checking Configuration

View loaded configurations in the logs:

```bash
docker logs fischer-notifier
```

You'll see output like:
```
Found configuration files in /app/configs:
major-hourly.json
minor-frequent.json

Loaded 2 configuration file(s)
  major-hourly.json: scheduled (0 * * * *)
  minor-frequent.json: scheduled (*/10 * * * *)
```

### Manual Test Run

Test a configuration manually:

```bash
docker run --rm \
  -v $(pwd)/configs:/app/configs \
  -v $(pwd)/snapshot:/app/snapshot \
  fischer-notifier:latest

```bash
docker exec fischer-notifier cat /app/config/config.json
```

### Manual Test Run

Test the configuration without scheduling:

```bash
docker run --rm \
  --env-file .env \
  -e SCHEDULE="" \
  fischer-notifier:latest
```

## Advanced Usage

### Multiple Configurations

You can run multiple instances with different configurations:

```yaml
version: '3.8'

services:
  fischer-frequent:
    build: .
    image: fischer-notifier:latest
    container_name: fischer-frequent
    environment:
      - WEBHOOK_URL=${WEBHOOK_URL_1}
      - NATIONS=${NATIONS}
      - SCHEDULE=*/15 * * * *
      - CHECK_SNAPSHOT=false
      - NO_PING=true
    volumes:
      - ./snapshot:/app/snapshot
    restart: unless-stopped

  fischer-alerts:
    build: .
    image: fischer-notifier:latest
    container_name: fischer-alerts
    environment:
      - WEBHOOK_URL=${WEBHOOK_URL_2}
      - NATIONS=${NATIONS}
      - SCHEDULE=0 * * * *
      - CHECK_SNAPSHOT=true
      - MENTION=${MENTION}
    volumes:
      - ./snapshot:/app/snapshot
    restart: unless-stopped
```

### Using with Kubernetes

Example Kubernetes deployment:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: fischer-notifier
spec:
  replicas: 1
  selector:
    matchLabels:
      app: fischer-notifier
  template:
    metadata:
      labels:
        app: fischer-notifier
    spec:
      containers:
      - name: fischer
        image: fischer-notifier:latest
        env:
        - name: WEBHOOK_URL
          valueFrom:
            secretKeyRef:
              name: fischer-secrets
              key: webhook-url
        - name: NATIONS
          value: "Nation1,Nation2"
        - name: SCHEDULE
          value: "*/15 * * * *"
        volumeMounts:
        - name: snapshot
          mountPath: /app/snapshot
      volumes:
      - name: snapshot
        persistentVolumeClaim:
          claimName: fischer-snapshot-pvc
```

### Health Checks

Add health checks to your docker-compose.yml:

```yaml
services:
  fischer:
    # ... other configuration ...
    healthcheck:
      test: ["CMD", "test", "-f", "/app/config/config.json"]
      interval: 1m
      timeout: 10s
      retries: 3
```

### Resource Limits

Limit resource usage:

```yaml
services:
  fischer:
    # ... other configuration ...
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M
        reservations:
          cpus: '0.25'
          memory: 128M
```

## Support

For issues and questions:
- Check the [main README](README.md)
- Review application logs
- Open an issue on GitHub

## Migration from JSON Config

If you're migrating from the JSON config file approach:

1. Note your existing config values
2. Set equivalent environment variables in `.env`
3. Run with Docker - config.json is auto-generated

Mapping:
```json
// Old config.json
{
  "webhook_url": "...",
  "nations": ["A", "B"]
}

// New .env
WEBHOOK_URL=...
NATIONS=A,B
```
