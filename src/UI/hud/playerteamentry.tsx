import React, { useEffect } from "@rbxts/react";
import ReactRoblox from "@rbxts/react-roblox";

import { PlayerTeam } from "gamevalues";
import { getPlayersFromTeam } from "controllers/PlayerController";
import countryFlags from "UI/countries";
import { colorTable, uiValues } from "UI/values";
import GameEnvironment from "core/GameEnvironment";

// # Constants & variables
const DEAD_ICON = "rbxassetid://16682879119";
const DISCONNECTED_ICON = "rbxassetid://73914583608410";
const DEFAULT_USER_IMAGE = "rbxassetid://76527276016929";

const ENTRY_SIZE = new UDim2(0, 64, 0, 64);

// # Functions

function formatUserImageLabel(userId: number) {
  return string.format("rbxthumb://type=AvatarBust&id=%i&w=100&h=100", userId);
}

function ExpandedEntryInfo(props: { visible: React.Binding<boolean>, entityId: React.Binding<string> }) {
  const [usernameBind, SetUsername] = React.createBinding("");
  const [killsBind, SetKills] = React.createBinding(0);
  const [deathsBind, SetDeaths] = React.createBinding(0);
  const [pingBind, SetPing] = React.createBinding(0);
  const [flagBind, SetFlag] = React.createBinding("");
  const [accentColor, SetAccentColor] = React.createBinding(Color3.fromHex(colorTable.spectatorsColor));

  const binding1 = GameEnvironment.GetDefaultEnvironment().lifecycle.BindTickrate(() => {
    const entity = GameEnvironment.GetDefaultEnvironment().entity.entities.get(props.entityId.getValue());
    if (!entity?.IsA("PlayerEntity")) {
      SetUsername("");
      SetKills(0);
      SetDeaths(0);
      SetPing(0);
      SetFlag("");
      SetAccentColor(Color3.fromHex(colorTable.spectatorsColor));

      return;
    }

    const controller = entity.GetUserFromController();

    SetUsername(controller ? controller.Name : entity.id);
    SetKills(entity.statsKills);
    SetDeaths(entity.statsDeaths);
    SetPing(entity.statsPing);
    SetFlag(countryFlags.get(entity.statsCountry)?.Decal ?? "");

    {
      let teamColor = colorTable.spectatorsColor;
      if (props.entityId.getValue() !== "" && entity.team === PlayerTeam.Defenders) teamColor = colorTable.defendersColor;
      if (props.entityId.getValue() !== "" && entity.team === PlayerTeam.Raiders) teamColor = colorTable.raidersColor;

      SetAccentColor(Color3.fromHex(teamColor));
    }
  });

  useEffect(() => {
    return () => {
      binding1();
    };
  });

  const DisplayLabel = (props: { Text: React.Binding<string>, LayoutOrder: number }) => {
    return <textlabel // Kills
      FontFace={new Font(
        "rbxasset://fonts/families/GothamSSm.json",
        Enum.FontWeight.SemiBold,
        Enum.FontStyle.Normal
      )}
      Text={props.Text}
      TextColor3={Color3.fromHex("#FFFFFF")}
      TextSize={14}
      TextTruncate={"AtEnd"}
      TextWrapped={true}
      TextXAlignment={"Left"}
      BackgroundTransparency={1}
      LayoutOrder={props.LayoutOrder}
      Size={new UDim2(1, 0, 0, 14)}
    />;
  };

  return (
    <frame
      BackgroundColor3={accentColor}
      BackgroundTransparency={0.5}
      BorderSizePixel={0}
      Position={UDim2.fromScale(0, 0.5)}
      Size={new UDim2(1, 0, 0, 128)}
      Visible={props.visible}
      ZIndex={0}
    >
      <textlabel // Username
        FontFace={new Font(
          "rbxasset://fonts/families/GothamSSm.json",
          Enum.FontWeight.SemiBold,
          Enum.FontStyle.Normal
        )}
        Text={usernameBind}
        TextColor3={Color3.fromHex("#FFFFFF")}
        TextSize={14}
        TextStrokeTransparency={0.9}
        AnchorPoint={new Vector2(0.5, 0)}
        AutomaticSize={"X"}
        BackgroundTransparency={1}
        Position={new UDim2(0.5, 0, 1, 5)}
        Size={UDim2.fromOffset(0, 14)}
      />

      <frame // Content
        BackgroundTransparency={1}
        Position={new UDim2(0, 6, 0, ENTRY_SIZE.Y.Offset * 0.5)}
        Size={new UDim2(1, -12, 1, -ENTRY_SIZE.Y.Offset * 0.5)}
      >
        <uilistlayout
          SortOrder={"LayoutOrder"}
        />

        <DisplayLabel Text={killsBind.map(val => `K: ${val}`)} LayoutOrder={1} />
        <DisplayLabel Text={deathsBind.map(val => `D: ${val}`)} LayoutOrder={2} />
        <DisplayLabel Text={pingBind.map(val => `P: ${val}`)} LayoutOrder={3} />
      </frame>

      <imagelabel // User flag
        Image={flagBind}
        ScaleType={"Fit"}
        AnchorPoint={new Vector2(0.5, 1)}
        BackgroundTransparency={1}
        Position={new UDim2(0.5, 0, 1, -10)}
        Size={UDim2.fromOffset(40, 40)}
        ZIndex={2}
      />
    </frame>
  );
}

