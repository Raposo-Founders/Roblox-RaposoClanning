import { ConsoleFunctionCallback } from "cmd/cvar";
import GameEnvironment from "core/GameEnvironment";
import { PlayerTeam } from "entities/PlayerEntity";
import { gameValues } from "gamevalues";
import { GetGroupInfo } from "providers/GroupsProvider";
import WorldProvider from "providers/WorldProvider";
import { uiValues } from "UI/values";
import { BufferReader } from "util/bufferreader";
import { startBufferCreation, writeBufferF32, writeBufferU32, writeBufferU8 } from "util/bufferwriter";
import ChatSystem from "../systems/ChatSystem";
import { webhookLogEvent } from "../systems/WebhookSystem";
import { getPlayersFromTeam } from "./PlayerController";

// # Constants & variables

// # Functions
function SpawnCapturePoints(session: GameEnvironment) {
  for (const obj of WorldProvider.ObjectsFolder.GetChildren()) {
    if (!obj.IsA("BasePart")) continue;
    if (obj.Name !== "ent_objective_capturepoint") continue;

    session.entity.createEntity("CapturePointEntity", undefined, obj.CFrame, obj.Size);
  }
}

function ResetCapturePoints(session: GameEnvironment) {
  for (const ent of session.entity.getEntitiesThatIsA("CapturePointEntity")) {
    ent.capture_progress = 0;
    ent.current_team = PlayerTeam.Spectators;
  }
}

function ResetPlayers(session: GameEnvironment) {
  for (const ent of session.entity.getEntitiesThatIsA("PlayerEntity")) {
    ent.stats.kills = 0;
    ent.stats.deaths = 0;
    ent.stats.damage = 0;
    ent.Spawn();
  }
}

// # Bindings & misc
GameEnvironment.BindCallbackToEnvironmentCreation(env => {
  if (!env.isServer) return;

  const teamPoints = new Map<PlayerTeam, number>();
  let isRunning = false;
  let targetPoints = 600;
  let nextUpdateTime = 0;
  let raidingGroupId = 0;
  let totalTeamSize = 5;
  
  let elapsedMatchTime = 0;
  
  SpawnCapturePoints(env);

  env.network.listenPacket("match_start", (packet) => {
    if (!packet.sender) return;
    if (!packet.sender.GetAttribute(gameValues.adminattr)) return;

    if (raidingGroupId === 0) {
      ChatSystem.sendSystemMessage(`Unable to start match: Raiding group id must be set first with ${gameValues.cmdprefix}setraiders <groupId>.`);
      return;
    }

    const reader = BufferReader(packet.content);
    const pointsAmount = reader.u32();

    isRunning = true;
    targetPoints = pointsAmount;
    teamPoints.clear();

    ResetCapturePoints(env);
    ResetPlayers(env);

    nextUpdateTime = time() + 1;
    elapsedMatchTime = 0;

    // SPAMMMMMM
    ChatSystem.sendSystemMessage("!!! MATCH STARTED !!!");
    ChatSystem.sendSystemMessage("!!! MATCH STARTED !!!");
    ChatSystem.sendSystemMessage("!!! MATCH STARTED !!!");
  });

  env.network.listenPacket("match_changepts", (packet) => {
    if (!packet.sender) return;
    if (!packet.sender.GetAttribute(gameValues.adminattr)) return;

    const reader = BufferReader(packet.content);
    targetPoints = reader.u32();
  });

  // Core logic loop
  env.lifecycle.BindTickrate((dt) => {
    if (!isRunning) return;

    elapsedMatchTime += dt.tickrate;

    const currentTime = time();
    if (currentTime < nextUpdateTime) return;
    nextUpdateTime = currentTime + 1;

    for (const ent of env.entity.getEntitiesThatIsA("CapturePointEntity")) {
      if (math.abs(ent.capture_progress) !== 1) continue;
      if (ent.current_team === PlayerTeam.Spectators) continue;

      const pointsAmount = (teamPoints.get(ent.current_team) || 0);
      teamPoints.set(ent.current_team, pointsAmount + 1);
    }

    for (const [teamIndex, points] of teamPoints) {
      if (points >= targetPoints) {
        isRunning = false;

        startBufferCreation();
        // writeBufferU32(targetPoints);
        writeBufferU8(teamIndex);
        writeBufferU32(teamPoints.get(PlayerTeam.Defenders) || 0);
        writeBufferU32(teamPoints.get(PlayerTeam.Raiders) || 0);
        env.network.sendPacket("match_ended");

        webhookLogEvent(
          teamIndex,
          teamPoints.get(PlayerTeam.Defenders) || 0,
          teamPoints.get(PlayerTeam.Raiders) || 0,
          env.entity,
        );

        break;
      }
    }
  });

  // Match status update
  env.lifecycle.BindTickrate(ctx => {
    startBufferCreation();
    writeBufferU32(targetPoints);
    writeBufferU32(raidingGroupId);
    writeBufferU8(totalTeamSize);
    writeBufferU32(teamPoints.get(PlayerTeam.Defenders) || 0);
    writeBufferU32(teamPoints.get(PlayerTeam.Raiders) || 0);
    writeBufferF32(elapsedMatchTime);
    env.network.sendPacket("match_update", undefined, undefined, true);
  });

  env.network.listenPacket("match_teamamount", info => {
    if (!info.sender) return;
    if (!info.sender.GetAttribute(gameValues.adminattr)) return;

    const reader = BufferReader(info.content);
    const playersAmount = reader.u8();

    totalTeamSize = playersAmount;
    env.attributes.totalTeamSize = playersAmount;
  });

  env.network.listenPacket("match_setraiders", info => {
    if (!info.sender) return;
    if (!info.sender.GetAttribute(gameValues.adminattr)) return;

    const reader = BufferReader(info.content);
    const groupId = reader.u32();

    raidingGroupId = groupId;
    env.attributes.raidingGroupId = groupId;

    ChatSystem.sendSystemMessage(`Set raiders' group to: ${GetGroupInfo(groupId).Name} (${groupId}).`);

    // Check to see if all the raiding players are in the raiding group
    for (const ent of getPlayersFromTeam(env.entity, PlayerTeam.Raiders)) {
      const controller = ent.GetUserFromController();
      if (!controller || controller.IsInGroup(groupId)) continue;

      ent.team = PlayerTeam.Spectators;
      ent.Spawn();

      ChatSystem.sendSystemMessage(`Player ${controller.Name} moved to spectators: Not in the raiding group.`);
    }
  });

  env.lifecycle.BindTickrate(ctx => {
    // if (!isRunning) return;

    for (const ent of env.entity.getEntitiesThatIsA("CapturePointEntity")) {
      ent.UpdateCaptureProgress(ctx.tickrate);

      startBufferCreation();
      ent.WriteStateBuffer();
      env.network.sendPacket("cpent_update");
    }
  });
});

