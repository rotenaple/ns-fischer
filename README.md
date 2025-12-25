# Enhanced Auction Fisher Configuration Guide

This script is based on [Kractero/auction-fisher](https://github.com/Kractero/auction-fisher) with additional features.

## Setup

1. Download the [Node.js](https://nodejs.org/en/download/current) matching your operating system.
1. Enter the directory and run npm install.
1. Create a webhook on a discord server.

## Configuration File Basics

- Configuration files are in JSON format.
- You can create multiple configuration files for different use cases.
- When running the script, provide the path to your config file as a command-line argument:
  ```
  node main.js /path/to/your/config.json
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

```json
{
  "webhook_url": "YOUR_DISCORD_WEBHOOK_URL",
  "nations": ["NATION1", "NATION2", "NATION3"],
  "debug_mode": false,
  "mention": "<@&ROLE_ID>",
  "no_ping": false,
  "check_cte": true,
  "snapshot_path": "./snapshot/auction_snapshot.json",
  "check_snapshot": false,
  "user_agent": "YOUR_NATION_NAME"
}
```

### Key Options Explained

| Option           | Required | Default                              | Description                                                                                                               |
| ---------------- | -------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `webhook_url`    | Yes      | -                                    | Your Discord webhook URL.                                                                                                 |
| `nations`        | Yes      | -                                    | Array of nation names to monitor.                                                                                         |
| `debug_mode`     | No       | `false`                              | Enable additional logging.                                                                                                |
| `mention`        | No       | -                                    | Discord role/user to mention. Use `<@&ROLE_ID>` or `<@USER_ID>`.                                                          |
| `no_ping`        | No       | `false`                              | When `true`, sends messages without @user mentions.                                                                       |
| `check_cte`      | No       | `true`                               | Check if nations have Ceased To Exist. Set to `false` to reduce API calls and increase speed.                             |
| `snapshot_path`  | No       | `"./snapshot/auction_snapshot.json"` | Path for the auction snapshot file.                                                                                       |
| `check_snapshot` | No       | `false`                              | When `true`, only sends messages if new bids are detected since the last run. When `false`, sends a message on every run. |
| `user_agent`     | No       | -                                    | Your nation name for API requests. Defaults to the first nation in `nations` if not supplied.                             |

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
  "no_ping": true,
  "check_snapshot": false,
  "snapshot_path": "./shared_snapshot.json",
  "check_cte": false
}
```

### New Activity Alerts (With Pings, Only on New Bids)

```json
{
  "webhook_url": "https://discord.com/api/webhooks/987654321/fghij",
  "nations": ["Nation1", "Nation2", "Nation3"],
  "mention": "<@&123456789>",
  "no_ping": false,
  "check_snapshot": true,
  "snapshot_path": "./shared_snapshot.json",
  "check_cte": true
}
```

Note:

- The first config will always send a message on each run, without pinging users.
- The second config will only send a message (with pings) when new bids are detected.
- Both configs use the same `snapshot_path` to ensure consistency in tracking new activity.

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
