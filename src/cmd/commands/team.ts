import { ConsoleFunctionCallback } from "cmd/cvar";
import { getPlayersFromTeam } from "controllers/PlayerController";
import GameEnvironment from "core/GameEnvironment";
import { NetworkPacket } from "core/NetworkModel";
import PlayerEntity from "entities/PlayerEntity";
import { PlayerTeam } from "gamevalues";
import { gameValues } from "gamevalues";
import { GetCreatorGroupInfo } from "providers/GroupsProvider";
import ChatSystem from "systems/ChatSystem";
import { colorTable } from "UI/values";
import { writeBufferString, writeBufferU8 } from "util/bufferwriter";

// # Constants & variables
const CMD_INDEX_NAME = "cmd_team";

// # Bindings & execution

GameEnvironment.BindCallbackToEnvironmentCreation(env => {
  if (!env.isServer) return;

  env.network.ListenPacket(CMD_INDEX_NAME, (sender, reader) => {
    if (!sender || !sender.GetAttribute(gameValues.modattr)) return;

    const entityId = reader.string();
    const team = reader.u8();

    let callerEntity: PlayerEntity | undefined;
    for (const ent of env.entity.getEntitiesThatIsA("PlayerEntity")) {
      if (ent.GetUserFromController() !== sender) continue;
      callerEntity = ent;
      break;
    }
    if (!callerEntity) return;

    const targetEntity = env.entity.entities.get(entityId);
    if (!targetEntity || !targetEntity.IsA("PlayerEntity")) {
      ChatSystem.sendSystemMessage(`Invalid player entity ${entityId}`, [sender]);
      return;
    }
    const targetController = targetEntity.GetUserFromController();

    if (team !== PlayerTeam.Spectators && (targetEntity.caseInfo.isDegenerate || targetEntity.caseInfo.isExploiter)) {
      ChatSystem.sendSystemMessage(`Unable to team player: ${targetController?.Name} is listed on Clanware.`);
      return;
    }

    // Prevent people with tempmod from messing with the defenders' team
    if (!sender.GetAttribute(gameValues.adminattr) && callerEntity.team !== PlayerTeam.Defenders) {
      if (team === PlayerTeam.Defenders || targetEntity.team === PlayerTeam.Defenders) {
        ChatSystem.sendSystemMessage(gameValues.cmdtempmoddefendersdeny);
        return;
      }
    }

    const creatorGroupInfo = GetCreatorGroupInfo();
    const raidingGroupId = tonumber(env.attributes.raidingGroupId);

    if (targetController && creatorGroupInfo && raidingGroupId) {
      if (team === PlayerTeam.Defenders && !targetController.IsInGroup(creatorGroupInfo.groupInfo.Id)) {
        ChatSystem.sendSystemMessage(`Unable to team player: ${targetController} is not in the "${creatorGroupInfo.groupInfo.Name}" group.`);
        return;
      }

      if (team === PlayerTeam.Defenders && targetController.IsInGroup(creatorGroupInfo.groupInfo.Id) && targetController.GetRankInGroup(creatorGroupInfo.groupInfo.Id) < 2) {
        ChatSystem.sendSystemMessage(`Unable to team player: ${targetController} is pending for the "${creatorGroupInfo.groupInfo.Name}" group.`);
        return;
      }

      if (team === PlayerTeam.Raiders && !targetController.IsInGroup(raidingGroupId)) {
        ChatSystem.sendSystemMessage(`Unable to team player: ${targetController} is not in the raiders' group.`);
        return;
      }
    }

    // Check if the amount of players exceedes the team size
    {
      const playersOnTeam = getPlayersFromTeam(env.entity, team);
      const totalDefinedSize = tonumber(env.attributes.totalTeamSize) || 999;

      if (playersOnTeam.size() + 1 > totalDefinedSize) {
        ChatSystem.sendSystemMessage(`Unable to team player: Maximum amount of players on the team exceeds ${totalDefinedSize}.`);
        return;
      }
    }

    targetEntity.team = team;
    targetEntity.Spawn();

    // Write reply
    let teamColor = colorTable.spectatorsColor;
    if (team === PlayerTeam.Defenders) teamColor = colorTable.defendersColor;
    if (team === PlayerTeam.Raiders) teamColor = colorTable.raidersColor;

    ChatSystem.sendSystemMessage(`${targetController} (${targetEntity.id}) joined the <font color="${teamColor}">${PlayerTeam[team]}</font> team.`);
  });
}); 

new ConsoleFunctionCallback(["team"], [{ name: "player", type: "player" }, { name: "team", type: "team" }])
  .setDescription("Changes a player's team")
  .setCallback((ctx) => {
    const targetPlayers = ctx.getArgument("player", "player").value;
    const team = ctx.getArgument("team", "team").value;

    if (targetPlayers.size() <= 0) {
      ChatSystem.sendSystemMessage(`<b><font color="${colorTable.errorneousColor}">Argument #1 unknown player.</font></b>`);
      return;
    }

    for (const ent of targetPlayers) {
      const packet = new NetworkPacket(CMD_INDEX_NAME);
      writeBufferString(ent.id);
      writeBufferU8(PlayerTeam[team]);
      ctx.env.network.SendPacket(packet);
    }
  });