# Enhanced Auction Fisher Configuration Guide

This script is based on [Kractero/auction-fisher](https://github.com/Kractero/auction-fisher) with additional features.

## Quick Start

### Using Docker (Recommended)

1. Clone the repository and navigate to the directory
2. Create your configuration files in the `configs/` directory:
   ```bash
   cp configs/major-hourly.json.example configs/major-hourly.json
   cp configs/minor-frequent.json.example configs/minor-frequent.json
   ```
3. Edit the config files with your webhook URL, nations, and user_agent
4. Run with Docker Compose:
   ```bash
   docker-compose up -d
   ```

**New**: All configuration is now centralized in the `configs/` directory. Each config file can specify its own schedule. No separate environment variables needed!

For detailed Docker instructions, see [DOCKER.md](DOCKER.md).

### Using Node.js Directly

1. Download the [Node.js](https://nodejs.org/en/download/current) matching your operating system.
2. Enter the directory and run npm install.
3. Create a webhook on a discord server.
4. Create configuration files in the `configs/` directory or specify paths directly.

## Centralized Configuration

All configuration files are now stored in the `configs/` directory. Each config file can include its own schedule, making it easy to manage multiple update frequencies from one place.

See [configs/README.md](configs/README.md) for detailed configuration documentation.

### Quick Example

Create `configs/hourly.json`:
```json
{
  "webhook_url": "https://discord.com/api/webhooks/...",
  "nations": ["Nation1", "Nation2"],
  "user_agent": "YourMainNation",
  "schedule": "0 * * * *",
  "mention": "<@&ROLE_ID>",
  "check_snapshot": true,
  "snapshot_path": "./snapshot/hourly.json"
}
```

Create `configs/frequent.json`:
```json
{
  "webhook_url": "https://discord.com/api/webhooks/...",
  "nations": ["Nation1", "Nation2"],
  "user_agent": "YourMainNation",
  "schedule": "*/10 * * * *",
  "no_ping": true,
  "check_snapshot": false,
  "snapshot_path": "./snapshot/frequent.json"
}
```

Run: `docker-compose up -d`

The scheduler automatically runs each config on its own schedule.

## Configuration File Basics

- Configuration files are in JSON format stored in the `configs/` directory
- Each config can specify its own `schedule` field with a cron expression
- If no schedule is specified, the config runs once on startup
- You can also run configs manually: `node main.js configs/myconfig.json`
     "mention": "<@&ROLE_ID>",
     "no_ping": false
   }
   ```

2. Create `config-minor.json` for frequent minor updates:
   ```json
   {
     "webhook_url": "YOUR_WEBHOOK_URL",
     "nations": ["Nation1", "Nation2"],
     "user_agent": "YourMainNation",
     "check_snapshot": false,
     "snapshot_path": "./snapshot/minor.json",
     "no_ping": true
   }
   ```

3. Run both configs:
   ```bash
   node main.js config-major.json config-minor.json
   ```

4. Schedule with cron:
   ```bash
   # Major updates every hour
   0 * * * * node /path/to/main.js /path/to/config-major.json
   
   # Minor updates every 10 minutes (except on the hour)
   10,20,30,40,50 * * * * node /path/to/main.js /path/to/config-minor.json
   ```

## Use Cases for Multiple Configurations

1. **Varied Message Frequencies**:

   - Create one config with `check_snapshot: true` for notifications only on new activity.
   - Create another config with `check_snapshot: false` for regular updates regardless of new bids.
   - Both configs can use the same snapshot file to track what's been seen before.

2. **Ping vs. No-Ping Updates**:

   - Set up one config with `no_ping: false` for important updates that should notify users.
   - Set up another with `no_ping: true` for regular updates without notifications.

3. **Multiple Discord Servers**:
   - Set up different configs to send auction information to various Discord servers or channels.

## Configuration Options

All configs are stored in JSON files in the `configs/` directory:

```json
{
  "webhook_url": "YOUR_DISCORD_WEBHOOK_URL",
  "nations": ["NATION1", "NATION2", "NATION3"],
  "user_agent": "YOUR_NATION_NAME",
  "schedule": "*/15 * * * *",
  "mention": "<@&ROLE_ID>",
  "no_ping": false,
  "snapshot_path": "./snapshot/auction_snapshot.json",
  "check_snapshot": false,
  "debug_mode": false
}
```

### Key Options Explained

| Option           | Required | Default                              | Description                                                                                                               |
| ---------------- | -------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `webhook_url`    | **Yes**  | -                                    | Your Discord webhook URL.                                                                                                 |
| `nations`        | **Yes**  | -                                    | Array of nation names to monitor.                                                                                         |
| `user_agent`     | **Yes**  | -                                    | **REQUIRED**: Your nation name for API requests. Required to comply with NationStates API rules.                          |
| `schedule`       | No       | -                                    | Cron expression for when to run (e.g., `"0 * * * *"` for hourly). If omitted, runs once on startup.                      |
| `mention`        | No       | -                                    | Discord role/user to mention. Use `<@&ROLE_ID>` or `<@USER_ID>`.                                                          |
| `no_ping`        | No       | `false`                              | When `true`, sends messages without @user mentions.                                                                       |
| `snapshot_path`  | No       | `"./snapshot/auction_snapshot.json"` | Path for the auction snapshot file.                                                                                       |
| `check_snapshot` | No       | `false`                              | When `true`, only sends messages if new bids are detected since the last run. When `false`, sends a message on every run. |
| `debug_mode`     | No       | `false`                              | Enable additional logging.                                                                                                |

**Note**: CTE (Ceased To Exist) checking is now automatic and uses a quota-free method via the [unsmurf currentNations.txt](https://raw.githubusercontent.com/ns-rot/unsmurf/refs/heads/main/public/static/currentNations.txt) file.

## Snapshot Functionality

- The snapshot is used to track which auctions have been seen in previous runs.
- When `check_snapshot` is set to `true`, the bot will only send messages when new auctions are detected since the last run.
- This feature helps prevent spam and ensures that users are only notified of fresh auction activity.
- When using multiple configs, you can set them to use the same snapshot file to ensure consistent tracking across different run frequencies or Discord targets.

## Auction Resolution Time

- The script estimates auction resolution time based on current asks and bids.
- This estimation can be inaccurate if:
  - The initial ask/bid that started the auction has been retracted.
  - Any overbids or underasks occuring.

## Example Configurations

### Regular Updates (No Pings, Always Send)

```json
{
  "webhook_url": "https://discord.com/api/webhooks/123456789/abcde",
  "nations": ["Nation1", "Nation2", "Nation3"],
  "user_agent": "YourMainNation",
  "no_ping": true,
  "check_snapshot": false,
  "snapshot_path": "./shared_snapshot.json"
}
```

### New Activity Alerts (With Pings, Only on New Bids)

```json
{
  "webhook_url": "https://discord.com/api/webhooks/987654321/fghij",
  "nations": ["Nation1", "Nation2", "Nation3"],
  "user_agent": "YourMainNation",
  "mention": "<@&123456789>",
  "no_ping": false,
  "check_snapshot": true,
  "snapshot_path": "./shared_snapshot.json"
}
```

Note:

- The first config will always send a message on each run, without pinging users.
- The second config will only send a message (with pings) when new bids are detected.
- Both configs use the same `snapshot_path` to ensure consistency in tracking new activity.
- CTE checking is automatic and doesn't consume API quota.

## Docker Deployment

For production deployments and easier configuration management, Docker is the recommended approach.

### Docker Quick Start

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your configuration
nano .env

# Start the container
docker-compose up -d

# View logs
docker-compose logs -f
```

### Docker Environment Variables

All configuration options are available as environment variables:

- `WEBHOOK_URL` - Your Discord webhook URL (required)
- `NATIONS` - Comma-separated list of nations (required)
- `SCHEDULE` - Cron expression for scheduling (e.g., `*/15 * * * *`)
- `MENTION` - Discord role or user to mention
- `DEBUG_MODE` - Enable debug logging
- `CHECK_SNAPSHOT` - Only notify on new auctions
- And more...

See [DOCKER.md](DOCKER.md) for comprehensive Docker documentation including:
- Detailed configuration options
- Scheduling examples
- Multiple instance setups
- Troubleshooting
- Kubernetes deployment

## Running Multiple Configurations

You can set up cron jobs or scheduled tasks to run the script with different config files at various intervals. For example:

- Run the regular update config every 15 minutes:
  ```
  */15 * * * * node /path/to/script.js /path/to/regular_update_config.json
  ```
- Run the new activity alert config every hour:
  ```
  0 * * * * node /path/to/script.js /path/to/new_activity_alert_config.json
  ```
