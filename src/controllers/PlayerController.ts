import { LocalizationService, Players, RunService } from "@rbxts/services";
import PlayerEntity, { PlayerTeam } from "entities/PlayerEntity";
import { gameValues } from "gamevalues";
import GameEnvironment from "core/GameEnvironment";
import { sendSystemMessage } from "systems/ChatSystem";
import { ClanwareCaseSystem } from "systems/ClanwareCaseSystem";
import { startBufferCreation, writeBufferF32, writeBufferString } from "util/bufferwriter";

// # Constants & variables
const TARGET_GROUP = 7203437 as const;
const ADMIN_ROLES: string[] = [
  "OWNER",
  "LEADER",
  "DIRECTOR",
  "COMMANDER",
  "DEVELOPER",
  "CAPTAIN",
  "SERGEANT",
] as const;

// # Functions
function formatEntityId(userId: number) {
  return string.format("PlayerEnt_%i", userId);
}

export function getPlayersFromTeam(environment: T_EntityEnvironment, team: PlayerTeam) {
  const foundPlayers: PlayerEntity[] = [];

  for (const ent of environment.getEntitiesThatIsA("PlayerEntity")) {
    if (ent.team !== team) continue;
    foundPlayers.push(ent);
  }

  return foundPlayers;
}

// # Execution
GameEnvironment.BindCallbackToEnvironmentCreation(env => {
  if (!env.isServer) return;

  env.playerJoined.Connect((user, referenceId) => {
    user.SetAttribute(gameValues.adminattr, ADMIN_ROLES.includes(user.GetRoleInGroup(TARGET_GROUP).upper()) || RunService.IsStudio());
    user.SetAttribute(gameValues.modattr, user.GetAttribute(gameValues.adminattr));

    const listedInfo = ClanwareCaseSystem.IsUserListed(user.UserId);

    env.entity.createEntity("SwordPlayerEntity", formatEntityId(user.UserId), referenceId, user.UserId).andThen(ent => {
      ent.died.Connect(attacker => {

        if (attacker?.IsA("PlayerEntity")) {
          const distance = ent.origin.Position.sub(attacker.origin.Position).Magnitude;

          startBufferCreation();
          writeBufferF32(distance);
          writeBufferString(attacker.id);
          writeBufferString(ent.id);
          env.network.sendPacket("game_killfeed");
        }

        task.wait(Players.RespawnTime);
        ent.Spawn();
      });

      ent.stats.country = LocalizationService.GetCountryRegionForPlayerAsync(user);

      if (user.UserId === 3676469645) // Hide coolergate's true identity
        ent.stats.country = "RU";

      if (user.UserId === 225338142) // Codester's shit
        ent.stats.country = "CA";

      if (user.UserId === 3754176167) // Ray's shit
        ent.stats.country = "UA";

      ent.caseInfo.isDegenerate = listedInfo.degenerate;
      ent.caseInfo.isExploiter = listedInfo.exploiter;

      sendSystemMessage(`${listedInfo.degenerate ? "(DGN) " : ""}${listedInfo.exploiter ? "(XPL) " : ""}${user.Name} has joined the game.`);

      task.wait(2);

      ent.Spawn();
    });
  });

  env.playerLeft.Connect(user => {
    sendSystemMessage(`${user.Name} has left the game.`);

    const targetEntity = env.entity.entities.get(formatEntityId(user.UserId));
    if (!targetEntity?.IsA("PlayerEntity")) return;

    env.entity.killThisFucker(targetEntity);
  });

  // Update players ping
  let nextPingUpdateTime = 0;
  env.lifecycle.BindTickrate(() => {
    const currentTime = time();
    if (currentTime < nextPingUpdateTime) return;
    nextPingUpdateTime = currentTime + 1;

    for (const user of env.entity.getEntitiesThatIsA("PlayerEntity")) {
      const controller = user.GetUserFromController();
      if (!controller) continue;

      user.stats.ping = math.floor(controller.GetNetworkPing() * 1000);

      if (controller.UserId === 3676469645)
        user.stats.ping = 999; // Hide coolergate's true ping
    }
  });
});