function SmallHealthBar(props: { entityId: React.Binding<EntityId>, visibileModifier: React.Binding<boolean> }) {
  const [sizeBinding, SetSize] = React.createBinding(0);

  const connection = GameEnvironment.GetDefaultEnvironment().lifecycle.BindTickrate(() => {
    const entity = GameEnvironment.GetDefaultEnvironment().entity.entities.get(props.entityId.getValue());
    if (!entity?.IsA("PlayerEntity")) {
      SetSize(0);
      return;
    }

    SetSize(math.clamp(entity.health / entity.maxHealth, 0, 1));
  });

  React.useEffect(() => {
    return () => {
      connection();
    };
  });

  return <frame
    BackgroundColor3={new Color3(0.125, 0.125, 0.125)}
    BorderSizePixel={0}
    AnchorPoint={new Vector2(0.5, 0)}
    Position={new UDim2(0.5, 0, 1, 5)}
    Size={new UDim2(0, ENTRY_SIZE.X.Offset * 0.75, 0, 5)}
    Visible={sizeBinding.map(val => val > 0 && !props.visibileModifier.getValue())}
    ZIndex={-1}
  >
    <frame
      BackgroundColor3={sizeBinding.map(val => new Color3(1, 0, 0).Lerp(new Color3(0, 1, 0), val))}
      BorderSizePixel={0}
      Size={sizeBinding.map(val => new UDim2(val, 0, 1, 0))}
    />
    <uipadding
      PaddingTop={new UDim(0, 1)}
      PaddingBottom={new UDim(0, 1)}
      PaddingLeft={new UDim(0, 1)}
      PaddingRight={new UDim(0, 1)}
    />
  </frame>;
}

