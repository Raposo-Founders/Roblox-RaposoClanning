import ColorUtils from "@rbxts/colour-utils";
import React from "@rbxts/react";
import ReactRoblox from "@rbxts/react-roblox";
import { Players, RunService } from "@rbxts/services";
import { COMMAND_EXECUTED } from "cmd";
import { ConsoleFunctionCallback } from "cmd/cvar";
import GameEnvironment from "core/GameEnvironment";
import { NetworkPacket } from "core/NetworkModel";

import { gameValues } from "gamevalues";
import { Window } from "UI/blocks/window";
import { uiValues } from "UI/values";
import { writeBufferString, writeBufferU64 } from "util/bufferwriter";

// # Constants & variables
const COMMAND_NETWORK_ID = "command_execution_log";
const [windowVisible, SetWindowVisible] = React.createBinding(false);

let currentContentFrame: Instance | undefined;

// # Functions
export function registerCommandExecutionLog(name: string, args: string, executor = Players.LocalPlayer) {
  if (!currentContentFrame || !RunService.IsClient()) return;

  const root = ReactRoblox.createRoot(currentContentFrame, { "hydrate": true });

  const hasAdmin = executor.GetAttribute(gameValues.adminattr);
  const hasMod = executor.GetAttribute(gameValues.modattr);

  let prefixText = "";
  const currentTime = DateTime.fromUnixTimestamp(workspace.GetServerTimeNow()).FormatUniversalTime("dddd DD/MM/YY LTS", "pt-br");

  if (hasMod) prefixText = "(MOD)";
  if (hasAdmin) prefixText = "(ADM)";

  const element = <textbox
    CursorPosition={-1}
    FontFace={new Font("rbxassetid://16658246179")}
    Text={`${currentTime} ${prefixText} ${executor.Name} -> ${name} ${args}`} // TODO: ADD "[PRE-MATCH (PRE-GAME?)]" TAG
    TextColor3={Color3.fromHex("#FFFFFF")}
    TextSize={18}
    TextWrapped={true}
    RichText={true}
    TextXAlignment={"Left"}
    AutomaticSize={"Y"}
    BackgroundTransparency={1}
    ClipsDescendants={true}
    LayoutOrder={currentContentFrame.GetChildren().size()}
    Size={UDim2.fromScale(1, 0)}
  />;

  root.render(element);
}

export function ConsoleCommandsLogs() {
  const contentRef = React.createRef<ScrollingFrame>();

  React.useEffect(() => {
    currentContentFrame = contentRef.current; 
  });

  return <Window
    AccentColor={uiValues.hud_team_color[0]}
    BackgroundColor={uiValues.hud_team_color[0].map(val => ColorUtils.Darken(val, 0.75))}
    Size={UDim2.fromScale(0.5, 0.5)}
    Title="Console logs"
    Visible={windowVisible}
    OnClose={() => SetWindowVisible(false)}
  >
    <scrollingframe
      AnchorPoint={new Vector2(0.5, 0.5)}
      AutomaticCanvasSize={"Y"}
      BackgroundTransparency={1}
      CanvasSize={new UDim2()}
      Position={UDim2.fromScale(0.5, 0.5)}
      ScrollBarThickness={0}
      Size={UDim2.fromScale(1, 1)}
      ref={contentRef}
    >
      <uilistlayout SortOrder={"LayoutOrder"} FillDirection={"Vertical"} />
    </scrollingframe>
  </Window>;
}

// # Bindings & execution
COMMAND_EXECUTED.Connect((name, args) => {
  registerCommandExecutionLog(name, args.join(" "));

  const packet = new NetworkPacket(COMMAND_NETWORK_ID);

  writeBufferString(name);
  writeBufferString(args.join(" "));
  GameEnvironment.GetDefaultEnvironment().network.SendPacket(packet);
});

GameEnvironment.BindCallbackToEnvironmentCreation(env => {
  if (!env.isServer) return;

  env.network.ListenPacket(COMMAND_NETWORK_ID, (sender, reader) => {
    if (!sender) return;

    const name = reader.string();
    const args = reader.string();

    for (const user of env.players) {
      if (user === sender) continue;

      const packet = new NetworkPacket(COMMAND_NETWORK_ID);
      packet.players = [user];

      writeBufferU64(sender.UserId);
      writeBufferString(name);
      writeBufferString(args);
      env.network.SendPacket(packet);
    }
  });
});

// Client
GameEnvironment.BindCallbackToEnvironmentCreation(env => {
  if (env.isServer) return;

  env.network.ListenPacket(COMMAND_NETWORK_ID, (sender, reader) => {
    const executor = reader.u64();
    const name = reader.string();
    const args = reader.string();

    registerCommandExecutionLog(name, args, Players.GetPlayerByUserId(executor));
  });
});

new ConsoleFunctionCallback(["logs"], [])
  .setCallback(() => SetWindowVisible(true));