import { ConsoleFunctionCallback } from "cmd/cvar";
import GameEnvironment from "core/GameEnvironment";
import { NetworkPacket } from "core/NetworkModel";
import PlayerEntity from "entities/PlayerEntity";
import { gameValues } from "gamevalues";
import ChatSystem from "systems/ChatSystem";
import { colorTable } from "UI/values";
import { writeBufferString, writeBufferU16 } from "util/bufferwriter";

// # Constants & variables
const CMD_INDEX_NAME = "cmd_tempmod";

// # Bindings & execution

GameEnvironment.BindCallbackToEnvironmentCreation(env => {
  if (!env.isServer) return;

  env.network.ListenPacket(CMD_INDEX_NAME, (sender, reader) => {
    if (!sender || !sender.GetAttribute(gameValues.adminattr)) return;

    const entityId = reader.u16();

    let callerEntity: PlayerEntity | undefined;
    for (const ent of env.entity.getEntitiesThatIsA("PlayerEntity")) {
      if (ent.GetUserFromController() !== sender) continue;
      callerEntity = ent;
      break;
    }
    if (!callerEntity) return;

    const targetEntity = env.entity.entities[entityId];
    if (!targetEntity || !targetEntity.IsA("PlayerEntity")) {
      ChatSystem.sendSystemMessage(`Invalid player entity ${entityId}`, [sender]);
      return;
    }

    const controller = targetEntity.GetUserFromController();
    if (!controller) {
      ChatSystem.sendSystemMessage(`PlayerEntity ${targetEntity.id} has no controller.`, [sender]);
      return;
    }

    controller.SetAttribute(gameValues.modattr, true);

    ChatSystem.sendSystemMessage(`Gave ${targetEntity.GetUserFromController()} temporary moderation privileges.`);
  });
}); 

new ConsoleFunctionCallback(["tempmod"], [{ name: "player", type: "player" }])
  .setDescription("Gives a player temporary moderation privileges")
  .setCallback((ctx) => {
    const targetPlayers = ctx.getArgument("player", "player").value;

    if (targetPlayers.size() <= 0) {
      ChatSystem.sendSystemMessage(`<b><font color="${colorTable.errorneousColor}">Argument #1 unknown player.</font></b>`);
      return;
    }

    for (const ent of targetPlayers) {
      const packet = new NetworkPacket(CMD_INDEX_NAME);
      writeBufferU16(ent.id);
      ctx.env.network.SendPacket(packet);
    }
  });