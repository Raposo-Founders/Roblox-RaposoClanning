import React from "@rbxts/react";
import { Players, ReplicatedStorage, TweenService } from "@rbxts/services";
import { GetGameName } from "providers/GroupsProvider";
import { InputSystem } from "systems/InputSystem";
import { BUTTON_STRIP_SIZE, HorizontalButtonsLine, HorizontalTabButton, ITEM_VER_SPACING, menuTabActivated } from "./menuprefabs";
import ReactRoblox from "@rbxts/react-roblox";
import { PlayerlistMenuTab } from "./playerlist";
import { SpinningIcon } from "UI/blocks/spinicon";
import { uiValues } from "UI/values";

// # Constants & variables
const WINDOW_SIZE = new UDim2(0, 700, 0, 400);
const WINDOW_TRANSITION_ANIM_INFO = new TweenInfo(0.1, Enum.EasingStyle.Linear);

// # Functions
export function Menu(props: React.PropsWithChildren) {
  const runningTweens: Callback[] = [];

  const contentRef = React.createRef<CanvasGroup>();
  let currentRoot: ReactRoblox.Root | undefined;
  let currentLoadingThread: thread | undefined;

  const CancelTweens = () => {
    for (const tweenCallback of runningTweens)
      pcall(tweenCallback);
    runningTweens.clear();
  };

  const connection = menuTabActivated.Connect((group, name) => {
    if (group !== "Menu" || !currentRoot || !contentRef.current) return;

    if (currentLoadingThread) {
      task.cancel(currentLoadingThread);
      currentLoadingThread = undefined;
    }

    currentRoot.unmount();
    CancelTweens();
    contentRef.current.GroupTransparency = 1;

    currentLoadingThread = task.spawn(() => {
      if (!currentRoot || !contentRef.current) return;

      currentRoot.render(<SpinningIcon
        AnchorPoint={new Vector2(0.5, 0.5)}
        BackgroundTransparency={1}
        Position={new UDim2(0.5, 0, 0.5, 0)}
        Size={new UDim2(0, 64, 0, 64)}
        Image="rbxassetid://113149428761338"
        ImageColor3={uiValues.hud_team_color[0].getValue()}
        SpinSpeed={300}
      />);

      const tweenFadeIn = TweenService.Create(contentRef.current, WINDOW_TRANSITION_ANIM_INFO, { GroupTransparency: 0 });

      runningTweens.push(() => {
        tweenFadeIn.Cancel();
        tweenFadeIn.Destroy();
      });

      tweenFadeIn.Play();

      task.wait(1);

      contentRef.current.GroupTransparency = 1;
      currentRoot.unmount();

      if (name === "players")
        currentRoot.render(<PlayerlistMenuTab />);

      tweenFadeIn.Play();
    });
  });

  React.useEffect(() => {
    if (!contentRef.current) return;
    if (!currentRoot)
      currentRoot = ReactRoblox.createRoot(contentRef.current, { "hydrate": true });

    return () => {
      connection.Disconnect();
    };
  });

  return <frame
    AnchorPoint={new Vector2(0.5, 0.5)}
    BackgroundTransparency={1}
    Position={new UDim2(0.5, 0, 0.6, 0)}
    Size={WINDOW_SIZE}
    Visible={uiValues.hud_gameplay_visible[0].map(val => !val)}
  >
    {/* <HorizontalButtonsLine
      AnchorPoint={new Vector2(0.5, 1)}
      Position={new UDim2(0.5, 0, 1, 0)}
      Size={new UDim2(0.5, 0, 0, BUTTON_STRIP_SIZE)}
    >
      <HorizontalTabButton Group="Menu" Name="players" Display="Players" />
      <HorizontalTabButton Group="Menu" Name="stats" Display="Stats" />
      <HorizontalTabButton Group="Menu" Name="settings" Display="Settings" />
    </HorizontalButtonsLine> */}

    <textlabel
      FontFace={new Font(
        "rbxasset://fonts/families/GothamSSm.json",
        Enum.FontWeight.SemiBold,
        Enum.FontStyle.Normal
      )}
      Text={GetGameName()}
      TextColor3={Color3.fromHex("#FFFFFF")}
      TextSize={30}
      AnchorPoint={new Vector2(0, 1)}
      AutomaticSize={"XY"}
      BackgroundTransparency={1}
      Position={UDim2.fromOffset(0, -20)}
    />

    <textlabel
      FontFace={new Font(
        "rbxasset://fonts/families/GothamSSm.json",
        Enum.FontWeight.SemiBold,
        Enum.FontStyle.Normal
      )}
      RichText={true}
      Text={`${Players.LocalPlayer?.Name}<br/>Server location: ${ReplicatedStorage.GetAttribute("ServerLocation")}`}
      TextColor3={Color3.fromHex("#FFFFFF")}
      TextSize={20}
      TextXAlignment={"Left"}
      TextYAlignment={"Bottom"}
      AnchorPoint={new Vector2(1, 1)}
      AutomaticSize={"XY"}
      BackgroundTransparency={1}
      Position={new UDim2(1, 0, 0, -20)}
    />

    <canvasgroup // Content frame
      BackgroundColor3={Color3.fromHex("#FFFFFF")}
      BorderSizePixel={0}
      BackgroundTransparency={1}
      Size={new UDim2(1, 0, 1, -BUTTON_STRIP_SIZE - ITEM_VER_SPACING)}
      ref={contentRef}
    />
  </frame>;
}