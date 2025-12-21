import ColorUtils from "@rbxts/colour-utils";
import React from "@rbxts/react";
import ReactRoblox from "@rbxts/react-roblox";
import GameEnvironment from "core/GameEnvironment";
import PlayerEntity from "entities/PlayerEntity";
import { PlayerTeam } from "gamevalues";
import countryFlags from "UI/countries";
import { colorTable } from "UI/values";
import { BUTTON_STRIP_SIZE, HorizontalButtonsLine, HorizontalTabButton, ITEM_HOR_SPACING, ITEM_VER_SPACING, menuTabActivated } from "./menuprefabs";

// # Constants & variables
const PLAYER_LISTING_SIZE = 30;

// # Functions
function PlayerEntry(props: { Entity: PlayerEntity }) {
  const [killsBinding, SetKillsAmount] = React.createBinding(0);
  const [deathsBinding, SetDeathsAmount] = React.createBinding(0);
  const [pingBinding, SetPingAmount] = React.createBinding(0);

  const connection = GameEnvironment.GetDefaultEnvironment().lifecycle.BindTickrate(() => {
    if (!GameEnvironment.GetDefaultEnvironment().entity.isEntityOnMemoryOrImSchizo(props.Entity)) return;

    SetKillsAmount(props.Entity.statsKills);
    SetDeathsAmount(props.Entity.statsDeaths);
    SetPingAmount(props.Entity.statsPing);
  });

  React.useEffect(() => {
    return () => {
      connection();
    };
  });

  return <frame
    BackgroundTransparency={1}
    Size={new UDim2(1, 0, 0, PLAYER_LISTING_SIZE)}
    LayoutOrder={killsBinding.map(val => -val)}
  >
    <canvasgroup // User background content
      GroupTransparency={0.6}
      BackgroundTransparency={1}
      Size={UDim2.fromScale(1, 1)}
    >
      <imagelabel // Flag
        Image={countryFlags.get(props.Entity.statsCountry)?.Decal ?? ""}
        ScaleType={"Fit"}
        AnchorPoint={new Vector2(0.5, 0.5)}
        BackgroundTransparency={1}
        Position={new UDim2(0, 25, 0.5, 0)}
        Rotation={-22}
        Size={UDim2.fromOffset(60, 60)}
      />

      <imagelabel // User image
        Image={`rbxthumb://type=AvatarBust&id=${props.Entity.appearanceId}&w=100&h=100`}
        ScaleType={"Fit"}
        AnchorPoint={new Vector2(0.5, 0.5)}
        BackgroundTransparency={1}
        Position={UDim2.fromScale(0.2, 0.5)}
        Size={UDim2.fromOffset(80, 80)}
        ZIndex={2}
      />
    </canvasgroup>

    <frame // Labels'n stuff
      BackgroundTransparency={1}
      Size={UDim2.fromScale(1, 1)}
    >
      <textlabel // Kills
        FontFace={new Font(
          "rbxasset://fonts/families/GothamSSm.json",
          Enum.FontWeight.SemiBold,
          Enum.FontStyle.Normal
        )}
        Text={killsBinding.map(val => tostring(val))}
        TextColor3={Color3.fromHex("#FFFFFF")}
        TextSize={20}
        BackgroundTransparency={1}
        BorderSizePixel={0}
        LayoutOrder={2}
        Size={new UDim2(0, 30, 1, 0)}
      >
        <uiflexitem
          FlexMode={"Grow"}
        />
      </textlabel>

      <textlabel // Username
        FontFace={new Font(
          "rbxasset://fonts/families/GothamSSm.json",
          Enum.FontWeight.SemiBold,
          Enum.FontStyle.Normal
        )}
        Text={props.Entity.GetUserFromController()?.Name ?? props.Entity.name}
        TextColor3={Color3.fromHex("#FFFFFF")}
        TextSize={20}
        TextTruncate={"AtEnd"}
        TextXAlignment={"Left"}
        BackgroundTransparency={1}
        LayoutOrder={1}
        Size={new UDim2(0, 200, 1, 0)}
      >
        <uipadding
          PaddingLeft={new UDim(0, 10)}
        />
      </textlabel>

      <textlabel // Ping
        FontFace={new Font(
          "rbxasset://fonts/families/GothamSSm.json",
          Enum.FontWeight.SemiBold,
          Enum.FontStyle.Normal
        )}
        Text={pingBinding.map(val => tostring(val))}
        TextColor3={Color3.fromHex("#FFFFFF")}
        TextSize={20}
        BackgroundTransparency={1}
        LayoutOrder={4}
        Size={new UDim2(0, 30, 1, 0)}
      >
        <uiflexitem
          FlexMode={"Grow"}
        />
      </textlabel>

      <textlabel // Deaths
        FontFace={new Font(
          "rbxasset://fonts/families/GothamSSm.json",
          Enum.FontWeight.SemiBold,
          Enum.FontStyle.Normal
        )}
        Text={deathsBinding.map(val => tostring(val))}
        TextColor3={Color3.fromHex("#FFFFFF")}
        TextSize={20}
        BackgroundTransparency={1}
        LayoutOrder={3}
        Size={new UDim2(0, 30, 1, 0)}
      >
        <uiflexitem
          FlexMode={"Grow"}
        />
      </textlabel>

      <uilistlayout
        FillDirection={"Horizontal"}
        SortOrder={"LayoutOrder"}
      />
    </frame>
  </frame>
}

