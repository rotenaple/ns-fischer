# Enhanced Auction Fisher

A Discord notification bot for NationStates auctions, based on [Kractero/auction-fisher](https://github.com/Kractero/auction-fisher) with additional features.

## Quick Start (Prebuilt Docker)

1. Clone the repository (for config/examples):
   ```bash
   git clone https://github.com/your-repo/fischer.git
   cd fischer
   ```

2. Copy and edit config:
   ```bash
   cp config.json.example config.json
   # Edit config.json with your Discord webhook and nation details
   ```

3. Pull the prebuilt image (optional; `docker compose up` will pull if missing):
   ```bash
   docker compose pull
   ```

4. Run with Docker (uses the published GHCR image by default):
   ```bash
   docker compose up -d
   ```

That's it! The container will start monitoring auctions according to your config using the prebuilt image.

## Configuration

All settings go in `config.json`. Each named config can have its own schedule.

### Basic Example
```json
{
  "myconfig": {
    "webhook_url": "https://discord.com/api/webhooks/...",
    "nations": ["Nation1", "Nation2"],
    "user_agent": "YourNation"
  }
}
```

### Key Options
- `webhook_url`: Your Discord webhook URL (required)
- `nations`: Array of nations to monitor (required)
- `user_agent`: Your nation name (required)
- `schedule`: Cron expression (optional, runs once if omitted)
- `mention`: Discord role to ping (optional)
- `check_snapshot`: Only notify on new auctions (optional)

## Docker Deployment

Run using Docker with JSON configuration.

### Docker Quick Start

1. Clone the repo:
   ```bash
   git clone https://github.com/rotenaple/fischer.git
   cd fischer
   ```

2. Configure:
   ```bash
   cp config.json.example config.json
   # Edit config.json with your Discord webhook and nations
   ```

3. Run:
   ```bash
   docker compose up -d
   ```

### Docker Commands

```bash
docker compose up -d          # Start
docker compose logs -f        # View logs
docker compose down           # Stop
docker compose restart        # Restart
docker compose pull           # Update to the latest published image
docker compose ps             # Check status
docker run --rm -v $(pwd)/snapshot:/app/snapshot -v $(pwd)/config.json:/app/config.json ghcr.io/rotenaple/ns-fischer:latest  # Run once
```

### Docker CLI
```bash
docker pull ghcr.io/rotenaple/ns-fischer:latest
docker run -d --name ns-fischer \
   -v $(pwd)/snapshot:/app/snapshot \
   -v $(pwd)/config.json:/app/config.json \
   ghcr.io/rotenaple/ns-fischer:latest
```

## Prebuilt Images & CI

The Docker image is built and published to GitHub Container Registry on every push to `main` and on tags via [.github/workflows/docker-publish.yml](.github/workflows/docker-publish.yml). Available tags:
- `latest` (default on `main`)
- `sha-<commit>` for every commit
- Git tags like `v1.2.3` when pushing version tags

Override the image if you want to pin to a specific tag:

```bash
FISCHER_IMAGE=ghcr.io/rotenaple/ns-fischer:sha-<commit> docker compose up -d
```

### Volumes
- `./snapshot:/app/snapshot` - Persists auction data
- `./config.json:/app/config.json` - Your configuration

### Scheduling
Add `schedule` field with cron expression (e.g., `"*/15 * * * *"` for every 15 min).

Common schedules:
- `"*/15 * * * *"` - Every 15 min
- `"0 * * * *"` - Hourly
- `"*/30 * * * *"` - Every 30 min

### Troubleshooting
**No messages?**
- Check logs: `docker-compose logs -f`
- Set `"check_snapshot": false` to see all auctions
- Set `"debug_mode": true` for verbose logging

**Container exits?**
- Ensure config.json exists and has required fields

**See loaded configs:**
```bash
docker logs ns-fischer | head -20
```

## Unraid Setup

Run on Unraid using Docker.

### Unraid Quick Start

1. Open Unraid web interface → Apps → Search "ns-fischer" (when available)

2. Or manually:
   - SSH into Unraid
   - Create directory: `mkdir -p /mnt/user/appdata/fischer`
   - Clone repo: `cd /mnt/user/appdata/fischer && git clone https://github.com/rotenaple/fischer.git source`
   - Build: `cd source && docker build -t ns-fischer:latest .`

3. Create config:
   ```bash
   cp source/config.json.example config.json
   nano config.json  # Add your Discord webhook and nations
   ```

4. Run container via Unraid Docker page:
   - Repository: `ghcr.io/rotenaple/ns-fischer:latest` (or another published tag)
   - Add volumes:
     - Host: `/mnt/user/appdata/fischer/config.json` → Container: `/app/config.json`
     - Host: `/mnt/user/appdata/fischer/snapshot` → Container: `/app/snapshot`

### Unraid Configuration
Same as Docker - single `config.json` file.

### Unraid Volumes
- Config: Mount your config.json
- Snapshot: `/mnt/user/appdata/fischer/snapshot` for persistence
