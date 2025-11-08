import React from "@rbxts/react";
import { Players, ReplicatedStorage, RunService, StarterGui } from "@rbxts/services";
import StartControllers from "controllers";
import { defaultEnvironments } from "defaultinsts";
import { requireEntities } from "entities";
import { modulesFolder, uiFolder } from "folders";
import { gameValues } from "gamevalues";
import { earlyUpdateLifecycleInstances, lateUpdateLifecycleInstances } from "lifecycle";
import { RaposoConsole } from "logging";
import { listenDirectPacket } from "network";
import { GetCreatorGroupInfo, GetGameName } from "providers/GroupsProvider";
import { HttpProvider } from "providers/HttpProvider";
import SessionInstance from "providers/SessionProvider";
import StartSystems from "systems";
import { CameraSystem } from "systems/CameraSystem";
import ChatSystem from "systems/ChatSystem";
import { CommandLine } from "UI/cmdline";
import { ConsoleCommandsLogs } from "UI/cmdline/logs";
import { FairzoneCounter } from "UI/hud/fairzonetimer";
import { FairzoneTopDisplay } from "UI/hud/fairzonetopdisplay";
import { KillfeedDisplay } from "UI/hud/killfeedDisplay";
import { NotificationsDisplay } from "UI/hud/notificationmsg";
import { ObjectivesLine } from "UI/hud/objectivesDisplay";
import { PlayersTopListing } from "UI/hud/playerteamentry";
import { SpectatorLabel } from "UI/hud/spectatinglabel";
import { DisplayLoadingScreen, HideLoadingScreen } from "UI/loadscreen";
import { Menu } from "UI/menu";
import { defaultRoot, uiValues } from "UI/values";
import { BufferReader } from "util/bufferreader";


// # Constants & variables

// # Functions
function CleanUpWorkspace() {
  if (!RunService.IsServer()) return;

  for (const inst of workspace.GetChildren()) {
    if (
      inst.IsA("Folder")
      || inst.IsA("Terrain")
      || inst.IsA("RemoteEvent")
      || inst.IsA("RemoteFunction")
      || inst.IsA("UnreliableRemoteEvent")
    ) continue;
    inst.Destroy();
  }

  for (const inst of StarterGui.GetChildren()) {
    inst.Parent = uiFolder;
  }
}

function WaitForServer() {
  if (!RunService.IsClient()) return;
  while (!ReplicatedStorage.GetAttribute("ServerRunning")) task.wait();
}

function ExecuteGameModules() {
  for (const inst of modulesFolder.GetChildren()) {
    if (!inst.IsA("ModuleScript")) continue;
    if (!inst.GetAttribute(`Execute${RunService.IsServer() ? "Server" : "Client"}`)) continue;

    task.spawn(() => {
      require(inst);
    });
  }
}

function BindLifeCycle() {
  const updateFunction = (dt: number) => {
    CameraSystem.updateCamera(dt);

    earlyUpdateLifecycleInstances(dt);
    lateUpdateLifecycleInstances(dt);
  };

  const lateUpdateFunction = (dt: number) => {
  };

  if (RunService.IsClient())
    RunService.PreRender.Connect(dt => updateFunction(dt));
  else
    RunService.PreSimulation.Connect(dt => updateFunction(dt));

  RunService.PostSimulation.Connect(dt => lateUpdateFunction(dt));
}

// # Execution
if (RunService.IsClient())
  while (!game.IsLoaded()) task.wait();

GetCreatorGroupInfo(); // Pre-cache this thing
GetGameName();

if (RunService.IsClient()) {
  StarterGui.SetCoreGuiEnabled("All", false);
  StarterGui.SetCoreGuiEnabled("Chat", true);
  WaitForServer();
}

requireEntities();

if (RunService.IsServer())
  CleanUpWorkspace();

_G.Raposo = {
  Systems: {},
  Controllers: {},
  Environment: {
    Folders: import("folders").expect(),
    Sessions: import("providers/SessionProvider").expect(),
    Network: import("network").expect(),
    defaultEnvironments,
    util: {
      BufferReader: BufferReader,
      BufferWriter: import("util/bufferwriter").expect(),
    }
  }
};
StartSystems(_G.Raposo.Systems);
StartControllers(_G.Raposo.Controllers);
ExecuteGameModules();

