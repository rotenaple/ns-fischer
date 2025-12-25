import fs from "fs";

/**
 * Load configuration from a JSON file containing multiple named configs
 * @param {string} configPath - Path to the configuration file
 * @returns {Object} Object with named configurations
 */
export function loadAllConfigs(configPath) {
  try {
    const configFile = fs.readFileSync(configPath, "utf8");
    const configs = JSON.parse(configFile);
    
    // Validate that it's an object
    if (typeof configs !== 'object' || configs === null || Array.isArray(configs)) {
      throw new Error("Configuration file must be a JSON object with named configurations");
    }
    
    // Validate each config
    Object.entries(configs).forEach(([name, config]) => {
      validateConfig(name, config);
    });
    
    return configs;
  } catch (error) {
    console.error(`Error loading config file: ${error.message}`);
    throw error;
  }
}

/**
 * Validate a single configuration
 * @param {string} name - Name of the configuration
 * @param {Object} config - Configuration object
 */
function validateConfig(name, config) {
  if (!config.webhook_url) {
    throw new Error(`[${name}] webhook_url is required in configuration`);
  }
  if (!config.nations || !Array.isArray(config.nations) || config.nations.length === 0) {
    throw new Error(`[${name}] nations must be a non-empty array in configuration`);
  }
  if (!config.user_agent) {
    throw new Error(`[${name}] user_agent is required in configuration to comply with NationStates API rules`);
  }
}

/**
 * Load configuration from a JSON file (single config - for backward compatibility)
 * @param {string} configPath - Path to the configuration file
 * @returns {Object} Configuration object
 */
export function loadConfig(configPath) {
  try {
    const configFile = fs.readFileSync(configPath, "utf8");
    const config = JSON.parse(configFile);
    
    // Check if it's a single config or multiple configs
    if (config.webhook_url) {
      // Single config format
      validateConfig('config', config);
      return config;
    } else {
      // Multiple configs format - return first one for compatibility
      const firstKey = Object.keys(config)[0];
      if (!firstKey) {
        throw new Error("No configurations found in file");
      }
      validateConfig(firstKey, config[firstKey]);
      return config[firstKey];
    }
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
    userAgent: config.user_agent,
    schedule: config.schedule || null  // Schedule can be defined in config
  };
  
  // If no mention is provided, force no ping
  if (parsed.mention === "") {
    parsed.noPing = true;
  }
  
  return parsed;
}