GameEnvironment.BindCallbackToEnvironmentCreation(env => {
  if (env.isServer) return;

  env.network.listenPacket("match_update", (packet) => {
    const reader = BufferReader(packet.content);
    const targetPoints = reader.u32();
    const raidingGroupId = reader.u32();
    const matchTeamSize = reader.u8();
    const defendersPoints = reader.u32();
    const raidersPoints = reader.u32();
    const elapsedTime = reader.f32();

    uiValues.hud_target_points[1](targetPoints);
    uiValues.hud_defenders_points[1](defendersPoints);
    uiValues.hud_raiders_points[1](raidersPoints);
    uiValues.hud_game_time[1](elapsedTime);
    uiValues.hud_gamemode[1]("Fairzone"); // TODO: Replicate current gamemode
    uiValues.hud_team_size[1](matchTeamSize);
    uiValues.hud_raiders_group[1](raidingGroupId);
  });

  env.network.listenPacket("cpent_update", (packet) => {
    const reader = BufferReader(packet.content);
    const entityId = reader.string();

    const targetEntity = env.entity.entities.get(entityId);
    if (!targetEntity || !targetEntity.IsA("CapturePointEntity")) {

      env.entity.createEntity(
        "CapturePointEntity",
        entityId,
        new CFrame(),
        Vector3.one,
      ).andThen(ent => ent.ApplyStateBuffer(reader));

      return;
    }

    targetEntity.ApplyStateBuffer(reader);
  });
});

new ConsoleFunctionCallback(["setraiders"], [{ name: "groupId", type: "number" }])
  .setDescription("Sets the raiding group's ID")
  .setCallback(ctx => {
    const raidingGroupId = ctx.getArgument("groupId", "number");

    startBufferCreation();
    writeBufferU32(raidingGroupId.value);
    ctx.env.network.sendPacket("match_setraiders");
  });

new ConsoleFunctionCallback(["teamsize"], [{ name: "amount", type: "number" }])
  .setDescription("Changes the amount of players allowed on each playing team")
  .setCallback((ctx) => {
    const playersAmount = math.min(ctx.getArgument("amount", "number").value, 255);

    startBufferCreation();
    writeBufferU8(playersAmount);
    ctx.env.network.sendPacket("match_teamamount");
  });

new ConsoleFunctionCallback(["start"], [{ name: "points", type: "number" }, { name: "raidersGroupId", type: "number" }])
  .setDescription("Starts the match with the given points and raiding group ID")
  .setCallback((ctx) => {
    const pointsAmount = ctx.getArgument("points", "number").value;

    startBufferCreation();
    writeBufferU32(pointsAmount);
    ctx.env.network.sendPacket("match_start");
  });