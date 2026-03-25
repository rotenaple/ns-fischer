import { Webhook } from "discord-webhook-node";
import { parseXML } from "./parseXML.js";
import process from "process";
import { loadConfig, loadMultipleConfigs, parseConfig } from "./lib/config.js";
import { fetchActiveNations } from "./lib/cte.js";
import { writeSnapshot, checkSnapshot } from "./lib/snapshot.js";
import { getCardInfo, getRarityIndex, sortAndLogCards, rarityColors } from "./lib/cards.js";
import { createDiscordMessage } from "./lib/discord.js";

/**
 * Process a single configuration
 * @param {Object} rawConfig - Raw configuration object
 * @returns {Promise<void>}
 */
async function processConfig(rawConfig) {
  const config = parseConfig(rawConfig);
  const hook = new Webhook(config.webhookUrl);

  if (config.debugMode) {
    console.log(`\n=== Processing configuration ===`);
    console.log(`Webhook: ${config.webhookUrl.substring(0, 50)}...`);
    console.log(`Nations: ${config.nations.join(", ")}`);
    console.log(`User Agent: ${config.userAgent}`);
  }

  let highestRarityIndex = -1;
  let highestRarityColor = rarityColors.common.color;
  let cardMap = new Map();
  let filteredHoldingBids = [];

  // Fetch active nations list for CTE checking (doesn't use API quota)
  let activeNations;
  try {
    activeNations = await fetchActiveNations();
    if (config.debugMode) {
      console.log(`Fetched ${activeNations.size} active nations for CTE checking`);
    }
  } catch (error) {
    console.error(`Warning: Could not fetch active nations list: ${error.message}`);
    console.error(`CTE checking will be disabled for this run`);
    activeNations = new Set(); // Empty set means all nations will be marked as not CTE
  }

  // Fetch active auctions
  let auction;
  try {
    auction = await parseXML(
      "https://www.nationstates.net/cgi-bin/api.cgi?q=cards+auctions",
      config.userAgent
    );
    if (config.debugMode) console.log(`Fetched active auctions.`);
  } catch (error) {
    console.error(`Failed to fetch active auctions: ${error.message}`);
    return;
  }

  const market = auction.CARDS.AUCTIONS.AUCTION;

  // Fetch active bids and asks for each nation
  for (const nation of config.nations) {
    let actives;
    try {
      actives = await parseXML(
        `https://www.nationstates.net/cgi-bin/api.cgi?q=cards+asksbids;nationname=${nation}`,
        config.userAgent
      );
      if (config.debugMode)
        console.log(`Fetched active bids and asks for ${nation}.`);
    } catch (error) {
      console.error(`Failed to fetch active bids and asks for ${nation}: ${error.message}`);
      continue;
    }

    // Extract the cards to track
    const toTrack = [];
    ["ASK", "BID"].forEach((type) => {
      const cards = actives.CARDS[type + "S"][type];
      if (Array.isArray(cards)) {
        cards.forEach((card) => {
          // Handle both API response formats
          const timestamp = parseInt(card.TIME_PLACED || card.TIMESTAMP) || 0;
          const price = parseFloat(card.BID_PRICE || card.PRICE) || 0;
          toTrack.push({
            id: card.CARDID,
            season: card.SEASON,
            name: card.NAME,
            type: type.toLowerCase(),
            nation: nation,
            price,
            timestamp,
          });
        });
      } else if (cards) {
        const timestamp = parseInt(cards.TIME_PLACED || cards.TIMESTAMP) || 0;
        const price = parseFloat(cards.BID_PRICE || cards.PRICE) || 0;
        toTrack.push({
          id: cards.CARDID,
          season: cards.SEASON,
          name: cards.NAME,
          type: type.toLowerCase(),
          nation: nation,
          price,
          timestamp,
        });
      }
    });

    if (config.debugMode)
      console.log(`Tracking ${toTrack.length} cards for ${nation}.`);

    // Process each transaction in the market
    if (Array.isArray(market)) {
      for (const transaction of market) {
        const card = toTrack.find(
          (card) =>
            card.id === transaction.CARDID && card.season === transaction.SEASON
        );
        if (card) {
          const cardKey = `${card.id}-${card.season}-${card.type}`;
          if (!cardMap.has(cardKey)) {
            const cardInfo = await getCardInfo(card, config.userAgent, activeNations, config.debugMode);
            if (!cardInfo) continue;

            // Check if this is a holding bid and should be filtered
            if (config.filterHoldingBids && card.type === 'bid') {
              // Get the timestamp from market data for this specific nation's bid
              let bidTimestamp = 0;
              if (cardInfo.markets && Array.isArray(cardInfo.markets)) {
                const marketBid = cardInfo.markets.find(m => 
                  m.NATION && m.NATION.toLowerCase() === card.nation.toLowerCase() && 
                  m.TYPE === 'bid'
                );
                if (marketBid && marketBid.TIMESTAMP) {
                  bidTimestamp = parseInt(marketBid.TIMESTAMP);
                }
              }
              
              // Fallback to card timestamp if market timestamp not found
              if (bidTimestamp === 0 && card.timestamp > 0) {
                bidTimestamp = card.timestamp;
              }
              
              const bidAgeHours = bidTimestamp > 0 ? (Date.now() / 1000 - bidTimestamp) / 3600 : 0;
              const isHoldingBid = card.price <= config.holdingBidThreshold && bidAgeHours > config.holdingBidAgeHours;
              
              if (config.debugMode) {
                console.log(`Holding bid check: ${card.name} (price: ${card.price}, threshold: ${config.holdingBidThreshold}, age: ${bidAgeHours.toFixed(1)}h, ageThreshold: ${config.holdingBidAgeHours}h, isHolding: ${isHoldingBid}, timestamp: ${bidTimestamp})`);
              }
              
              if (isHoldingBid) {
                if (config.debugMode) {
                  console.log(`Filtered holding bid: ${card.name} (price: ${card.price}, age: ${bidAgeHours.toFixed(1)} hours)`);
                }
                // Add to filtered holding bids list for compact view
                filteredHoldingBids.push({
                  name: card.name,
                  id: card.id,
                  season: card.season,
                  nation: card.nation,
                  price: card.price,
                  ageHours: bidAgeHours,
                  rarity: cardInfo.rarity,
                  rarityColor: cardInfo.rarityColor,
                  marketValue: cardInfo.marketValue,
                  highestBid: cardInfo.highestBid,
                  lowestAsk: cardInfo.lowestAsk
                });
                continue; // Skip adding to regular bids list
              }
            }

            cardMap.set(cardKey, cardInfo);

            const currentRarityIndex = getRarityIndex(
              cardInfo.rarity.toLowerCase()
            );
            if (currentRarityIndex > highestRarityIndex) {
              highestRarityIndex = currentRarityIndex;
              highestRarityColor = cardInfo.rarityColor.color;
              if (config.debugMode)
                console.log(
                  `Updated highest rarity to ${
                    cardInfo.rarity
                  } with color ${highestRarityColor.toString(16)}`
                );
            }
          } else {
            // If the card already exists in the map, just add the nation to the list
            cardMap.get(cardKey).nations.push(card.nation);
          }
        }
      }
    }
  }

  let { bidsList, asksList } = sortAndLogCards(cardMap, config.debugMode);

  let shouldSendMessage = true;
  let newFilteredHoldingBids = filteredHoldingBids;
  
  if (config.checkSnapshot === true) {
    const { hasNewAuctions, allBids, allAsks, newFilteredHoldingBids: newHoldingBids } = checkSnapshot(
      config.snapshotPath,
      bidsList,
      asksList,
      filteredHoldingBids
    );
    bidsList = allBids;
    asksList = allAsks;
    newFilteredHoldingBids = newHoldingBids;
    shouldSendMessage = hasNewAuctions || newHoldingBids.length > 0;
    if (config.debugMode)
      console.log(
        `Has new auctions: ${hasNewAuctions}, Total bids: ${bidsList.length}, Total asks: ${asksList.length}, New holding bids: ${newHoldingBids.length}`
      );
  }

  writeSnapshot(config.snapshotPath, bidsList, asksList, filteredHoldingBids);
  if (config.debugMode) console.log(`Snapshot written to ${config.snapshotPath}`);

  const allEntries = [
    { title: "Bids", list: bidsList },
    { title: "Asks", list: asksList },
  ];

  // Send message if there are new auctions OR new filtered holding bids
  if (shouldSendMessage) {
    await createDiscordMessage(hook, allEntries, newFilteredHoldingBids, highestRarityColor, config.mention, config.noPing);
  } else {
    console.log("No new auctions found. No messages sent to Discord.");
  }
}

/**
 * Main entry point
 */
async function main() {
  const configPaths = process.argv.slice(2);
  
  if (configPaths.length === 0) {
    console.error("Please provide at least one path to a config file.");
    console.error("Usage: node main.js <config1.json> [config2.json] [config3.json] ...");
    process.exit(1);
  }

  try {
    // Load all configurations
    const configs = loadMultipleConfigs(configPaths);
    
    console.log(`Processing ${configs.length} configuration(s)...`);
    
    // Process each configuration sequentially
    for (let i = 0; i < configs.length; i++) {
      console.log(`\n--- Processing config ${i + 1}/${configs.length}: ${configPaths[i]} ---`);
      try {
        await processConfig(configs[i]);
      } catch (error) {
        console.error(`Error processing config ${configPaths[i]}: ${error.message}`);
        console.error(error.stack);
      }
    }
    
    console.log(`\nCompleted processing all ${configs.length} configuration(s).`);
  } catch (error) {
    console.error(`Fatal error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Unhandled error in main:");
  console.error(error);
  process.exit(1);
});
