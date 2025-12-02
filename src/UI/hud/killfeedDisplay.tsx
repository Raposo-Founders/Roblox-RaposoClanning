import React, { createRef } from "@rbxts/react";
import ReactRoblox from "@rbxts/react-roblox";
import { UserInputService } from "@rbxts/services";
import GameEnvironment from "core/GameEnvironment";
import { PlayerTeam } from "gamevalues";
import { colorTable } from "UI/values";

// # Constants & Variables

// # Functions
function PlayerFrame(props: { entityId: string, layoutOrder: number }) {
  const entity = GameEnvironment.GetDefaultEnvironment().entity.entities.get(props.entityId);
  if (!entity?.IsA("PlayerEntity")) return <></>;

  const controller = entity.GetUserFromController();

  let teamColor = colorTable.spectatorsColor;
  if (entity.team === PlayerTeam.Defenders) teamColor = colorTable.defendersColor;
  if (entity.team === PlayerTeam.Raiders) teamColor = colorTable.raidersColor;

  return (
    <frame
      BackgroundColor3={Color3.fromHex(teamColor)}
      Size={UDim2.fromOffset(30, 40)}
      LayoutOrder={props.layoutOrder}
    >
      <uipadding
        PaddingBottom={new UDim(0, 2)}
        PaddingLeft={new UDim(0, 2)}
        PaddingRight={new UDim(0, 2)}
        PaddingTop={new UDim(0, 2)}
      />

      <uicorner
        CornerRadius={new UDim(0, 4)}
      />

      <frame // Mask frame
        AnchorPoint={new Vector2(0.5, 0.5)}
        BackgroundTransparency={1}
        ClipsDescendants={true}
        Position={UDim2.fromScale(0.5, 0.5)}
        Size={UDim2.fromScale(1, 1)}
      >
        <imagelabel
          Image={`rbxthumb://type=AvatarBust&id=${controller ? controller.UserId : 1}&w=100&h=100`}
          AnchorPoint={new Vector2(0.5, 0.5)}
          BackgroundTransparency={1}
          Position={UDim2.fromScale(0.5, 0.5)}
          Size={UDim2.fromOffset(37, 37)}
        />
      </frame>
    </frame>
  );
}

function KillfeedPost(props: { KillerEntityId: string, distance: number, VictimEntityId: string }) {
  const killerEntity = GameEnvironment.GetDefaultEnvironment().entity.entities.get(props.KillerEntityId);
  const victimEntity = GameEnvironment.GetDefaultEnvironment().entity.entities.get(props.VictimEntityId);

  if (!killerEntity?.IsA("PlayerEntity") || !victimEntity?.IsA("PlayerEntity"))
    return <></>;

  let killerTeamColor = colorTable.spectatorsColor;
  if (killerEntity.team === PlayerTeam.Defenders) killerTeamColor = colorTable.defendersColor;
  if (killerEntity.team === PlayerTeam.Raiders) killerTeamColor = colorTable.raidersColor;

  let victimTeamColor = colorTable.spectatorsColor;
  if (victimEntity.team === PlayerTeam.Defenders) victimTeamColor = colorTable.defendersColor;
  if (victimEntity.team === PlayerTeam.Raiders) victimTeamColor = colorTable.raidersColor;

  return <frame
    AutomaticSize={"XY"}
    BackgroundTransparency={1}
    Size={new UDim2()}
  >
    <uilistlayout FillDirection={"Horizontal"} SortOrder={"LayoutOrder"} Padding={new UDim(0, 3)} />
    <PlayerFrame entityId={props.KillerEntityId} layoutOrder={1} />
    <frame
      BackgroundColor3={new Color3(1, 1, 1)}
      BorderSizePixel={1}
      Size={new UDim2(0, 60, 0, 40)}
      LayoutOrder={2}
    >
      <uicorner CornerRadius={new UDim(0, 4)} />
      <uipadding
        PaddingBottom={new UDim(0, 2)}
        PaddingLeft={new UDim(0, 2)}
        PaddingRight={new UDim(0, 2)}
        PaddingTop={new UDim(0, 2)}
      />
      <textlabel
        FontFace={new Font(
          "rbxasset://fonts/families/GothamSSm.json",
          Enum.FontWeight.SemiBold,
          Enum.FontStyle.Normal
        )}
        RichText={true}
        Text={`${math.floor(props.distance * 100) / 100}<br />STUDS`}
        TextColor3={new Color3()}
        TextSize={14}
        BackgroundTransparency={1}
        Size={UDim2.fromScale(1, 1)}
      />
    </frame>
    <PlayerFrame entityId={props.VictimEntityId} layoutOrder={3} />
  </frame>;
}

export function KillfeedDisplay() {
  const parentFrameReference = createRef<Frame>();

  GameEnvironment.GetDefaultEnvironment().network.ListenPacket("game_killfeed", (sender, reader) => {
    if (!parentFrameReference.current) return;

    const distance = reader.f32();
    const attackerEntityId = reader.string();
    const victimEntityId = reader.string();

    const root = ReactRoblox.createRoot(parentFrameReference.current, { hydrate: true });
    root.render(<KillfeedPost KillerEntityId={attackerEntityId} VictimEntityId={victimEntityId} distance={distance} />);

    task.wait(5);
    root.unmount();
  });

  return <frame
    AnchorPoint={new Vector2(1, 1)}
    BackgroundTransparency={1}
    ClipsDescendants={true}
    Position={new UDim2(1, 0, 1, 0)}
    Size={new UDim2(1, 0, 0, UserInputService.TouchEnabled ? 50 : 200)}
    ref={parentFrameReference}
  >
    <uilistlayout
      SortOrder={"LayoutOrder"}
      FillDirection={"Vertical"}
      VerticalAlignment={"Bottom"}
      HorizontalAlignment={"Right"}
    />
  </frame>;
}