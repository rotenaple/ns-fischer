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
                return `[${formatNationName(nation)}](https://www.nationstates.net/page=deck/nation=${nation}/show_market=auctions)`;
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

  // Add compact view of filtered holding bids if any exist
  if (hasFilteredHoldingBids) {
    const filteredHoldingBidsContent = filteredHoldingBids
      .map((bid) => {
        const cardLink = `[${bid.name} S${bid.season}](https://www.nationstates.net/page=deck/card=${bid.id}/season=${bid.season})`;
        const nationLink = `[${formatNationName(bid.nation)}](https://www.nationstates.net/page=deck/nation=${bid.nation}/show_market=auctions)`;
        return `${bid.rarityColor.emoji} ${cardLink} - ${nationLink}\n\`MV:${bid.marketValue} ${bid.lowestAsk}/${bid.highestBid}\``;
      })
      .join('\n\n');

    const filteredHoldingBidsEmbed = new MessageBuilder()
      .setTitle(`Cards with Holding Bids (${filteredHoldingBids.length})`)
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
