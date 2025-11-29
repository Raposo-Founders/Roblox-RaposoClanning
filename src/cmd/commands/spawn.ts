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
const CMD_INDEX_NAME = "cmd_spawn";

// # Bindings & execution

GameEnvironment.BindCallbackToEnvironmentCreation(env => {
  if (!env.isServer) return;

  env.network.ListenPacket(CMD_INDEX_NAME, (sender, reader) => {
    if (!sender || !sender.GetAttribute(gameValues.modattr)) return;

    const entityId = reader.string();

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

    targetEntity.Spawn();

    ChatSystem.sendSystemMessage(`Spawned ${targetEntity.GetUserFromController()} (${targetEntity.id}).`);
  });
}); 

new ConsoleFunctionCallback(["spawn"], [{ name: "player", type: "player" }])
  .setDescription("Respawns a player(s)")
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