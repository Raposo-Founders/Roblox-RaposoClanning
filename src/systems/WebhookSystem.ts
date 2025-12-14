import { DiscordEmbed, DiscordMessage, DiscordWebhook } from "@rbxts/discord-webhook";
import { HttpService, RunService } from "@rbxts/services";
import { PlayerTeam } from "gamevalues";
import { getPlayersFromTeam } from "../controllers/PlayerController";
import { GetGameName } from "providers/GroupsProvider";

// # Variables
const eventsWebhook = new DiscordWebhook("https://webhook.lewisakura.moe/api/webhooks/1427701586490298608/oMtMGMsHFehNSRxF1GZ3O6sMF8aYuGgUPoU1rvzaIoAAUPnbp_WX6x01_fwzQUvtOQj9");

// # Functions
export function webhookLogEvent(winningTeam: PlayerTeam, defendersScore: number, raidersScore: number, environment: T_EntityEnvironment) {
  if (!RunService.IsServer()) return;

  const defendingPlayers = getPlayersFromTeam(environment, PlayerTeam.Defenders);
  const raidingPlayers = getPlayersFromTeam(environment, PlayerTeam.Raiders);

  let finalDefendingPlayersText = "";
  let finalRaidingPlayersText = "";

  const scoresText = `Score: ${math.max(defendersScore, raidersScore)} - ${math.min(defendersScore, raidersScore)} | ${math.floor(math.abs(defendersScore - raidersScore))} points difference.`;

  defendingPlayers.sort((a, b) => a.statsKills > b.statsKills);

  for (const ent of defendingPlayers) {
    const controller = ent.GetUserFromController();

    if (finalDefendingPlayersText !== "")
      finalDefendingPlayersText = `${finalDefendingPlayersText}\n`;

    finalDefendingPlayersText = `${finalDefendingPlayersText}- ${controller?.Name} (${controller ? controller.UserId : "BOT"})`;
    finalDefendingPlayersText = `${finalDefendingPlayersText} | K: ${ent.statsKills} | D: ${ent.statsDeaths} | R: ${math.floor((ent.statsKills / ent.statsDeaths) * 100) * 0.01}`;
  }

  for (const ent of raidingPlayers) {
    const controller = ent.GetUserFromController();

    if (finalRaidingPlayersText !== "")
      finalRaidingPlayersText = `${finalRaidingPlayersText}\n`;

    finalRaidingPlayersText = `${finalRaidingPlayersText}- ${controller?.Name} (${controller ? controller.UserId : "BOT"})`;
    finalRaidingPlayersText = `${finalRaidingPlayersText} | K: ${ent.statsKills} | D: ${ent.statsDeaths} | R: ${math.floor((ent.statsKills / ent.statsDeaths) * 100) * 0.01}`;
  }

  const defendersEmbed = new DiscordEmbed()
    .setTitle(`Defenders - ${defendingPlayers.size()} players.`)
    .setDescription(finalDefendingPlayersText);
  
  const raidersEmbed = new DiscordEmbed()
    .setTitle(`Raiders - ${raidingPlayers.size()} players.`)
    .setDescription(finalRaidingPlayersText);
  
  const message = new DiscordMessage(`Event ended - ${GetGameName()}\nWinners: ${PlayerTeam[winningTeam]}\n${scoresText}`)
    .addEmbed(defendersEmbed)
    .addEmbed(raidersEmbed);
  
  eventsWebhook.send(message);
}