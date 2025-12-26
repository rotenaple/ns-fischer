# NS-Fischer on Unraid

Run NS-Fischer Auction Notifier on Unraid using Docker.

## Quick Start

1. Open Unraid web interface → Apps → Search "ns-fischer" (when available)

2. Or manually:
  - SSH into Unraid
  - Create directory: `mkdir -p /mnt/user/appdata/fischer`
  - Clone repo (for config example only): `cd /mnt/user/appdata/fischer && git clone https://github.com/rotenaple/fischer.git source`

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

## Configuration

Same as Docker - single `config.json` file:

```json
{
  "myconfig": {
    "webhook_url": "https://discord.com/api/webhooks/...",
    "nations": ["Nation1", "Nation2"],
    "user_agent": "YourNation"
  }
}
```

**Required:** webhook_url, nations, user_agent

## Volumes

- Config: Mount your config.json
- Snapshot: `/mnt/user/appdata/fischer/snapshot` for persistence

For detailed Docker setup, see [DOCKER.md](DOCKER.md).