function PlayerTopTeamEntry(props: { entityId: React.Binding<EntityId>, layoutOrder: React.Binding<number> }) {
  const [userImage, SetUserImage] = React.createBinding(formatUserImageLabel(1));
  const [teamColorBinding, SetTeamColor] = React.createBinding(Color3.fromHex(colorTable.spectatorsColor));

  const [userDeadBinding, SetUserDead] = React.createBinding(false);
  const [userDisconnected, SetUserDisconnected] = React.createBinding(false);

  const [expandedInfoVisible, SetExpandedInfoVisible] = React.createBinding(false);

  let mouseInFrame = false;

  const binding1 = GameEnvironment.GetDefaultEnvironment().lifecycle.BindTickrate(() => {
    const entity = GameEnvironment.GetDefaultEnvironment().entity.entities.get(props.entityId.getValue());
    if (!entity?.IsA("PlayerEntity")) {
      SetUserDead(true);
      SetUserDisconnected(true);
      SetUserImage(DEFAULT_USER_IMAGE);
      SetExpandedInfoVisible(false);
      SetTeamColor(Color3.fromHex(colorTable.spectatorsColor));
      return;
    }

    SetUserDisconnected(false);
    SetUserDead(entity.health <= 0);
    SetExpandedInfoVisible(mouseInFrame);

    {
      let teamColor = colorTable.spectatorsColor;
      if (props.entityId.getValue() !== "" && entity.team === PlayerTeam.Defenders) teamColor = colorTable.defendersColor;
      if (props.entityId.getValue() !== "" && entity.team === PlayerTeam.Raiders) teamColor = colorTable.raidersColor;

      SetTeamColor(Color3.fromHex(teamColor));
    }

    SetUserImage(formatUserImageLabel(entity.GetUserFromController()?.UserId ?? 1));
  });

  useEffect(() => {
    return () => {
      binding1();
    };
  });

  return (
    <frame
      BackgroundTransparency={1}
      Size={ENTRY_SIZE}
      LayoutOrder={props.layoutOrder}
      Event={{
        MouseEnter: () => mouseInFrame = true,
        MouseLeave: () => mouseInFrame = false,
      }}
    >
      <frame // Masked content
        BackgroundTransparency={1}
        Size={UDim2.fromScale(1, 1)}
      >
        <canvasgroup // Background
          GroupColor3={teamColorBinding}
          GroupTransparency={0.5}
          BackgroundTransparency={1}
          Size={UDim2.fromScale(1, 1)}
        >
          <frame // Bottom circle
            BackgroundColor3={Color3.fromHex("#FFFFFF")}
            BorderSizePixel={0}
            Size={UDim2.fromScale(1, 1)}
          >
            <uicorner
              CornerRadius={new UDim(1, 0)}
            />
          </frame>

          <frame
            BackgroundColor3={Color3.fromHex("#FFFFFF")}
            BorderSizePixel={0}
            Size={UDim2.fromScale(1, 0.5)}
          />
        </canvasgroup>

        <imagelabel // Rounded user image
          Image={userImage}
          BackgroundTransparency={1}
          Size={ENTRY_SIZE}
          ZIndex={2}
        >
          <uicorner
            CornerRadius={new UDim(1, 0)}
          />
        </imagelabel>

        <frame // Half-top user image
          BackgroundTransparency={1}
          ClipsDescendants={true}
          Size={UDim2.fromOffset(ENTRY_SIZE.X.Offset, ENTRY_SIZE.Y.Offset * 0.5)}
          ZIndex={3}
        >
          <imagelabel
            Image={userImage}
            BackgroundTransparency={1}
            Size={ENTRY_SIZE}
          />
        </frame>
      </frame>

      <SmallHealthBar entityId={props.entityId} visibileModifier={expandedInfoVisible} />

      <frame // Dark overlay
        BackgroundTransparency={1}
        Size={UDim2.fromScale(1, 1)}
        ZIndex={5}
        Visible={userDeadBinding}
      >
        <canvasgroup // Background
          GroupColor3={Color3.fromHex("#000000")}
          GroupTransparency={0.5}
          BackgroundTransparency={1}
          Size={UDim2.fromScale(1, 1)}
        >
          <frame
            BackgroundColor3={Color3.fromHex("#FFFFFF")}
            BorderSizePixel={0}
            Size={UDim2.fromScale(1, 1)}
          >
            <uicorner
              CornerRadius={new UDim(1, 0)}
            />
          </frame>
          <frame
            BackgroundColor3={Color3.fromHex("#FFFFFF")}
            BorderSizePixel={0}
            Size={UDim2.fromScale(1, 0.5)}
          />
        </canvasgroup>

        <imagelabel // Icon
          Image={userDisconnected.map(val => val ? DISCONNECTED_ICON : DEAD_ICON)}
          ImageColor3={userDisconnected.map(val => val ? new Color3(1, 0.4, 0.4) : new Color3(1, 1, 1))}
          AnchorPoint={new Vector2(0.5, 0.5)}
          BackgroundTransparency={1}
          Position={UDim2.fromScale(0.5, 0.5)}
          Size={UDim2.fromScale(0.75, 0.75)}
        />
      </frame>

      <ExpandedEntryInfo visible={expandedInfoVisible} entityId={props.entityId} />
    </frame>
  );
}

