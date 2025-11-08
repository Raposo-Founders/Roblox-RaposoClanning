import ColorUtils from "@rbxts/colour-utils";
import React from "@rbxts/react";
import { TweenService } from "@rbxts/services";
import { colorTable, uiValues } from "UI/values";
import Signal from "util/signal";

// # Constants
export const BUTTON_STRIP_SIZE = 35;
export const BUTTON_HOR_INSIDE_CORNER_RADIUS = new UDim(0, 8);
export const BUTTON_HOR_OUTSIDE_CORNER_RADIUS = new UDim(1, 0);

export const ITEM_HOR_SPACING = 3;
export const ITEM_VER_SPACING = 4;

const BTN_ANIM_INFO = new TweenInfo(0.05, Enum.EasingStyle.Linear);
const TRANSITION_ANIM_INFO = new TweenInfo(0.25, Enum.EasingStyle.Linear);

export const menuTabActivated = new Signal<[group: string, name: string]>();

// # Functions
export function HorizontalTabButton(props: { Group: string, Name: string, Display: string }) {
  const [rightSideCornerVisible, SetRightSideCornerVisible] = React.createBinding(false);
  const [leftSideCornerVisible, SetLeftSideCornerVisible] = React.createBinding(false);

  const buttonReference = React.createRef<TextButton>();
  const rightCornerReference = React.createRef<UICorner>();
  const leftCornerReference = React.createRef<UICorner>();

  const updateCorners = () => {
    if (!buttonReference.current) return;

    const children = buttonReference.current.Parent!.GetChildren();

    let totalAmount = 0;
    let foundIndex = 0;

    for (let i = 0; i < children.size(); i++) {
      const element = children[i];
      if (!element.IsA("TextButton")) continue;

      totalAmount++;
      if (element === buttonReference.current)
        foundIndex = i;
    }

    SetRightSideCornerVisible(foundIndex !== totalAmount);
    SetLeftSideCornerVisible(foundIndex > 1);
  };

  const connection = menuTabActivated.Connect((group, name) => {
    if (!rightCornerReference.current || !leftCornerReference.current) return;
    if (group !== props.Group) return;

    const isCurrentButton = name === props.Name;

    updateCorners();

    TweenService.Create(
      rightCornerReference.current,
      BTN_ANIM_INFO,
      { CornerRadius: isCurrentButton ? BUTTON_HOR_OUTSIDE_CORNER_RADIUS : BUTTON_HOR_INSIDE_CORNER_RADIUS }
    ).Play();
    TweenService.Create(
      leftCornerReference.current,
      BTN_ANIM_INFO,
      { CornerRadius: isCurrentButton ? BUTTON_HOR_OUTSIDE_CORNER_RADIUS : BUTTON_HOR_INSIDE_CORNER_RADIUS }
    ).Play();
  });

  React.useEffect(() => {
    updateCorners();

    return () => {
      connection.Disconnect();
    };
  });

  return (
    <textbutton
      AutoButtonColor={false}
      BackgroundColor3={uiValues.hud_team_color[0]}
      BorderSizePixel={0}
      Size={new UDim2(0, 250, 1, 0)}
      Text={""}
      Event={{
        Activated: () => {
          menuTabActivated.Fire(props.Group, props.Name);
        },
      }}
      ref={buttonReference}
    >
      <uicorner CornerRadius={BUTTON_HOR_OUTSIDE_CORNER_RADIUS} />

      <frame // Right side corner
        AnchorPoint={new Vector2(1, 1)}
        BackgroundColor3={uiValues.hud_team_color[0]}
        BorderSizePixel={0}
        Position={UDim2.fromScale(1, 1)}
        Size={UDim2.fromOffset(35, 35)}
        Visible={rightSideCornerVisible}
        ZIndex={0}
      >
        <uicorner CornerRadius={BUTTON_HOR_INSIDE_CORNER_RADIUS} ref={rightCornerReference} />
      </frame>

      <frame // Left side corner
        BackgroundColor3={uiValues.hud_team_color[0]}
        BorderSizePixel={0}
        Size={UDim2.fromOffset(35, 35)}
        Visible={leftSideCornerVisible}
        ZIndex={0}
      >
        <uicorner CornerRadius={BUTTON_HOR_INSIDE_CORNER_RADIUS} ref={leftCornerReference} />
      </frame>

      <textlabel
        FontFace={new Font(
          "rbxasset://fonts/families/GothamSSm.json",
          Enum.FontWeight.Medium,
          Enum.FontStyle.Normal
        )}
        Text={props.Display}
        TextColor3={uiValues.hud_team_color[0].map(val => ColorUtils.Darken(val, 0.5))}
        TextSize={20}
        BackgroundTransparency={1}
        Size={UDim2.fromScale(1, 1)}
      />
    </textbutton>
  );
}

export function HorizontalButtonsLine(props: Partial<WritableInstanceProperties<Frame>> & React.PropsWithChildren) {
  const clonedPropertiesObject = table.clone(props);
  clonedPropertiesObject.children = undefined;

  return <frame
    BackgroundTransparency={1}
    Size={new UDim2(1, 0, 0, BUTTON_STRIP_SIZE)}
    {...clonedPropertiesObject}
  >
    <uilistlayout
      FillDirection={"Horizontal"}
      HorizontalFlex={"Fill"}
      Padding={new UDim(0, ITEM_HOR_SPACING)}
    />
    {props.children}
  </frame>;
}