# Docker Deployment Guide for Fischer Auction Notifier

This guide explains how to run the Fischer auction notifier using Docker, with configuration via environment variables.

## Table of Contents

- [Quick Start](#quick-start)
- [Prerequisites](#prerequisites)
- [Configuration](#configuration)
- [Running with Docker Compose](#running-with-docker-compose)
- [Running with Docker CLI](#running-with-docker-cli)
- [Environment Variables](#environment-variables)
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

2. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

3. Edit `.env` and set your configuration:
   ```bash
   nano .env  # or use your preferred editor
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

The application can be configured entirely through environment variables. Create a `.env` file in the project root with your settings.

### Required Variables

- `WEBHOOK_URL`: Your Discord webhook URL
- `NATIONS`: Comma-separated list of nation names to monitor

### Optional Variables

See [Environment Variables](#environment-variables) section below for all options.

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

You can customize the `docker-compose.yml` file to suit your needs:

```yaml
version: '3.8'

services:
  fischer:
    build: .
    image: fischer-notifier:latest
    container_name: fischer-notifier
    env_file:
      - .env
    volumes:
      - ./snapshot:/app/snapshot
      - ./config:/app/config
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      # Override specific variables here if needed
      - DEBUG_MODE=true
```

## Running with Docker CLI

You can also run the container using Docker commands directly:

### Build the Image

```bash
docker build -t fischer-notifier:latest .
```

### Run Once (No Scheduling)

```bash
docker run --rm \
  --env-file .env \
  -v $(pwd)/snapshot:/app/snapshot \
  fischer-notifier:latest
```

### Run with Scheduling

```bash
docker run -d \
  --name fischer-notifier \
  --env-file .env \
  -v $(pwd)/snapshot:/app/snapshot \
  -v $(pwd)/config:/app/config \
  --restart unless-stopped \
  fischer-notifier:latest
```

### Run with Manual Environment Variables

```bash
docker run -d \
  --name fischer-notifier \
  -e WEBHOOK_URL="https://discord.com/api/webhooks/..." \
  -e NATIONS="Nation1,Nation2,Nation3" \
  -e SCHEDULE="*/15 * * * *" \
  -v $(pwd)/snapshot:/app/snapshot \
  --restart unless-stopped \
  fischer-notifier:latest
```

## Environment Variables

### Core Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `WEBHOOK_URL` | **Yes** | - | Discord webhook URL for notifications |
| `NATIONS` | **Yes** | - | Comma-separated list of nations to monitor |
| `USER_AGENT` | **Yes** | - | **REQUIRED**: Your nation name for API requests (NationStates API compliance) |

### Notification Settings

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MENTION` | No | - | Discord mention (e.g., `<@&ROLE_ID>` or `<@USER_ID>`) |
| `NO_PING` | No | `false` | When `true`, sends messages without @mentions |
| `DEBUG_MODE` | No | `false` | Enable additional logging |

### Auction Monitoring

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SNAPSHOT_PATH` | No | `./snapshot/auction_snapshot.json` | Path for auction snapshot file |
| `CHECK_SNAPSHOT` | No | `false` | Only send messages for new auctions |

**Note:** CTE (Ceased To Exist) checking is automatic and quota-free using the [unsmurf currentNations.txt](https://raw.githubusercontent.com/ns-rot/unsmurf/refs/heads/main/public/static/currentNations.txt) file.

### Scheduling

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SCHEDULE` | No | - | Cron expression for scheduled runs (e.g., `*/15 * * * *`) |

**Note:** If `SCHEDULE` is not set, the container will run the notifier once and exit.

## Scheduling

The application supports automatic scheduling using cron expressions.

### Common Cron Patterns

```bash
# Every 15 minutes
SCHEDULE=*/15 * * * *

# Every hour
SCHEDULE=0 * * * *

# Every 30 minutes
SCHEDULE=*/30 * * * *

# Every day at midnight UTC
SCHEDULE=0 0 * * *

# Every hour during business hours (9 AM - 5 PM UTC)
SCHEDULE=0 9-17 * * *
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

#### Container Exits Immediately

**Cause:** Missing required environment variables.

**Solution:** Ensure `WEBHOOK_URL` and `NATIONS` are set in your `.env` file.

#### No Messages Sent

**Causes:**
1. No active auctions for monitored nations
2. `CHECK_SNAPSHOT=true` and no new auctions since last run

**Solution:** 
- Check logs for "No active auctions" message
- Try setting `CHECK_SNAPSHOT=false` to see all auctions
- Verify nations are spelled correctly

#### Cron Not Running

**Cause:** Invalid cron expression in `SCHEDULE` variable.

**Solution:** Verify your cron expression using a cron validator.

#### Permission Errors with Volumes

**Cause:** Docker volume mount permissions.

**Solution:**
```bash
# Create directories with correct permissions
mkdir -p snapshot config
chmod 777 snapshot config
```

### Debug Mode

Enable debug mode for verbose logging:

```bash
# In .env file
DEBUG_MODE=true

# Or inline
docker run -e DEBUG_MODE=true ...
```

### Checking Configuration

View the generated configuration:

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
