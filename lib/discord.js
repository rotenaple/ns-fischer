import { MessageBuilder } from "discord-webhook-node";
import { rarityColors } from "./cards.js";

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
 * @param {number} highestRarityColor - Color for the highest rarity
 * @param {string} mention - Mention string for pinging
 * @param {boolean} noPing - Whether to skip pinging
 * @returns {Promise<void>}
 */
export async function createDiscordMessage(hook, allEntries, highestRarityColor, mention, noPing) {
  let sentMessages = false;

  const hasAuctions = allEntries.some((entry) => entry.list.length > 0);

  if (hasAuctions) {
    // Send a separate message for pinging only if there are auctions
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