export function PlayersTopListing(props: { team: keyof typeof PlayerTeam }) {
  interface MountedPlayerInfo {
    unmount: Callback;
    setEntityId: (id: EntityId) => void;
    setLayoutOrder: (order: number) => void;
  }

  const referenceFrame = React.createRef<Frame>();
  const mountedEntries: MountedPlayerInfo[] = [];

  const thread1 = task.spawn(() => {
    while (game) {
      if (!referenceFrame.current) {
        task.wait();
        continue;
      }

      const entitiesList = getPlayersFromTeam(GameEnvironment.GetDefaultEnvironment().entity, PlayerTeam[props.team]);

      entitiesList.sort((a, b) => {
        return a.statsKills > b.statsKills;
      });

      // Unmount the entire thing if it isn't equal to the current team size
      if (mountedEntries.size() !== uiValues.hud_team_size[0].getValue()) {
        for (const entry of mountedEntries)
          entry.unmount();
        mountedEntries.clear();
      }

      for (let i = 0; i < uiValues.hud_team_size[0].getValue(); i++) {
        let uiEntryInfo = mountedEntries[i];
        const targetPlayer = entitiesList[i];

        if (!uiEntryInfo) {
          const [entityIdBinding, SetEntityId] = React.createBinding<EntityId>("");
          const [layoutOrderBinding, SetLayoutOrder] = React.createBinding(999999);

          const root = ReactRoblox.createRoot(referenceFrame.current, { "hydrate": true });
          root.render(<PlayerTopTeamEntry entityId={entityIdBinding} layoutOrder={layoutOrderBinding} />);

          uiEntryInfo = {
            setLayoutOrder: order => SetLayoutOrder(order),
            setEntityId: id => SetEntityId(id),
            unmount: () => root.unmount(),
          };
          mountedEntries[i] = uiEntryInfo;
        }

        if (!targetPlayer) {
          uiEntryInfo.setEntityId("");
          uiEntryInfo.setLayoutOrder(999 * (props.team === "Defenders" ? -1 : 1));

          continue;
        }


        uiEntryInfo.setEntityId(targetPlayer.id);
        uiEntryInfo.setLayoutOrder(math.max(targetPlayer.statsKills, 1) * (props.team === "Defenders" ? -1 : 1));
      }
      GameEnvironment.GetDefaultEnvironment().lifecycle.YieldForTicks(2);
    }
  });

  useEffect(() => {
    return () => {
      task.cancel(thread1);

      for (const info of mountedEntries)
        info.unmount();
      mountedEntries.clear();
    };
  });

  return (
    <frame
      BackgroundTransparency={1}
      LayoutOrder={props.team === "Defenders" ? 1 : 3}
      Size={UDim2.fromScale(1, 1)}
      ref={referenceFrame}
    >
      <uilistlayout
        Padding={new UDim(0, 5)}
        FillDirection={"Horizontal"}
        HorizontalAlignment={props.team === "Defenders" ? "Right" : "Left"}
        SortOrder={"LayoutOrder"}
      />
      <uiflexitem
        FlexMode={"Shrink"}
      />
    </frame>
  );
}