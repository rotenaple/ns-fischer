# Fischer Auction Notifier - Unraid Setup Guide

This guide provides step-by-step instructions for running Fischer Auction Notifier on Unraid using Docker.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Detailed Setup](#detailed-setup)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [Updates and Maintenance](#updates-and-maintenance)
- [Advanced Configuration](#advanced-configuration)

## Overview

Fischer Auction Notifier monitors NationStates card auctions and sends notifications to Discord. On Unraid, it runs as a Docker container with:
- Automatic scheduling of multiple configurations
- Persistent storage for auction snapshots
- No database or external dependencies required
- Minimal resource usage

## Prerequisites

- Unraid 6.9 or later
- Discord server with webhook access
- GitHub account (for cloning the repository)
- Basic familiarity with Unraid Docker containers

## Quick Start

### 1. Install from Docker Hub (Coming Soon)

**Note**: For now, you'll need to build the container yourself. Follow the "Detailed Setup" section below.

### 2. Quick Setup via Community Applications

1. Open Unraid web interface
2. Go to **Apps** → **Community Applications**
3. Search for "fischer-notifier" (when available)
4. Click **Install**
5. Configure your settings (see Configuration section)

## Detailed Setup

### Step 1: Prepare Directory Structure

1. Open Unraid terminal (or use SSH)
2. Create a directory for Fischer:

```bash
mkdir -p /mnt/user/appdata/fischer
cd /mnt/user/appdata/fischer
```

3. Create subdirectories:

```bash
mkdir -p snapshot
```

### Step 2: Clone and Build

1. Install git if not already available:

```bash
# Check if git is installed
which git

# If not installed, you can use Nerd Tools plugin or:
# Go to Unraid Apps → Search "Nerd Tools" → Install
# Then enable git in Nerd Tools settings
```

2. Clone the repository:

```bash
cd /mnt/user/appdata/fischer
git clone https://github.com/rotenaple/fischer.git source
cd source
```

3. Build the Docker image:

```bash
docker build -t fischer-notifier:latest .
```

### Step 3: Create Configuration File

1. Create your config.json:

```bash
cd /mnt/user/appdata/fischer
cp source/config.json.example config.json
nano config.json
```

2. Edit the configuration (see Configuration section below)

3. Save and exit (Ctrl+X, then Y, then Enter in nano)

### Step 4: Add Container to Unraid

#### Option A: Using Unraid Web GUI

1. Go to **Docker** tab in Unraid
2. Click **Add Container**
3. Configure as follows:

**Basic Settings:**
- **Name**: `fischer-notifier`
- **Repository**: `fischer-notifier:latest`
- **Network Type**: `bridge`

**Advanced Settings:**
- **Container Path**: `/app/config.json`
  - **Host Path**: `/mnt/user/appdata/fischer/config.json`
  - **Access Mode**: `Read Only`
  
- **Container Path**: `/app/snapshot`
  - **Host Path**: `/mnt/user/appdata/fischer/snapshot`
  - **Access Mode**: `Read/Write`

**Docker Settings:**
- **Privileged**: `No`
- **Console Shell Command**: `sh`

4. Click **Apply**

#### Option B: Using Command Line

```bash
docker run -d \
  --name=fischer-notifier \
  --restart=unless-stopped \
  -v /mnt/user/appdata/fischer/config.json:/app/config.json:ro \
  -v /mnt/user/appdata/fischer/snapshot:/app/snapshot \
  fischer-notifier:latest
```

### Step 5: Verify Installation

1. Check container logs:

```bash
docker logs fischer-notifier
```

You should see output like:
```
Loading configuration from /app/config.json
Loaded 2 configuration(s): major, minor
  major: scheduled (0 * * * *)
  minor: scheduled (10,20,30,40,50 * * * *)

Starting scheduler...
Scheduler running. Press Ctrl+C to exit.
```

## Configuration

### Creating config.json

Your `config.json` file should contain named configurations. Here's a complete example:

```json
{
  "major": {
    "webhook_url": "https://discord.com/api/webhooks/YOUR_ID/YOUR_TOKEN",
    "nations": ["YourNation1", "YourNation2"],
    "user_agent": "YourMainNation",
    "schedule": "0 * * * *",
    "mention": "<@&YOUR_ROLE_ID>",
    "no_ping": false,
    "check_snapshot": true,
    "snapshot_path": "./snapshot/major.json",
    "debug_mode": false
  },
  "minor": {
    "webhook_url": "https://discord.com/api/webhooks/YOUR_ID/YOUR_TOKEN",
    "nations": ["YourNation1", "YourNation2"],
    "user_agent": "YourMainNation",
    "schedule": "10,20,30,40,50 * * * *",
    "no_ping": true,
    "check_snapshot": false,
    "snapshot_path": "./snapshot/minor.json",
    "debug_mode": false
  }
}
```

### Configuration Fields

#### Required Fields

| Field | Description | Example |
|-------|-------------|---------|
| `webhook_url` | Discord webhook URL | `"https://discord.com/api/webhooks/..."` |
| `nations` | Array of nations to monitor | `["Nation1", "Nation2"]` |
| `user_agent` | Your main nation name (API compliance) | `"YourMainNation"` |

#### Optional Fields

| Field | Default | Description |
|-------|---------|-------------|
| `schedule` | - | Cron expression (e.g., `"0 * * * *"` for hourly) |
| `mention` | `""` | Discord role/user to ping (`"<@&ROLE_ID>"`) |
| `no_ping` | `false` | Send messages without pinging |
| `check_snapshot` | `false` | Only notify on new auctions |
| `snapshot_path` | `"./snapshot/auction_snapshot.json"` | Path to snapshot file |
| `debug_mode` | `false` | Enable verbose logging |

### Schedule Examples

The `schedule` field uses standard cron syntax:

```
* * * * *
│ │ │ │ │
│ │ │ │ └─── Day of week (0-7, Sun=0 or 7)
│ │ │ └───── Month (1-12)
│ │ └─────── Day of month (1-31)
│ └───────── Hour (0-23)
└─────────── Minute (0-59)
```

**Common Patterns:**

- `"0 * * * *"` - Every hour on the hour
- `"*/15 * * * *"` - Every 15 minutes
- `"0 */2 * * *"` - Every 2 hours
- `"10,20,30,40,50 * * * *"` - Every 10 minutes except on the hour
- `"0 9-17 * * 1-5"` - Every hour from 9 AM-5 PM, Monday-Friday

### Getting Your Discord Webhook URL

1. Open Discord and go to your server
2. Right-click the channel → **Edit Channel**
3. Go to **Integrations** → **Webhooks**
4. Click **New Webhook**
5. Give it a name (e.g., "Fischer Auction Notifier")
6. Click **Copy Webhook URL**
7. Paste into `webhook_url` in config.json

### Getting Discord Role ID

1. Enable Developer Mode in Discord:
   - User Settings → Advanced → Developer Mode (toggle on)
2. Right-click the role you want to mention
3. Click **Copy ID**
4. Use in config as: `"mention": "<@&PASTE_ID_HERE>"`

## Unraid-Specific Features

### Auto-Start on Boot

The container is configured with `--restart=unless-stopped`, which means:
- Container starts automatically when Unraid boots
- Container restarts if it crashes
- Container stays stopped if you manually stop it

### Managing from Unraid Dashboard

1. **Start/Stop**: Click the container name → Start/Stop
2. **View Logs**: Click container name → Logs
3. **Console Access**: Click container name → Console
4. **Edit**: Click container icon → Edit

### Resource Limits (Optional)

To limit CPU/memory usage:

1. Edit container in Unraid
2. Under **Extra Parameters**, add:

```
--memory=256m --cpus=0.5
```

This limits to 256MB RAM and 0.5 CPU cores.

### Notifications

To get Unraid notifications about the container:

1. Install "Discord Notifier" from Community Applications
2. Configure with your Discord webhook
3. Enable notifications for Docker events

## Troubleshooting

### Container Won't Start

1. Check logs:
```bash
docker logs fischer-notifier
```

2. Common issues:
   - **Missing config.json**: Ensure `/mnt/user/appdata/fischer/config.json` exists
   - **Invalid JSON**: Validate your config at jsonlint.com
   - **Missing user_agent**: This field is required

### No Discord Messages

1. Check container logs for errors
2. Verify webhook URL is correct
3. Test webhook manually:
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"content":"Test message"}' \
  YOUR_WEBHOOK_URL
```

4. Try setting `"debug_mode": true` in config

### Container Keeps Restarting

1. View logs: `docker logs fischer-notifier`
2. Common causes:
   - Invalid cron expression in schedule
   - Webhook URL issues
   - File permission problems

3. Fix permissions:
```bash
chmod 644 /mnt/user/appdata/fischer/config.json
chmod 755 /mnt/user/appdata/fischer/snapshot
```

### Not Detecting Auctions

1. Verify nations are spelled correctly (case-sensitive)
2. Check that nations have active auctions
3. Try with `"check_snapshot": false` to see all auctions
4. Check NationStates API is accessible:
```bash
curl -A "YourNation" https://www.nationstates.net/cgi-bin/api.cgi?q=cards+auctions
```

### Logs Show "CTE" Errors

CTE checking should work automatically. If you see errors:

1. Check internet connectivity
2. Verify GitHub is accessible from container:
```bash
docker exec fischer-notifier wget -O- https://raw.githubusercontent.com/ns-rot/unsmurf/refs/heads/main/public/static/currentNations.txt | head -10
```

## Updates and Maintenance

### Updating the Container

1. Stop the container:
```bash
docker stop fischer-notifier
docker rm fischer-notifier
```

2. Pull latest code:
```bash
cd /mnt/user/appdata/fischer/source
git pull
```

3. Rebuild image:
```bash
docker build -t fischer-notifier:latest .
```

4. Restart container (use Web GUI or command line from Step 4)

### Backing Up Configuration

1. Backup your config:
```bash
cp /mnt/user/appdata/fischer/config.json /mnt/user/appdata/fischer/config.json.backup
```

2. For full backup including snapshots:
```bash
tar -czf /mnt/user/backups/fischer-backup-$(date +%Y%m%d).tar.gz \
  /mnt/user/appdata/fischer/config.json \
  /mnt/user/appdata/fischer/snapshot/
```

### Viewing Snapshots

Snapshots track which auctions have been seen:

```bash
cat /mnt/user/appdata/fischer/snapshot/major.json
```

To reset and see all auctions again:
```bash
rm /mnt/user/appdata/fischer/snapshot/*.json
docker restart fischer-notifier
```

## Advanced Configuration

### Multiple Configurations for Different Servers

You can add as many named configurations as needed:

```json
{
  "major": {
    "webhook_url": "https://discord.com/api/webhooks/SERVER1/...",
    "nations": ["Nation1"],
    "user_agent": "Nation1",
    "schedule": "0 * * * *"
  },
  "alerts": {
    "webhook_url": "https://discord.com/api/webhooks/SERVER2/...",
    "nations": ["Nation2", "Nation3"],
    "user_agent": "Nation2",
    "schedule": "*/5 * * * *"
  },
  "vip": {
    "webhook_url": "https://discord.com/api/webhooks/SERVER3/...",
    "nations": ["VIPNation"],
    "user_agent": "VIPNation",
    "schedule": "*/2 * * * *",
    "mention": "<@USER_ID>"
  }
}
```

### Running Multiple Containers

For completely separate instances:

1. Create separate directories:
```bash
mkdir -p /mnt/user/appdata/fischer-region1
mkdir -p /mnt/user/appdata/fischer-region2
```

2. Create separate configs in each

3. Run with different container names:
```bash
docker run -d --name=fischer-region1 \
  -v /mnt/user/appdata/fischer-region1/config.json:/app/config.json:ro \
  -v /mnt/user/appdata/fischer-region1/snapshot:/app/snapshot \
  fischer-notifier:latest