// Misc & other shit
if (RunService.IsClient()) {
  defaultEnvironments.lifecycle.BindTickrate((_, dt) => {
    defaultEnvironments.network.processIncomingPackets();

    for (const [, entity] of defaultEnvironments.entity.entities)
      task.spawn(() => entity.Think(dt));
  });
  defaultEnvironments.lifecycle.running = true;
}

if (RunService.IsServer()) {
  print("Starting.");

  const url = "http://ip-api.com/json/";
  const info = HttpProvider.Get(url) as {
    countryCode: string,
    region: string,
    timezone: string,
    status: string,
  };

  if (info.status === "success")
    ReplicatedStorage.SetAttribute("ServerLocation", `${info.countryCode}-${info.region}`);

  defaultEnvironments.lifecycle.running = true;
  defaultEnvironments.entity.isServer = true;
  defaultEnvironments.server = new SessionInstance(
    "default",
    defaultEnvironments.network,
    defaultEnvironments.entity,
    defaultEnvironments.lifecycle,
  );

  ReplicatedStorage.SetAttribute("ServerRunning", true);
}

if (RunService.IsClient()) {
  listenDirectPacket(gameValues.cmdnetinfo, (_, bfr) => {
    const reader = BufferReader(bfr);
    const message = reader.string();
  
    RaposoConsole.Info(message);
    ChatSystem.sendSystemMessage(message);
  });
  
  // Build interface
  // Shared UI
  defaultRoot.render(<>
    <frame // 16:9 aspect ratio gameplay frame
      AnchorPoint={new Vector2(0.5, 0.5)}
      BackgroundTransparency={1}
      Position={UDim2.fromScale(0.5, 0.5)}
      Size={UDim2.fromScale(1, 1)}
      // Visible={uiValues.hud_gameplay_visible[0]}
    >
      <uiaspectratioconstraint AspectRatio={1.78} />
      <uipadding
        PaddingBottom={new UDim(0, 16)}
        PaddingLeft={new UDim(0, 16)}
        PaddingRight={new UDim(0, 16)}
        PaddingTop={new UDim(0, 16)}
      />

      <FairzoneTopDisplay>
        <PlayersTopListing team="Defenders" />
        <FairzoneCounter />
        <PlayersTopListing team="Raiders" />
      </FairzoneTopDisplay>

      <ObjectivesLine />

      <SpectatorLabel />

      <KillfeedDisplay />
    </frame>

    <frame // Non gameplay related stuff
      AnchorPoint={new Vector2(0.5, 0.5)}
      BackgroundColor3={new Color3()}
      BackgroundTransparency={0.5}
      Position={UDim2.fromScale(0.5, 0.5)}
      Size={UDim2.fromScale(1, 1)}
      Visible={uiValues.hud_gameplay_visible[0].map(val => !val)}
    >
      <uipadding
        PaddingBottom={new UDim(0, 16)}
        PaddingLeft={new UDim(0, 16)}
        PaddingRight={new UDim(0, 16)}
        PaddingTop={new UDim(0, 16)}
      />

      <Menu />
    </frame>

    <NotificationsDisplay />

    <CommandLine />
    <ConsoleCommandsLogs />

    {/* <ChatBar /> */}
    {/* <ChatButton /> */}
    {/* <ChatWindow /> */}
  </>);

  // Import interface from storage and execute modules
  for (const inst of uiFolder.GetChildren()) {
    inst.Parent = Players.LocalPlayer.WaitForChild("PlayerGui");

    if (!inst.IsA("ScreenGui")) continue;

    const executeModuleAttribute = tostring(inst.GetAttribute("ExecuteModule"));
    const targetModule = inst.WaitForChild(executeModuleAttribute, 1);

    if (!targetModule?.IsA("ModuleScript")) continue;
    task.spawn(() => require(targetModule));
  }
}

BindLifeCycle();

task.spawn(() => {
  DisplayLoadingScreen("Init")
  task.wait(10);
  HideLoadingScreen("Init")
});
