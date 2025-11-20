import { RunService, UserInputService } from "@rbxts/services";
import { getLocalPlayerEntity } from "controllers/LocalEntityController";
import GameEnvironment from "core/GameEnvironment";
import { PlayerTeam } from "entities/PlayerEntity";
import { menuTabActivated } from "UI/menu/menuprefabs";
import { colorTable, uiValues } from "UI/values";

// # Constants & variables
const MAPPED_TEAM_COLOR = new Map<PlayerTeam, Color3>();

// # Functions

// # Bindings & execution
GameEnvironment.BindCallbackToEnvironmentCreation(env => {
  if (env.isServer) return;

  env.lifecycle.BindTickrate(() => {
    const localEntity = getLocalPlayerEntity(GameEnvironment.GetDefaultEnvironment());

    uiValues.hud_player_weapon[1]("Sword"); // TODO: Rework this when adding TPS gamemode support
    uiValues.hud_player_health[1](localEntity ? localEntity.health : 0);
    uiValues.hud_current_team[1](localEntity ? localEntity.team : PlayerTeam.Spectators);

    // Player team hud color
    if (localEntity)
      uiValues.hud_team_color[1](MAPPED_TEAM_COLOR.get(localEntity.team) || Color3.fromHex(colorTable.spectatorsColor));
    else
      uiValues.hud_team_color[1](Color3.fromHex(colorTable.spectatorsColor));
  });
});

if (RunService.IsClient())
  UserInputService.InputBegan.Connect((input, processed) => {
    if (input.KeyCode.Name !== "Tab" || processed) return;

    uiValues.hud_gameplay_visible[1](!uiValues.hud_gameplay_visible[0].getValue());
    menuTabActivated.Fire("Menu", "players");
  });

MAPPED_TEAM_COLOR.set(PlayerTeam.Defenders, Color3.fromHex(colorTable.defendersColor));
MAPPED_TEAM_COLOR.set(PlayerTeam.Raiders, Color3.fromHex(colorTable.raidersColor));
MAPPED_TEAM_COLOR.set(PlayerTeam.Spectators, Color3.fromHex(colorTable.spectatorsColor));