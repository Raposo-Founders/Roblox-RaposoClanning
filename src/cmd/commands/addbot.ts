import { Players } from "@rbxts/services";
import { ConsoleFunctionCallback } from "cmd/cvar";
import GameEnvironment from "core/GameEnvironment";
import { NetworkPacket } from "core/NetworkModel";
import PlayerEntity from "entities/PlayerEntity";
import { PlayerTeam } from "gamevalues";
import { gameValues } from "gamevalues";
import ChatSystem from "systems/ChatSystem";
import { writeBufferString } from "util/bufferwriter";

// # Constants & variables
const CMD_INDEX_NAME = "cmd_addbot";

// # Functions

// # Bindings & misc
new ConsoleFunctionCallback(["addbot"], [{ name: "name", type: "string" }])
  .setCallback(ctx => {
    const entityName = ctx.getArgument("name", "string");

    const packet = new NetworkPacket(CMD_INDEX_NAME);
    writeBufferString(entityName.value);
    ctx.env.network.SendPacket(packet);
  });

GameEnvironment.BindCallbackToEnvironmentCreation(env => {
  if (!env.isServer) return;

  env.network.ListenPacket(CMD_INDEX_NAME, (sender, reader) => {
    if (!sender) return;

    const entityName = reader.string();

    const sessionList = GameEnvironment.GetServersFromPlayer(sender);

    for (const session of sessionList) {
      let callerEntity: PlayerEntity | undefined;
      for (const ent of env.entity.getEntitiesThatIsA("PlayerEntity")) {
        if (ent.GetUserFromController() !== sender) continue;
        callerEntity = ent;
        break;
      }
      if (!callerEntity) continue;

      session.entity.createEntity("SwordPlayerEntity", `bot_${entityName}`, "", sender.UserId)
        .andThen(ent => {
          ent.team = PlayerTeam.Raiders;
          ent.networkOwner = tostring(sender!.GetAttribute(gameValues.usersessionid));

          let currentThread: thread | undefined;

          ent.spawned.Connect(() => {
            if (currentThread)
              task.cancel(currentThread);

            ent.Equip();

            currentThread = task.spawn(() => {
              while (ent.health > 0) {
                ent.Attack1();
                env.lifecycle.YieldForTicks(1);
              }
            });
          });

          ent.died.Connect(() => {
            if (currentThread)
              task.cancel(currentThread);
            currentThread = undefined;

            task.wait(Players.RespawnTime);
            ent.Spawn();
          });

          ent.Spawn();

          ChatSystem.sendSystemMessage(`Spawned bot ${ent.id}.`);
        });
    }
  });
});