# Configuration Files Directory

This directory contains all configuration files for the Fischer auction notifier. Each configuration file can specify its own schedule, making it easy to manage different update frequencies from a single location.

## Quick Start

1. Copy an example file and remove the `.example` extension:
   ```bash
   cp major-hourly.json.example major-hourly.json
   cp minor-frequent.json.example minor-frequent.json
   ```

2. Edit the files with your settings:
   - `webhook_url`: Your Discord webhook URL
   - `nations`: Array of nations to monitor
   - `user_agent`: Your main nation name (REQUIRED for API compliance)
   - `schedule`: Cron expression (optional - if not set, runs on-demand)

3. Run with Docker:
   ```bash
   docker-compose up -d
   ```

## Configuration Structure

Each JSON file should have this structure:

```json
{
  "webhook_url": "https://discord.com/api/webhooks/...",
  "nations": ["Nation1", "Nation2"],
  "user_agent": "YourMainNation",
  "schedule": "*/15 * * * *",
  "mention": "<@&ROLE_ID>",
  "no_ping": false,
  "check_snapshot": true,
  "snapshot_path": "./snapshot/auction.json",
  "debug_mode": false
}
```

### Required Fields

- **webhook_url**: Discord webhook URL for sending notifications
- **nations**: Array of nation names to monitor for auctions
- **user_agent**: Your nation name (required by NationStates API rules)

### Optional Fields

- **schedule**: Cron expression for when to run this config (e.g., `"0 * * * *"` for hourly)
  - If not specified, config runs once when container starts
  - If specified, config runs on the schedule automatically
- **mention**: Discord role or user to mention (e.g., `"<@&ROLE_ID>"`)
- **no_ping**: Set to `true` to send messages without pinging (default: `false`)
- **check_snapshot**: Only send messages for new auctions since last run (default: `false`)
- **snapshot_path**: Path to snapshot file (default: `"./snapshot/auction_snapshot.json"`)
- **debug_mode**: Enable verbose logging (default: `false`)

## Example Use Cases

### Major Hourly Updates (with pings)
```json
{
  "webhook_url": "...",
  "nations": ["MyNation"],
  "user_agent": "MyNation",
  "schedule": "0 * * * *",
  "mention": "<@&123456789>",
  "check_snapshot": true,
  "snapshot_path": "./snapshot/major.json"
}
```

Runs every hour on the hour, pings users, only shows new auctions.

### Minor Frequent Updates (no pings)
```json
{
  "webhook_url": "...",
  "nations": ["MyNation"],
  "user_agent": "MyNation",
  "schedule": "10,20,30,40,50 * * * *",
  "no_ping": true,
  "check_snapshot": false,
  "snapshot_path": "./snapshot/minor.json"
}
```

Runs every 10 minutes (except on the hour), no pings, shows all auctions.

### On-Demand (no schedule)
```json
{
  "webhook_url": "...",
  "nations": ["MyNation"],
  "user_agent": "MyNation",
  "check_snapshot": false
}
```

No schedule specified - runs once when container starts.

## Schedule Syntax (Cron)

The schedule field uses standard cron syntax:

```
* * * * *
│ │ │ │ │
│ │ │ │ └─── Day of week (0-7, Sunday = 0 or 7)
│ │ │ └───── Month (1-12)
│ │ └─────── Day of month (1-31)
│ └───────── Hour (0-23)
└─────────── Minute (0-59)
```

### Common Patterns

- `*/15 * * * *` - Every 15 minutes
- `0 * * * *` - Every hour (on the hour)
- `0 */2 * * *` - Every 2 hours
- `10,20,30,40,50 * * * *` - Every 10 minutes except on the hour
- `0 9-17 * * 1-5` - Every hour from 9 AM to 5 PM, Monday to Friday
- `0 0 * * *` - Every day at midnight

## Multiple Configurations

You can have multiple config files in this directory. Each will be loaded and scheduled independently:

- `major-hourly.json` - Runs every hour with pings
- `minor-10min.json` - Runs every 10 minutes without pings
- `alerts.json` - Runs every 5 minutes, different webhook
- `ondemand.json` - No schedule, runs once

The scheduler automatically handles all configs based on their individual schedules.

## Snapshots

Each config should use a different snapshot file if they have different schedules or settings. This prevents conflicts:

- Major updates: `"snapshot_path": "./snapshot/major.json"`
- Minor updates: `"snapshot_path": "./snapshot/minor.json"`

Or use the same snapshot if you want consistent tracking across all configs.

## Testing

To test a configuration without scheduling, run manually:

```bash
node main.js configs/your-config.json
```

## Notes

- CTE (Ceased To Exist) checking is automatic and quota-free
- All configs are validated on startup
- Invalid configs are skipped with error messages
- Logs show which config is running and when
