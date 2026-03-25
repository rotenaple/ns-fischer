import { MessageBuilder } from "discord-webhook-node";
import { rarityColors } from "./cards.js";

/**
 * Format a nation name for display (replace underscores with spaces, capitalize each word)
 * @param {string} nationName - Nation name to format
 * @returns {string} Formatted nation name
 */
export function formatNationName(nationName) {
  return nationName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Split messages into chunks
 * @param {Array} entries - Array of entries to split
 * @param {number} chunkSize - Number of entries per chunk
 * @returns {Array} Array of chunks
 */
export function splitMessages(entries, chunkSize = 8) {
  const chunks = [];
  for (let i = 0; i < entries.length; i += chunkSize) {
    chunks.push(entries.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Create and send Discord messages for auction results
 * @param {Object} hook - Discord webhook object
 * @param {Array} allEntries - Array of entry objects with title and list
 * @param {Array} filteredHoldingBids - Array of holding bids that were filtered out
 * @param {number} highestRarityColor - Color for the highest rarity
 * @param {string} mention - Mention string for pinging
 * @param {boolean} noPing - Whether to skip pinging
 * @returns {Promise<void>}
 */
export async function createDiscordMessage(hook, allEntries, filteredHoldingBids, highestRarityColor, mention, noPing) {
  let sentMessages = false;

  const hasAuctions = allEntries.some((entry) => entry.list.length > 0);
  const hasFilteredHoldingBids = filteredHoldingBids && filteredHoldingBids.length > 0;

  if (hasAuctions || hasFilteredHoldingBids) {
    // Send a separate message for pinging only if there are auctions or filtered holding bids
    if (noPing === false) {
      await hook.send(mention);
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
                const price = nation.price !== undefined ? nation.price : 0;
                return `[${formatNationName(nation.name)}](https://www.nationstates.net/page=deck/nation=${nation.name}/show_market=auctions) (${price.toFixed(2)})`;
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

  // Add compact view of filtered holding bids/asks if any exist
  if (hasFilteredHoldingBids) {
    // Group by card (id + season) to show each card only once
    const cardGroups = {};
    filteredHoldingBids.forEach(item => {
      const key = `${item.id}-${item.season}`;
      if (!cardGroups[key]) {
        cardGroups[key] = {
          ...item,
          nations: [{ name: item.nation, type: item.type }]
        };
      } else {
        // Add nation to existing card group
        cardGroups[key].nations.push({ name: item.nation, type: item.type });
      }
    });
    
    const uniqueCards = Object.values(cardGroups);
    const holdingBidsCount = uniqueCards.filter(c => c.nations.some(n => n.type === 'bid')).length;
    const holdingAsksCount = uniqueCards.filter(c => c.nations.some(n => n.type === 'ask')).length;
    
    let title = `Holding Items (${uniqueCards.length} cards)`;
    if (holdingBidsCount > 0 && holdingAsksCount > 0) {
      title = `Holding Items (${uniqueCards.length} cards)`;
    } else if (holdingBidsCount > 0) {
      title = `Holding Bids (${holdingBidsCount})`;
    } else if (holdingAsksCount > 0) {
      title = `Holding Asks (${holdingAsksCount})`;
    }
    
    const filteredHoldingBidsContent = uniqueCards
      .map((card) => {
        const cardLink = `[${card.name} S${card.season}](https://www.nationstates.net/page=deck/card=${card.id}/season=${card.season})`;
        const nationLinks = card.nations.map(n => {
          const nationLink = `[${formatNationName(n.name)}](https://www.nationstates.net/page=deck/nation=${n.name}/show_market=auctions)`;
          const typeIcon = n.type === 'bid' ? '📉' : '📈';
          return `${typeIcon} ${nationLink}`;
        }).join(' ');
        const resolveTime = `<t:${Math.floor(card.endTime.getTime() / 1000)}:R>`;
        return `${card.rarityColor.emoji} ${cardLink}\n${nationLinks} (${resolveTime})\n\`MV:${card.marketValue} ${card.lowestAsk}/${card.highestBid}\``;
      })
      .join('\n\n');

    const filteredHoldingBidsEmbed = new MessageBuilder()
      .setTitle(title)
      .setDescription(filteredHoldingBidsContent)
      .setTimestamp()
      .setColor(rarityColors.common.color);

    await hook.send(filteredHoldingBidsEmbed);
  } else if (!sentMessages) {
    const embed = new MessageBuilder()
      .setDescription("No active auctions at the moment.")
      .setTimestamp()
      .setColor(rarityColors.common.color);

    await hook.send(embed);
  }
}
