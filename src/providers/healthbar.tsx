import ColorUtils from "@rbxts/colour-utils";
import React from "@rbxts/react";
import ReactRoblox from "@rbxts/react-roblox";
import { Players, RunService, TweenService } from "@rbxts/services";

import PlayerEntity from "entities/PlayerEntity";
import { PlayerTeam } from "gamevalues";
import { colorTable } from "UI/values";

// # Types & interfaces
interface HealthFrameSectionInfo {
  inst: Frame;
  currState: boolean;
  targetHealth: number;
}

// # Constants & variables
const HEALTH_DIVISIONS = 20;
const FAR_DISTANCE = 80;
const NEAR_DISTANCE = 10;
const POSITION_OFFSET = new Vector3(0, 4, 0);

const SCREENGUI = new Instance("ScreenGui");
const FRAME_HURT_TRANSPARENCY = 0.75;
const FRAME_NORM_TRANSPARENCY = 0.25;
const FRAME_BARS_SIZE = UDim2.fromOffset(12, 12);
const FRAME_BARS_PADDING = 2;
const FRAME_BARS_PER_ROW = 10;
const MASTER_SIZE = UDim2.fromOffset(
  (FRAME_BARS_SIZE.X.Offset * FRAME_BARS_PER_ROW) + (FRAME_BARS_PADDING * (FRAME_BARS_PER_ROW - 1)),
  50
);

