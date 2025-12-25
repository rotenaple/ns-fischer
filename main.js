import { MessageBuilder, Webhook } from "discord-webhook-node";
import { parseXML } from "./parseXML.js";
import fs from "fs";
import process from "process";

const configPath = process.argv[2]; // Get the config path from command line arguments
if (!configPath) {
  console.error("Please provide a path to the config file.");
  process.exit(1);
}

function loadConfig(configPath) {
  try {
    const configFile = fs.readFileSync(configPath, "utf8");
    return JSON.parse(configFile);
  } catch (error) {
    console.error(`Error loading config file: ${error.message}`);
    process.exit(1);
  }
}

const config = loadConfig(configPath);
const DEBUG_MODE = config.debug_mode || false;
const WEBHOOK_URL = config.webhook_url;
const NATIONS = config.nations;
const AT = config.mention || "";

let NO_PING = config.no_ping || false;
if (AT === "") {
  NO_PING = true;
}

const CHECK_CTE = config.check_cte || true;

const SNAPSHOT_PATH =
  config.snapshot_path || "./snapshot/auction_snapshot.json";
const CHECK_SNAPSHOT = config.check_snapshot || false;
const USER_AGENT = config.user_agent || config.nations[0];

const rarityColors = {
  legendary: { emoji: ":yellow_circle:", color: 0xfdcb58 },
  epic: { emoji: ":red_circle:", color: 0xdd2d44 },
  //  epic: { emoji: ":orange_circle:", color: 0xf4900d },
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

// Function to split messages into chunks of a given size
function splitMessages(entries, chunkSize = 8) {
  const chunks = [];
  for (let i = 0; i < entries.length; i += chunkSize) {
    chunks.push(entries.slice(i, i + chunkSize));
  }
  return chunks;
}

// Function to write to snapshot
function writeSnapshot(snapshotPath, bids, asks) {
  const snapshot = {
    bids: bids.map((bid) => ({ cardId: bid.id, season: bid.season })),
    asks: asks.map((ask) => ({ cardId: ask.id, season: ask.season })),
  };
  fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
}

// Function to compare auction to snapshot for new bids
function checkSnapshot(snapshotPath, currentBids, currentAsks) {
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

// Function to get card info
async function getCardInfo(card, USER_AGENT) {
  try {
    const cardInfo = await parseXML(
      `https://www.nationstates.net/cgi-bin/api.cgi?q=card+markets+info;cardid=${card.id};season=${card.season}`,
      USER_AGENT
    );

    const cardAndMarketData = {
      category: cardInfo.CARD.CATEGORY,
      marketValue: cardInfo.CARD.MARKET_VALUE,
      markets: cardInfo.CARD.MARKETS.MARKET,
    };

    const { endTime } = calculateAuctionResolutionTime(
      cardAndMarketData.markets
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

    // Check if the nation is CTE
    let isCTE = false;
    if (CHECK_CTE) {
      try {
        const response = await parseXML(
          `https://www.nationstates.net/cgi-bin/api.cgi?nation=${cardInfo.CARD.NAME}&q=name`,
          USER_AGENT
        );

        isCTE = response.status === "failed with error code 404";

        if (DEBUG_MODE) {
          console.log(
            `CTE check for ${cardInfo.CARD.NAME}: ${isCTE ? "CTE" : "Active"}`
          );
        }
      } catch (error) {
        if (DEBUG_MODE) {
          console.error(
            `Error checking CTE status for ${cardInfo.CARD.NAME}: ${error.message}`
          );
        }
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
    if (DEBUG_MODE) console.log(`Failed to fetch data for card ID: ${card.id}`);
    return null;
  }
}

// Function to calculate auction resolution time
function calculateAuctionResolutionTime(markets) {
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

  if (DEBUG_MODE) {
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
      if (DEBUG_MODE)
        console.log(
          `Updated lowask to ${lowask.price} at timestamp ${lowask.timestamp}`
        );
    }
    if (market.type === "bid" && market.price > highbid.price) {
      highbid = { price: market.price, timestamp: market.timestamp };
      if (DEBUG_MODE)
        console.log(
          `Updated highbid to ${highbid.price} at timestamp ${highbid.timestamp}`
        );
    }

    if (DEBUG_MODE)
      console.log(
        `Current state - Lowask: ${lowask.price} at ${lowask.timestamp}, Highbid: ${highbid.price} at ${highbid.timestamp}`
      );

    if (highbid.price >= lowask.price) {
      if (DEBUG_MODE)
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

// Function to get the rarity index
function getRarityIndex(rarity) {
  return rarityOrder.indexOf(rarity.toLowerCase());
}

async function createDiscordMessage(hook, allEntries, highestRarityColor, AT) {
  let sentMessages = false;

  const hasAuctions = allEntries.some((entry) => entry.list.length > 0);

  if (hasAuctions) {
    // Send a separate message for pinging only if there are auctions
    if (NO_PING === false) {
      await hook.send(AT);
    }
  }

  for (const { title, list } of allEntries) {
    if (list.length > 0) {
      sentMessages = true;
      const chunks = splitMessages(list, 8);
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        let messageContent = chunk
          .map((card) => {
            const cardLink = `[${card.name} S${card.season}](https://www.nationstates.net/page=deck/card=${card.id}/season=${card.season})`;
            const nationLinks = card.nations
              .map((nation) => {
                return `[${nation}](https://www.nationstates.net/page=deck/nation=${nation}/show_market=auctions)`;
              })
              .join(", ");
            const cteStatus = card.isCTE ? "<:cte:1275000820391219200>" : "";
            return `${
              card.rarityColor.emoji
            }${cteStatus} ${cardLink}\nResolve: <t:${Math.floor(
              card.endTime.getTime() / 1000
            )}:t> (<t:${Math.floor(
              card.endTime.getTime() / 1000
            )}:R>)\nNations: ${nationLinks}\n\`MV:${card.marketValue} ${
              card.lowestAsk
            }/${card.highestBid}\`\n`;
          })
          .join("");

        if (i === 0) {
          messageContent = `**${title}:**\n${messageContent}`;
        } else {
          messageContent = `**${title} (cont'd):**\n${messageContent}`;
        }

        const embed = new MessageBuilder()
          .setTitle(i === 0 ? `Active Auctions in Progress` : "")
          .setDescription(messageContent)
          .setTimestamp()
          .setColor(highestRarityColor);

        await hook.send(embed);
      }
    }
  }

  if (!sentMessages) {
    const embed = new MessageBuilder()
      .setDescription("No active auctions at the moment.")
      .setTimestamp()
      .setColor(rarityColors.common.color);

    await hook.send(embed);
  }
}

function sortAndLogCards(cardMap, DEBUG_MODE) {
  // Convert the Map to arrays and sort
  let bidsList = Array.from(cardMap.values()).filter(
    (card) => card.type === "bid"
  );
  let asksList = Array.from(cardMap.values()).filter(
    (card) => card.type === "ask"
  );

  // Sort the bids and asks by end time
  bidsList.sort((a, b) => a.endTime - b.endTime);
  asksList.sort((a, b) => a.endTime - b.endTime);

  if (DEBUG_MODE) {
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

async function main() {
  const hook = new Webhook(WEBHOOK_URL);

  // Check for required parameters
  if (!WEBHOOK_URL || !NATIONS.length) {
    const embed = new MessageBuilder()
      .setTitle(`Error`)
      .setDescription("Required parameters missing")
      .setTimestamp();
    await hook.send(embed);
    return;
  }

  let highestRarityIndex = -1;
  let highestRarityColor = rarityColors.common.color; // Default to common
  let cardMap = new Map(); // Use a Map to store unique cards

  if (DEBUG_MODE) {
    console.log(
      `Starting script...\n
      Parameters are set. Creating webhook...\n
      Fetching active auctions...\n`
    );
  }

  // Fetch active auctions
  let auction;
  try {
    auction = await parseXML(
      "https://www.nationstates.net/cgi-bin/api.cgi?q=cards+auctions",
      USER_AGENT
    );
    if (DEBUG_MODE) console.log(`Fetched active auctions.`);
  } catch (error) {
    const errorEmbed = new MessageBuilder()
      .setTitle(`Error`)
      .setDescription(`Failed to fetch active auctions: ${error.message}`)
      .setTimestamp();
    await hook.send(errorEmbed);
    return; // Exit the function if we can't fetch auctions
  }

  const market = auction.CARDS.AUCTIONS.AUCTION;

  // Fetch active bids and asks for each nation
  for (const NATION of NATIONS) {
    let actives;
    try {
      actives = await parseXML(
        `https://www.nationstates.net/cgi-bin/api.cgi?q=cards+asksbids;nationname=${NATION}`,
        USER_AGENT
      );
      if (DEBUG_MODE)
        console.log(`Fetched active bids and asks for ${NATION}.`);
    } catch (error) {
      const errorEmbed = new MessageBuilder()
        .setTitle(`Error`)
        .setDescription(
          `Failed to fetch active bids and asks for ${NATION}: ${error.message}`
        )
        .setTimestamp();
      await hook.send(errorEmbed);
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
            nation: NATION,
          })
        );
      } else if (cards) {
        toTrack.push({
          id: cards.CARDID,
          season: cards.SEASON,
          name: cards.NAME,
          type: type.toLowerCase(),
          nation: NATION,
        });
      }
    });

    if (DEBUG_MODE)
      console.log(`Tracking ${toTrack.length} cards for ${NATION}.`);

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
            const cardInfo = await getCardInfo(card, USER_AGENT);
            if (!cardInfo) continue;

            cardMap.set(cardKey, cardInfo);

            const currentRarityIndex = getRarityIndex(
              cardInfo.rarity.toLowerCase()
            );
            if (currentRarityIndex > highestRarityIndex) {
              highestRarityIndex = currentRarityIndex;
              highestRarityColor = cardInfo.rarityColor.color;
              if (DEBUG_MODE)
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

  let { bidsList, asksList } = sortAndLogCards(cardMap, DEBUG_MODE);

  let shouldSendMessage = true;
  if (CHECK_SNAPSHOT === true) {
    const { hasNewAuctions, allBids, allAsks } = checkSnapshot(
      SNAPSHOT_PATH,
      bidsList,
      asksList
    );
    bidsList = allBids;
    asksList = allAsks;
    shouldSendMessage = hasNewAuctions;
    if (DEBUG_MODE)
      console.log(
        `Has new auctions: ${hasNewAuctions}, Total bids: ${bidsList.length}, Total asks: ${asksList.length}`
      );
  }

  writeSnapshot(SNAPSHOT_PATH, bidsList, asksList);
  if (DEBUG_MODE) console.log(`Snapshot written to ${SNAPSHOT_PATH}`);

  const allEntries = [
    { title: "Bids", list: bidsList },
    { title: "Asks", list: asksList },
  ];

  if (shouldSendMessage) {
    await createDiscordMessage(hook, allEntries, highestRarityColor, AT);
  } else {
    console.log("No new auctions found. No messages sent to Discord."); // Important, always log
  }

  if (DEBUG_MODE) {
    const debugEmbed = new MessageBuilder()
      .setTitle(`Debug`)
      .setDescription(`Script running.\nDebug mode is enabled.`)
      .setTimestamp()
      .setColor(0x000000);
    await hook.send(debugEmbed);
  }
}

main().catch(async (error) => {
  const hook = new Webhook(WEBHOOK_URL);
  const errorEmbed = new MessageBuilder()
    .setTitle(`Unhandled Error`)
    .setDescription(`An unhandled error occurred: ${error.message}`)
    .setTimestamp();
  await hook.send(errorEmbed);
  console.error(error);
});
