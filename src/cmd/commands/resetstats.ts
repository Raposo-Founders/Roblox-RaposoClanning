import { defendersCommandCheck } from "cmd/cmdutils";
import { ConsoleFunctionCallback } from "cmd/cvar";
import GameEnvironment from "core/GameEnvironment";
import { NetworkPacket } from "core/NetworkModel";
import PlayerEntity from "entities/PlayerEntity";
import { gameValues } from "gamevalues";
import ChatSystem from "systems/ChatSystem";
import { colorTable } from "UI/values";
import { writeBufferString } from "util/bufferwriter";

// # Constants & variables
const CMD_INDEX_NAME = "cmd_resetstats";

// # Bindings & execution

GameEnvironment.BindCallbackToEnvironmentCreation(env => {
  if (!env.isServer) return;

  env.network.ListenPacket(CMD_INDEX_NAME, (sender, reader) => {
    if (!sender || !sender.GetAttribute(gameValues.modattr)) return;

    const entityId = reader.string();

    // TODO: Make this an integrated UI interface for requesting stats resetting
    if (!sender.GetAttribute(gameValues.adminattr)) {
      ChatSystem.sendSystemMessage("The stats you have is what you get. (blame coolergate :P)");
      return;
    }

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

    if (!defendersCommandCheck(callerEntity, targetEntity)) {
      ChatSystem.sendSystemMessage(gameValues.cmdtempmoddefendersdeny);
      return;
    }

    targetEntity.stats.kills = 0;
    targetEntity.stats.damage = 0;
    targetEntity.stats.deaths = 0;

    ChatSystem.sendSystemMessage(`Reset ${targetEntity.GetUserFromController()}'s (${targetEntity.id}) stats.`); // All players
  });
}); 

new ConsoleFunctionCallback(["resetstats", "rs"], [{ name: "player", type: "player" }])
  .setDescription("Resets a player's stats")
  .setCallback((ctx) => {
    const targetPlayers = ctx.getArgument("player", "player").value;

    if (targetPlayers.size() <= 0) {
      ChatSystem.sendSystemMessage(`<b><font color="${colorTable.errorneousColor}">Argument #1 unknown player.</font></b>`);
      return;
    }

    for (const ent of targetPlayers) {
      const packet = new NetworkPacket(CMD_INDEX_NAME);
      writeBufferString(ent.id);
      ctx.env.network.SendPacket(packet);
    }
  });