// # Functions
function EntityHealthBar(props: { env: T_GameEnvironment, entity: PlayerEntity, part: BasePart }) {
  const [frameVisibleBinding, setVisible] = React.createBinding(false);
  const [framePositionBinding, setPosition] = React.createBinding(UDim2.fromOffset(-100, -100));
  const [scaleAmountBinding, setScale] = React.createBinding(1);
  const [usernameBinding, setUsername] = React.createBinding("PlayerEntity");
  const [accentColorBinding, setAccentColor] = React.createBinding(Color3.fromHex(colorTable.spectatorsColor));

  const barsContentReference = React.createRef<Frame>();
  const registeredFrames: HealthFrameSectionInfo[] = [];

  let defaultLifecycleUnbind: Callback | undefined = props.env.lifecycle.BindLateUpdate(() => {
    if (!props.env.entity.isEntityOnMemoryOrImSchizo(props.entity)) return;

    if (props.entity.health <= 0) {
      setVisible(false);
      return;
    }

    // Update health displays
    for (const info of registeredFrames) {
      const newState = props.entity.health >= info.targetHealth;

      if (info.currState !== newState && !newState) {
        const effectFrame = new Instance("Frame");
        effectFrame.AnchorPoint = new Vector2(0.5, 0.5);
        effectFrame.BackgroundColor3 = new Color3(1, 0, 0);
        effectFrame.BorderSizePixel = 0;
        effectFrame.Size = UDim2.fromScale(1, 1);
        effectFrame.Parent = info.inst;

        const tween = TweenService.Create(effectFrame, new TweenInfo(0.25), { BackgroundTransparency: 1, Size: UDim2.fromScale(3, 3) });
        tween.Completed.Once(() => {
          tween.Destroy();
          effectFrame.Destroy();
        });
        tween.Play();
      }

      info.inst.BackgroundTransparency = newState ? FRAME_NORM_TRANSPARENCY : FRAME_HURT_TRANSPARENCY;
      info.currState = newState;
    }

    // Updating username display
    if (props.entity.GetUserFromController()?.Name !== usernameBinding.getValue())
      setUsername(props.entity.GetUserFromController()?.Name || "PlayerEntity");

    const camera = workspace.CurrentCamera!;
    const [viewportPosition, onViewport] = camera.WorldToViewportPoint(props.part.Position.add(POSITION_OFFSET));

    const distance = camera.CFrame.Position.sub(props.entity.origin.Position).Magnitude;
    let scaleAmount = 1;
    if (distance > NEAR_DISTANCE) {
      const farOffset = FAR_DISTANCE - NEAR_DISTANCE;
      const nearOffset = distance - NEAR_DISTANCE;
      scaleAmount = 1 - (nearOffset / farOffset);
    }

    setVisible(distance <= FAR_DISTANCE && onViewport);
    setPosition(UDim2.fromOffset(viewportPosition.X, viewportPosition.Y));
    setScale(math.lerp(0.5, 1, scaleAmount));
  });

  React.useEffect(() => {
    if (!barsContentReference.current) return;

    const mountFrames = () => {
      const healthPerDivision = props.entity.maxHealth / HEALTH_DIVISIONS;

      for (const info of registeredFrames)
        info.inst.Destroy();
      registeredFrames.clear();

      for (let i = 0; i < HEALTH_DIVISIONS; i++) {
        const lowerHealthAmount = healthPerDivision * i;
        // const upperHealthAmount = HEALTH_DIVISION_AMOUNT * (i + 1); // Will be used in the future?
        const currState = props.entity.health >= lowerHealthAmount;

        const frame = new Instance("Frame");
        frame.BackgroundTransparency = currState ? FRAME_NORM_TRANSPARENCY : FRAME_HURT_TRANSPARENCY;
        frame.BackgroundColor3 = accentColorBinding.getValue();
        frame.BorderSizePixel = 0;
        frame.Size = FRAME_BARS_SIZE;
        frame.LayoutOrder = i;
        frame.Parent = barsContentReference.current;

        registeredFrames.push({
          inst: frame,
          currState: props.entity.health > lowerHealthAmount,
          targetHealth: lowerHealthAmount,
        });
      }
    };

    let updateThread: thread | undefined = task.spawn(() => {
      while (props.env.entity.isEntityOnMemoryOrImSchizo(props.entity)) {
        let backgroundColor = colorTable.spectatorsColor;
        if (props.entity.team === PlayerTeam.Defenders) backgroundColor = colorTable.defendersColor;
        if (props.entity.team === PlayerTeam.Raiders) backgroundColor = colorTable.raidersColor;

        setAccentColor(ColorUtils.Lighten(Color3.fromHex(backgroundColor), 0.5));

        mountFrames();
        props.env.lifecycle.YieldForTicks(20);
      }
    });
    
    return () => {
      task.cancel(updateThread!);
      updateThread = undefined;

      defaultLifecycleUnbind?.();
      defaultLifecycleUnbind = undefined;

      for (const info of registeredFrames)
        info.inst.Destroy();
      registeredFrames.clear();
    };
  });

  const element = (
    <frame
      AnchorPoint={new Vector2(0.5, 1)}
      BackgroundTransparency={1}
      Position={framePositionBinding}
      Size={MASTER_SIZE}
      Visible={frameVisibleBinding}
    >
      <frame // Bars content
        AnchorPoint={new Vector2(0.5, 1)}
        AutomaticSize={"Y"}
        BackgroundTransparency={1}
        Position={UDim2.fromScale(0.5, 1)}
        Size={UDim2.fromScale(1, 0)}
        ref={barsContentReference}
      >
        <uilistlayout
          Padding={new UDim(0, 2)}
          Wraps={true}
          FillDirection={"Horizontal"}
          SortOrder={"LayoutOrder"}
          VerticalAlignment={"Bottom"}
        />
      </frame>

      <textlabel
        FontFace={new Font(
          "rbxasset://fonts/families/GothamSSm.json",
          Enum.FontWeight.SemiBold,
          Enum.FontStyle.Normal
        )}
        Text={usernameBinding}
        TextColor3={accentColorBinding}
        TextSize={20}
        TextStrokeTransparency={0.75}
        AnchorPoint={new Vector2(0.5, 0)}
        AutomaticSize={"XY"}
        BackgroundTransparency={1}
        Position={UDim2.fromScale(0.5, 1)}
      />
      <uiscale Scale={scaleAmountBinding} />
    </frame>
  );

  return element;
}

export function createHealthBarForEntity(entity: PlayerEntity, part: BasePart) {
  const root = ReactRoblox.createRoot(SCREENGUI, { "hydrate": true });
  root.render(<EntityHealthBar entity={entity} part={part} env={entity.environment} />);

  entity.OnDelete(() => {
    root.unmount();
  });
}

// # Bindings & misc
if (RunService.IsClient()) {
  SCREENGUI.Parent = Players.LocalPlayer.WaitForChild("PlayerGui");
  SCREENGUI.ResetOnSpawn = false;
  SCREENGUI.IgnoreGuiInset = true;
  SCREENGUI.DisplayOrder = -math.huge;
}