function TeamHeader(props: { Team: PlayerTeam }) {
  let targetColorHex = colorTable.spectatorsColor;
  if (props.Team === PlayerTeam.Defenders) targetColorHex = colorTable.defendersColor;
  if (props.Team === PlayerTeam.Raiders) targetColorHex = colorTable.raidersColor;

  const targetColor = Color3.fromHex(targetColorHex);
  const targetTextColor = ColorUtils.Darken(targetColor, 0.75);

  return <frame
    BackgroundColor3={targetColor}
    BorderSizePixel={0}
    Size={new UDim2(1, 0, 0, 60)}
  >
    <frame // Stats order
      BackgroundTransparency={1}
      Position={UDim2.fromOffset(0, 30)}
      Size={new UDim2(1, 0, 0, 30)}
    >
      <textlabel
        FontFace={new Font(
          "rbxasset://fonts/families/GothamSSm.json",
          Enum.FontWeight.SemiBold,
          Enum.FontStyle.Normal
        )}
        Text={"K"}
        TextColor3={targetTextColor}
        TextSize={20}
        BackgroundTransparency={1}
        LayoutOrder={2}
        Size={new UDim2(0, 30, 1, 0)}
      >
        <uiflexitem
          FlexMode={"Grow"}
        />
      </textlabel>

      <textlabel
        FontFace={new Font(
          "rbxasset://fonts/families/GothamSSm.json",
          Enum.FontWeight.SemiBold,
          Enum.FontStyle.Normal
        )}
        Text={"Username"}
        TextColor3={targetTextColor}
        TextSize={20}
        BackgroundTransparency={1}
        LayoutOrder={1}
        Size={new UDim2(0, 200, 1, 0)}
      />

      <textlabel
        FontFace={new Font(
          "rbxasset://fonts/families/GothamSSm.json",
          Enum.FontWeight.SemiBold,
          Enum.FontStyle.Normal
        )}
        Text={"P"}
        TextColor3={targetTextColor}
        TextSize={20}
        BackgroundTransparency={1}
        LayoutOrder={4}
        Size={new UDim2(0, 30, 1, 0)}
      >
        <uiflexitem
          FlexMode={"Grow"}
        />
      </textlabel>

      <textlabel
        FontFace={new Font(
          "rbxasset://fonts/families/GothamSSm.json",
          Enum.FontWeight.SemiBold,
          Enum.FontStyle.Normal
        )}
        Text={"D"}
        TextColor3={targetTextColor}
        TextSize={20}
        BackgroundTransparency={1}
        LayoutOrder={3}
        Size={new UDim2(0, 30, 1, 0)}
      >
        <uiflexitem
          FlexMode={"Grow"}
        />
      </textlabel>

      <uilistlayout
        FillDirection={"Horizontal"}
        SortOrder={"LayoutOrder"}
      />
    </frame>

    <frame // Bottom corner filling
      AnchorPoint={new Vector2(1, 1)}
      BackgroundColor3={targetColor}
      BorderSizePixel={0}
      Position={UDim2.fromScale(1, 1)}
      Size={new UDim2(1, 0, 0, 12)}
      ZIndex={0}
    />

    <uicorner
      CornerRadius={new UDim(0, 12)}
    />

    <textlabel // Team name
      FontFace={new Font(
        "rbxasset://fonts/families/GothamSSm.json",
        Enum.FontWeight.SemiBold,
        Enum.FontStyle.Normal
      )}
      Text={PlayerTeam[props.Team]}
      TextColor3={targetTextColor}
      TextSize={20}
      BackgroundTransparency={1}
      LayoutOrder={1}
      Size={new UDim2(1, 0, 0, 30)}
    />
  </frame>
}

