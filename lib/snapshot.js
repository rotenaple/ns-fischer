import fs from "fs";
import path from "path";

/**
 * Write auction snapshot to file
 * @param {string} snapshotPath - Path to the snapshot file
 * @param {Array} bids - Array of bid objects
 * @param {Array} asks - Array of ask objects
 */
export function writeSnapshot(snapshotPath, bids, asks) {
  const snapshot = {
    bids: bids.map((bid) => ({ cardId: bid.id, season: bid.season })),
    asks: asks.map((ask) => ({ cardId: ask.id, season: ask.season })),
  };
  
  // Ensure directory exists (cross-platform)
  const dir = path.dirname(snapshotPath);
  if (dir && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
}

/**
 * Check auction data against snapshot for new entries
 * @param {string} snapshotPath - Path to the snapshot file
 * @param {Array} currentBids - Current bid objects
 * @param {Array} currentAsks - Current ask objects
 * @returns {Object} Object with hasNewAuctions flag and all bids/asks
 */
export function checkSnapshot(snapshotPath, currentBids, currentAsks) {
  if (!fs.existsSync(snapshotPath)) {
    return { hasNewAuctions: true, allBids: currentBids, allAsks: currentAsks };
  }

  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));

  const newBids = currentBids.filter(
    (bid) =>
      !snapshot.bids.some((s) => s.cardId === bid.id && s.season === bid.season)
  );

  const newAsks = currentAsks.filter(
    (ask) =>
      !snapshot.asks.some((s) => s.cardId === ask.id && s.season === ask.season)
  );

  const hasNewAuctions = newBids.length > 0 || newAsks.length > 0;

  return { hasNewAuctions, allBids: currentBids, allAsks: currentAsks };
}
