import { parseXML } from "../parseXML.js";
import { isNationCTE } from "./cte.js";

const rarityColors = {
  legendary: { emoji: ":yellow_circle:", color: 0xfdcb58 },
  epic: { emoji: ":red_circle:", color: 0xdd2d44 },
  "ultra-rare": { emoji: ":purple_circle:", color: 0xa98ed6 },
  rare: { emoji: ":blue_circle:", color: 0x54acee },
  uncommon: { emoji: ":green_circle:", color: 0x78b159 },
  common: { emoji: ":white_circle:", color: 0xe6e7e8 },
};

const rarityOrder = [
  "common",
  "uncommon",
  "rare",
  "ultra-rare",
  "epic",
  "legendary",
];

/**
 * Get rarity index for sorting
 * @param {string} rarity - Rarity level
 * @returns {number} Index in rarity order
 */
export function getRarityIndex(rarity) {
  return rarityOrder.indexOf(rarity.toLowerCase());
}

/**
 * Calculate when an auction will resolve based on market activity
 * @param {Array} markets - Array of market transactions
 * @param {boolean} debugMode - Whether to log debug information
 * @returns {Object} Object with endTime
 */
export function calculateAuctionResolutionTime(markets, debugMode = false) {
  const bids = markets
    .filter((market) => market.TYPE === "bid")
    .map((market) => ({
      price: parseFloat(market.PRICE),
      timestamp: parseInt(market.TIMESTAMP),
      type: "bid",
    }));
  const asks = markets
    .filter((market) => market.TYPE === "ask")
    .map((market) => ({
      price: parseFloat(market.PRICE),
      timestamp: parseInt(market.TIMESTAMP),
      type: "ask",
    }));

  const sortedMarkets = [...bids, ...asks].sort(
    (a, b) => a.timestamp - b.timestamp
  );

  let lowask = { price: Infinity, timestamp: 0 };
  let highbid = { price: -Infinity, timestamp: 0 };

  if (debugMode) {
    console.log("Sorted markets:");
    sortedMarkets.forEach((market) =>
      console.log(
        `${market.type.toUpperCase()} - Price: ${market.price}, Timestamp: ${
          market.timestamp
        }`
      )
    );
  }

  for (const market of sortedMarkets) {
    if (market.type === "ask" && market.price < lowask.price) {
      lowask = { price: market.price, timestamp: market.timestamp };
      if (debugMode)
        console.log(
          `Updated lowask to ${lowask.price} at timestamp ${lowask.timestamp}`
        );
    }
    if (market.type === "bid" && market.price > highbid.price) {
      highbid = { price: market.price, timestamp: market.timestamp };
      if (debugMode)
        console.log(
          `Updated highbid to ${highbid.price} at timestamp ${highbid.timestamp}`
        );
    }

    if (debugMode)
      console.log(
        `Current state - Lowask: ${lowask.price} at ${lowask.timestamp}, Highbid: ${highbid.price} at ${highbid.timestamp}`
      );

    if (highbid.price >= lowask.price) {
      if (debugMode)
        console.log(
          `Highbid (${highbid.price}) is now equal to or greater than lowask (${lowask.price}). Stopping updates.`
        );
      break;
    }
  }

  const latestTimestamp = Math.max(lowask.timestamp, highbid.timestamp);
  const auctionEndTime = new Date(latestTimestamp * 1000 + 3600000); // Auction ends one hour after last activity

  return { endTime: auctionEndTime };
}

/**
 * Fetch card information including market data and CTE status
 * @param {Object} card - Card object with id, season, name, nation
 * @param {string} userAgent - User agent for API requests
 * @param {Set<string>} activeNations - Set of active nations for CTE checking
 * @param {boolean} debugMode - Whether to log debug information
 * @returns {Promise<Object|null>} Card info object or null on error
 */
export async function getCardInfo(card, userAgent, activeNations, debugMode = false) {
  try {
    const cardInfo = await parseXML(
      `https://www.nationstates.net/cgi-bin/api.cgi?q=card+markets+info;cardid=${card.id};season=${card.season}`,
      userAgent
    );

    const cardAndMarketData = {
      category: cardInfo.CARD.CATEGORY,
      marketValue: cardInfo.CARD.MARKET_VALUE,
      markets: cardInfo.CARD.MARKETS.MARKET,
    };

    const { endTime } = calculateAuctionResolutionTime(
      cardAndMarketData.markets,
      debugMode
    );

    const rarityColor =
      rarityColors[cardAndMarketData.category.toLowerCase()] ||
      rarityColors.common;

    const marketValue = parseFloat(cardAndMarketData.marketValue).toFixed(2);
    const highestBid = Math.max(
      ...cardAndMarketData.markets
        .filter((m) => m.TYPE === "bid")
        .map((m) => parseFloat(m.PRICE))
    ).toFixed(2);
    const lowestAsk = Math.min(
      ...cardAndMarketData.markets
        .filter((m) => m.TYPE === "ask")
        .map((m) => parseFloat(m.PRICE))
    ).toFixed(2);

    // Check if the nation is CTE using the new method
    let isCTE = false;
    try {
      isCTE = await isNationCTE(cardInfo.CARD.NAME, activeNations);
      
      if (debugMode) {
        console.log(
          `CTE check for ${cardInfo.CARD.NAME}: ${isCTE ? "CTE" : "Active"}`
        );
      }
    } catch (error) {
      if (debugMode) {
        console.error(
          `Error checking CTE status for ${cardInfo.CARD.NAME}: ${error.message}`
        );
      }
    }
    
    return {
      ...card,
      endTime,
      marketValue,
      highestBid,
      lowestAsk,
      rarity: cardAndMarketData.category,
      rarityColor,
      nations: [card.nation],
      isCTE,
    };
  } catch (error) {
    console.error(`Error fetching card and market data: ${error.message}`);
    if (debugMode) console.log(`Failed to fetch data for card ID: ${card.id}`);
    return null;
  }
}

/**
 * Sort cards by end time and log if debug mode is enabled
 * @param {Map} cardMap - Map of cards
 * @param {boolean} debugMode - Whether to log debug information
 * @returns {Object} Object with sorted bidsList and asksList
 */
export function sortAndLogCards(cardMap, debugMode = false) {
  let bidsList = Array.from(cardMap.values()).filter(
    (card) => card.type === "bid"
  );
  let asksList = Array.from(cardMap.values()).filter(
    (card) => card.type === "ask"
  );

  bidsList.sort((a, b) => a.endTime - b.endTime);
  asksList.sort((a, b) => a.endTime - b.endTime);

  if (debugMode) {
    console.log("Sorted Bids:");
    bidsList.forEach((item) => {
      console.log(
        `End Time: ${item.endTime.toISOString()}, Card: ${
          item.name
        }, Nations: ${item.nations.join(", ")}`
      );
    });

    console.log("Sorted Asks:");
    asksList.forEach((item) => {
      console.log(
        `End Time: ${item.endTime.toISOString()}, Card: ${
          item.name
        }, Nations: ${item.nations.join(", ")}`
      );
    });
  }

  return { bidsList, asksList };
}

export { rarityColors, rarityOrder };
