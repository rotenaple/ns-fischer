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
        cards.forEach((card) =>
          toTrack.push({
            id: card.CARDID,
            season: card.SEASON,
            name: card.NAME,
            type: type.toLowerCase(),
            nation: nation,
          })
        );
      } else if (cards) {
        toTrack.push({
          id: cards.CARDID,
          season: cards.SEASON,
          name: cards.NAME,
          type: type.toLowerCase(),
          nation: nation,
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
  if (config.checkSnapshot === true) {
    const { hasNewAuctions, allBids, allAsks } = checkSnapshot(
      config.snapshotPath,
      bidsList,
      asksList
    );
    bidsList = allBids;
    asksList = allAsks;
    shouldSendMessage = hasNewAuctions;
    if (config.debugMode)
      console.log(
        `Has new auctions: ${hasNewAuctions}, Total bids: ${bidsList.length}, Total asks: ${asksList.length}`
      );
  }

  writeSnapshot(config.snapshotPath, bidsList, asksList);
  if (config.debugMode) console.log(`Snapshot written to ${config.snapshotPath}`);

  const allEntries = [
    { title: "Bids", list: bidsList },
    { title: "Asks", list: asksList },
  ];

  if (shouldSendMessage) {
    await createDiscordMessage(hook, allEntries, highestRarityColor, config.mention, config.noPing);
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
