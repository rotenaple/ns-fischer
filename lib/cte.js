/**
 * CTE (Ceased To Exist) checking utilities
 * Uses the currentNations.txt file which doesn't consume API quota
 */

let activeNationsCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch the list of active nations from the currentNations.txt file
 * @returns {Promise<Set<string>>} Set of active nation names (lowercase)
 */
export async function fetchActiveNations() {
  const now = Date.now();
  
  // Return cached data if still valid
  if (activeNationsCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION) {
    return activeNationsCache;
  }
  
  try {
    const response = await fetch(
      'https://raw.githubusercontent.com/ns-rot/unsmurf/refs/heads/main/public/static/currentNations.txt'
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch active nations: ${response.status} ${response.statusText}`);
    }
    
    const text = await response.text();
    const nations = new Set(
      text
        .split('\n')
        .map(nation => nation.trim().toLowerCase())
        .filter(nation => nation.length > 0)
    );
    
    // Update cache
    activeNationsCache = nations;
    cacheTimestamp = now;
    
    return nations;
  } catch (error) {
    console.error(`Error fetching active nations list: ${error.message}`);
    // Return cached data if available, even if expired
    if (activeNationsCache) {
      console.warn('Using expired active nations cache due to fetch error');
      return activeNationsCache;
    }
    throw error;
  }
}

/**
 * Check if a nation has ceased to exist
 * @param {string} nationName - Name of the nation to check
 * @param {Set<string>} activeNations - Set of active nations (optional, will fetch if not provided)
 * @returns {Promise<boolean>} True if the nation is CTE, false otherwise
 */
export async function isNationCTE(nationName, activeNations = null) {
  if (!activeNations) {
    activeNations = await fetchActiveNations();
  }
  
  const normalizedName = nationName.trim().toLowerCase().replace(/ /g, '_');
  return !activeNations.has(normalizedName);
}

/**
 * Clear the active nations cache (useful for testing)
 */
export function clearCache() {
  activeNationsCache = null;
  cacheTimestamp = null;
}