function TeamDisplayContent(props: { Team: PlayerTeam }) {
  const contentReference = React.createRef<ScrollingFrame>();
  const mountedContent = new Map<EntityId, ReactRoblox.Root>();

  let targetColorHex = colorTable.spectatorsColor;
  if (props.Team === PlayerTeam.Defenders) targetColorHex = colorTable.defendersColor;
  if (props.Team === PlayerTeam.Raiders) targetColorHex = colorTable.raidersColor;

  const updateEntitiesConnection = GameEnvironment.GetDefaultEnvironment().lifecycle.BindTickrate(() => {
    if (!contentReference.current) return;

    for (const ent of GameEnvironment.GetDefaultEnvironment().entity.getEntitiesThatIsA("PlayerEntity")) {
      if (ent.team !== props.Team) continue;
      if (mountedContent.has(ent.id)) continue;

      const root = ReactRoblox.createRoot(contentReference.current, { "hydrate": true });
      root.render(<PlayerEntry Entity={ent} />);
      mountedContent.set(ent.id, root);
    }

    // Remove invalid entries
    for (const [entityId, root] of mountedContent) {
      const targetEntity = GameEnvironment.GetDefaultEnvironment().entity.entities[entityId];
      if (targetEntity?.IsA("PlayerEntity") && targetEntity.team === props.Team) continue;

      root.unmount();
      mountedContent.delete(entityId);
    }
  });

  React.useEffect(() => {

    return () => {
      updateEntitiesConnection();

      for (const [, root] of mountedContent)
        root.unmount();
      mountedContent.clear();
    }
  });
  
  return <frame
    BackgroundColor3={Color3.fromHex(targetColorHex)}
    BackgroundTransparency={0.75}
    BorderSizePixel={0}
    Size={new UDim2(1, 0, 1, 0)}
  >
    <uicorner CornerRadius={new UDim(0, 12)} />
    <TeamHeader Team={props.Team} />

    <scrollingframe
      AutomaticCanvasSize={"Y"}
      CanvasSize={new UDim2()}
      ScrollBarThickness={0}
      Active={true}
      BackgroundTransparency={1}
      Position={UDim2.fromOffset(0, 60)}
      Size={new UDim2(1, 0, 1, -60)}
      ref={contentReference}
    >
      <uilistlayout SortOrder={"LayoutOrder"} />
    </scrollingframe>
  </frame>
}

export function PlayerlistMenuTab() {
  const [currentTabBinding, SetCurrentTab] = React.createBinding("list");

  const tabGroupBinding = menuTabActivated.Connect((group, name) => {
    if (group !== "PlayersTab") return;
    SetCurrentTab(name);
  });

  React.useEffect(() => {
    return () => {
      tabGroupBinding.Disconnect();
    };
  });

  return <>
    <HorizontalButtonsLine
      AnchorPoint={new Vector2(0.5, 0)}
      Position={new UDim2(0.5, 0, 0, 0)}
      Size={new UDim2(0.75, 0, 0, BUTTON_STRIP_SIZE)}
    >
      <HorizontalTabButton Group="PlayersTab" Name="list" Display="Players" />
      <HorizontalTabButton Group="PlayersTab" Name="specs" Display="Spectators" />
    </HorizontalButtonsLine>

    <frame // Playing players
      AnchorPoint={new Vector2(1, 1)}
      BackgroundTransparency={1}
      Size={new UDim2(1, 0, 1, -BUTTON_STRIP_SIZE - ITEM_VER_SPACING)}
      Position={new UDim2(1, 0, 1, 0)}
      Visible={currentTabBinding.map(val => val === "list")}
    >
      <uilistlayout
        HorizontalFlex={"Fill"}
        Padding={new UDim(0, ITEM_HOR_SPACING)}
        FillDirection={"Horizontal"}
        SortOrder={"LayoutOrder"}
      />
      <TeamDisplayContent Team={PlayerTeam.Defenders} />
      <TeamDisplayContent Team={PlayerTeam.Raiders} />
    </frame>

    <frame // Spectators
      AnchorPoint={new Vector2(1, 1)}
      BackgroundTransparency={1}
      Size={new UDim2(1, 0, 1, -BUTTON_STRIP_SIZE - ITEM_VER_SPACING)}
      Position={new UDim2(1, 0, 1, 0)}
      Visible={currentTabBinding.map(val => val === "specs")}
    >
      <TeamDisplayContent Team={PlayerTeam.Spectators} />
    </frame>
  </>;
}