docker run -d --name=fischer-region2 \
  -v /mnt/user/appdata/fischer-region2/config.json:/app/config.json:ro \
  -v /mnt/user/appdata/fischer-region2/snapshot:/app/snapshot \
  fischer-notifier:latest
```

### Custom Schedules for Testing

For testing, you can run manually without a schedule:

1. Create a config without `schedule` field
2. Container will run once and exit
3. Good for testing before enabling scheduling

### Integration with Unraid User Scripts

You can trigger manual runs using User Scripts plugin:

1. Install "User Scripts" from Community Applications
2. Create new script:
```bash
#!/bin/bash
docker exec fischer-notifier node /app/main.js /app/config.json
```

3. Set schedule in User Scripts GUI

## Support and Resources

- **GitHub Repository**: https://github.com/rotenaple/fischer
- **Docker Documentation**: See DOCKER.md in repository
- **NationStates API**: https://www.nationstates.net/pages/api.html
- **Unraid Forums**: https://forums.unraid.net/

## Quick Reference Card

```
Container Name: fischer-notifier
Config Location: /mnt/user/appdata/fischer/config.json
Snapshot Location: /mnt/user/appdata/fischer/snapshot/
Logs: docker logs fischer-notifier
Restart: docker restart fischer-notifier
Console: docker exec -it fischer-notifier sh
```

## Example Use Cases

### 1. Single Region Monitor
```json
{
  "main": {
    "webhook_url": "YOUR_WEBHOOK",
    "nations": ["MyNation"],
    "user_agent": "MyNation",
    "schedule": "*/15 * * * *"
  }
}
```

### 2. Major/Minor Updates (Recommended)
```json
{
  "major": {
    "webhook_url": "YOUR_WEBHOOK",
    "nations": ["Nation1", "Nation2"],
    "user_agent": "Nation1",
    "schedule": "0 * * * *",
    "check_snapshot": true,
    "mention": "<@&ROLE_ID>"
  },
  "minor": {
    "webhook_url": "YOUR_WEBHOOK",
    "nations": ["Nation1", "Nation2"],
    "user_agent": "Nation1",
    "schedule": "*/10 * * * *",
    "no_ping": true,
    "check_snapshot": false
  }
}
```

### 3. Multi-Server Setup
```json
{
  "server1": {
    "webhook_url": "WEBHOOK_1",
    "nations": ["Region1Nations"],
    "user_agent": "MainNation",
    "schedule": "0 * * * *"
  },
  "server2": {
    "webhook_url": "WEBHOOK_2",
    "nations": ["Region2Nations"],
    "user_agent": "MainNation",
    "schedule": "30 * * * *"
  }
}
```

---

**Last Updated**: December 2025  
**Version**: 1.0  
**Tested On**: Unraid 6.12.x
