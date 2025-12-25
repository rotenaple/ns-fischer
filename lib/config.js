import fs from "fs";

/**
 * Load configuration from a JSON file
 * @param {string} configPath - Path to the configuration file
 * @returns {Object} Configuration object
 */
export function loadConfig(configPath) {
  try {
    const configFile = fs.readFileSync(configPath, "utf8");
    const config = JSON.parse(configFile);
    
    // Validate required fields
    if (!config.webhook_url) {
      throw new Error("webhook_url is required in configuration");
    }
    if (!config.nations || !Array.isArray(config.nations) || config.nations.length === 0) {
      throw new Error("nations must be a non-empty array in configuration");
    }
    if (!config.user_agent) {
      throw new Error("user_agent is required in configuration to comply with NationStates API rules");
    }
    
    return config;
  } catch (error) {
    console.error(`Error loading config file: ${error.message}`);
    throw error;
  }
}

/**
 * Load multiple configuration files
 * @param {string[]} configPaths - Array of paths to configuration files
 * @returns {Object[]} Array of configuration objects
 */
export function loadMultipleConfigs(configPaths) {
  return configPaths.map(path => loadConfig(path));
}

/**
 * Parse configuration object and set defaults
 * @param {Object} config - Raw configuration object
 * @returns {Object} Parsed configuration with defaults
 */
export function parseConfig(config) {
  const parsed = {
    webhookUrl: config.webhook_url,
    nations: config.nations,
    debugMode: config.debug_mode || false,
    mention: config.mention || "",
    noPing: config.no_ping || false,
    snapshotPath: config.snapshot_path || "./snapshot/auction_snapshot.json",
    checkSnapshot: config.check_snapshot || false,
    userAgent: config.user_agent
  };
  
  // If no mention is provided, force no ping
  if (parsed.mention === "") {
    parsed.noPing = true;
  }
  
  return parsed;
}
