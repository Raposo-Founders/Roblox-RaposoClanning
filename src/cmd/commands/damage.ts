import { defendersCommandCheck } from "cmd/cmdutils";
import { ConsoleFunctionCallback } from "cmd/cvar";
import GameEnvironment from "core/GameEnvironment";
import PlayerEntity from "entities/PlayerEntity";
import { gameValues } from "gamevalues";
import ChatSystem from "systems/ChatSystem";
import { colorTable } from "UI/values";
import { BufferReader } from "util/bufferreader";
import { startBufferCreation, writeBufferString, writeBufferU32 } from "util/bufferwriter";

// # Constants & variables
const CMD_INDEX_NAME = "cmd_damage";

// # Bindings & execution

GameEnvironment.BindCallbackToEnvironmentCreation(env => {
  if (!env.isServer) return;

  env.network.listenPacket(CMD_INDEX_NAME, info => {
    if (!info.sender || !info.sender.GetAttribute(gameValues.modattr)) return;

    const reader = BufferReader(info.content);
    const entityId = reader.string();
    const amount = reader.u32();

    let callerEntity: PlayerEntity | undefined;
    for (const ent of env.entity.getEntitiesThatIsA("PlayerEntity")) {
      if (ent.GetUserFromController() !== info.sender) continue;
      callerEntity = ent;
      break;
    }
    if (!callerEntity) return;

    const targetEntity = env.entity.entities.get(entityId);
    if (!targetEntity || !targetEntity.IsA("PlayerEntity")) {
      ChatSystem.sendSystemMessage(`Invalid player entity ${entityId}`, [info.sender]);
      return;
    }

    // Check to see if the sender is just someone with tempmod
    if (!defendersCommandCheck(callerEntity, targetEntity)) {
      ChatSystem.sendSystemMessage(gameValues.cmdtempmoddefendersdeny, [info.sender]);
      return;
    }

    targetEntity.takeDamage(amount);

    ChatSystem.sendSystemMessage(`Damaged ${targetEntity.GetUserFromController()} for ${amount} points.`, [info.sender]);
  });
});

new ConsoleFunctionCallback(["damage", "dmg"], [{ name: "player", type: "player" }, { name: "amount", type: "number" }])
  .setDescription("Damages a player")
  .setCallback((ctx) => {
    const targetPlayers = ctx.getArgument("player", "player").value;
    const amount = ctx.getArgument("amount", "number").value;

    if (targetPlayers.size() <= 0) {
      ChatSystem.sendSystemMessage(`<b><font color="${colorTable.errorneousColor}">Argument #1 unknown player.</font></b>`);
      return;
    }

    for (const ent of targetPlayers) {
      startBufferCreation();
      writeBufferString(ent.id);
      writeBufferU32(amount as number);
      ctx.env.network.sendPacket(CMD_INDEX_NAME);
    }
  });