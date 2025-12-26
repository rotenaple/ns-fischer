# NS Fischer

A lightweight Discord notification bot for NationStates auctions. Forked and
extended from [Kractero/auction-fisher](https://github.com/Kractero/auction-fisher), packaged for easy Docker deployment.

## Quick Start

1. Clone the repository:
   ```bash
   git clone https://github.com/rotenaple/ns-fischer.git
   cd ns-fischer
   ```

2. Configure:
   ```bash
   cp config.json.example config.json
   # Edit config.json with your Discord webhook and nation details
   ```

3. Run with Docker:
   ```bash
   docker compose up -d
   ```

The container will start monitoring auctions according to your config using the prebuilt GHCR image.

**Step-by-step Docker Setup**

1. Install Docker:

- Windows/macOS: Install Docker Desktop (WSL2 is recommended on Windows).
- Linux: Install Docker Engine and Docker Compose (your distro package manager or Docker docs).

2. Clone the repository and enter the folder:

PowerShell:
```powershell
git clone https://github.com/rotenaple/ns-fischer.git
cd ns-fischer
```

bash / sh:
```bash
git clone https://github.com/rotenaple/ns-fischer.git
cd ns-fischer
```

3. Copy the example config and edit it. Use an editor you have installed (VS Code, nano, notepad, etc.):

PowerShell:
```powershell
Copy-Item config.json.example config.json
code config.json    # (if you have VS Code)
# or
notepad config.json
```

bash / sh:
```bash
cp config.json.example config.json
${EDITOR:-nano} config.json
```

Required fields: `webhook_url`, `nations` (array), and `user_agent`. Leave `schedule` in place for scheduled runs, or remove it to run once.

4. Create the `snapshot` directory (persists state between runs):

PowerShell:
```powershell
New-Item -ItemType Directory -Force .\snapshot
```

bash / sh:
```bash
mkdir -p ./snapshot
```

5. Start with Docker Compose (recommended):

```bash
docker compose up -d
```

Notes:
- If your system uses the older CLI, `docker-compose up -d` also works.
- On Windows, if using PowerShell without WSL, Docker may prompt to allow file sharing for the drive containing the repo.

6. Check logs to confirm the container loaded your config:

```bash
docker compose logs -f
# or for a single container
docker logs -f ns-fischer
```

Run-once / testing options:
- Use `docker run --rm ...` shown in the Docker CLI examples earlier in this README to run a single container instance. On Windows, prefer running from WSL or ensure path formatting is correct for Docker.
- Or run locally (requires Node.js >=20):

```bash
node main.js ./config.json
```

Common issues & fixes:
- "Error: /app/config.json not found" — ensure `config.json` exists in the project root and that you ran `docker compose up` from that folder so the file is mounted to `/app/config.json` inside the container.
- Permission / mount problems — on Windows enable file sharing for the drive in Docker Desktop or run Docker inside WSL2 for more reliable mounts.
- If you only want to see output during testing, set `check_snapshot: false` in `config.json` so the script posts matches every run.

If you want, I can add a minimal `config.json` example snippet with placeholder values to make first-time setup even easier.

## Configuration

All settings go in `config.json`. Each named config can have its own schedule.

### Complete configuration

Configurations are a top-level object where each key is a named configuration. Each named configuration controls one or more monitoring runs (for example `major` and `minor`). Below is a complete example configuration and a full list of supported fields.

```json
{
  "major": {
    "webhook_url": "https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN",
    "nations": ["Nation1", "Nation2", "Nation3"],
    "user_agent": "YourMainNation",
    "schedule": "0 * * * *",
    "mention": "<@&ROLE_ID>",
    "no_ping": false,
    "check_snapshot": false,
    "snapshot_path": "./snapshot/snapshot.json",
    "debug_mode": false
  },
  "minor": {
    "webhook_url": "https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN",
    "nations": ["Nation1", "Nation2", "Nation3"],
    "user_agent": "YourMainNation",
    "schedule": "10,20,30,40,50 * * * *",
    "no_ping": true,
    "check_snapshot": true,
    "snapshot_path": "./snapshot/snapshot.json",
    "debug_mode": false
  }
}
```

Complete configuration fields

- `webhook_url` (string, required): Discord webhook URL to send notifications to.
- `nations` (array of strings, required): Nations to monitor for bids/asks.
- `user_agent` (string, required): The user agent string (usually your nation name) used for API requests.
- `schedule` (string, optional): Cron expression that controls when a named configuration runs. If omitted, the configuration will be executed once when provided directly to the program.
- `mention` (string, optional): A Discord mention string (e.g., `<@&ROLE_ID>`) to include in the notification message.
- `no_ping` (boolean, optional, default: `false`): When `true`, suppresses pinging `mention` in messages.
- `check_snapshot` (boolean, optional, default: `true`): When `true`, only sends notifications when there are new auctions compared to the saved snapshot. When `false`, every run will post matches.
- `snapshot_path` (string, optional, default: `./snapshot/snapshot.json`): File path used to read/write snapshot state for change-detection.
 - `check_snapshot` (boolean, optional, default: `false`): When `true`, only sends notifications when there are new auctions compared to the saved snapshot. When `false`, every run will post matches.
 - `snapshot_path` (string, optional, default: `./snapshot/auction_snapshot.json`): File path used to read/write snapshot state for change-detection.
- `debug_mode` (boolean, optional, default: `false`): Enable verbose debug logging for troubleshooting.

Notes:
- You may include multiple named configurations in `config.json`. The program accepts one or more config file paths on the command line and will process each configuration sequentially.
- Use `check_snapshot: false` during initial testing to see all matching auctions without snapshot filtering.

### Default config file (`config.json.example`)

The repository includes `config.json.example` as a starting point. Each top-level key (for example `major` and `minor`) is a named configuration that controls one or more monitoring runs. The program loads all named configurations from the JSON file and executes each according to its `schedule` (a cron expression). If a named configuration omits `schedule`, it will run once when the program is executed directly.

`config.json.example` includes two configs by default: `major` and `minor`. The `major` run is scheduled at the top of every hour (`"0 * * * *"`) and is intended as a reliable hourly heartbeat — it **does not** use snapshot filtering (`check_snapshot: false`) and will post matches whenever it runs so you get at least one visible message per hour to confirm the script is alive. The `minor` run happens every 10 minutes (`"10,20,30,40,50 * * * *"`) and is designed for higher-frequency updates; it uses `check_snapshot: true` to only post when there are new auctions, keeping frequent posts relevant and reducing noise.

## Docker Deployment

### Docker Commands

**Docker Compose:**
```bash
docker compose up -d          # Start
docker compose logs -f        # View logs
docker compose down           # Stop
docker compose restart        # Restart
docker compose pull           # Update to latest image
docker compose ps             # Check status
```

**Docker CLI:**
```bash
# Pull the prebuilt image
docker pull ghcr.io/rotenaple/ns-fischer:latest

# Run as daemon
docker run -d --name ns-fischer \
   -v $(pwd)/snapshot:/app/snapshot \
   -v $(pwd)/config.json:/app/config.json \
   ghcr.io/rotenaple/ns-fischer:latest

# Run once
docker run --rm \
   -v $(pwd)/snapshot:/app/snapshot \
   -v $(pwd)/config.json:/app/config.json \
   ghcr.io/rotenaple/ns-fischer:latest
```

### Volumes
- `./snapshot:/app/snapshot` - Persists auction data between runs
- `./config.json:/app/config.json` - Your configuration file

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

1. Via SSH:
   ```bash
   mkdir -p /mnt/user/appdata/ns-fischer
   cd /mnt/user/appdata/ns-fischer
   git clone https://github.com/rotenaple/ns-fischer.git source
   cp source/config.json.example config.json
   nano config.json  # Add your Discord webhook and nations
   ```

2. Create container via Unraid Docker page:
   - Repository: `ghcr.io/rotenaple/ns-fischer:latest`
   - Volume mappings:
     - Host: `/mnt/user/appdata/ns-fischer/config.json` → Container: `/app/config.json`
     - Host: `/mnt/user/appdata/ns-fischer/snapshot` → Container: `/app/snapshot`