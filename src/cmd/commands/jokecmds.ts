import { ConsoleFunctionCallback } from "cmd/cvar";
import GameEnvironment from "core/GameEnvironment";
import { gameValues } from "gamevalues";
import ChatSystem from "systems/ChatSystem";
import { startBufferCreation, writeBufferString } from "util/bufferwriter";

// # Constants & variables
const CMD_INDEX_NAME = "cmd_joke";

// # Bindings & execution

GameEnvironment.BindCallbackToEnvironmentCreation(env => {
  if (!env.isServer) return;

  env.network.listenPacket(CMD_INDEX_NAME, info => {
    if (!info.sender || !info.sender.GetAttribute(gameValues.modattr)) return;

    ChatSystem.sendSystemMessage(`Nice try ${info.sender.Name}, but this is not Kohl's admin.`);
  });
}); 

new ConsoleFunctionCallback(["fly", "ff", "forcefield", "invisible", "invis", "god"], [])
  .setCallback((ctx) => {
    startBufferCreation();
    writeBufferString("joke");
    ctx.env.network.sendPacket(CMD_INDEX_NAME);
  });