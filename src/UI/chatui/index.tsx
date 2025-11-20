import ColorUtils from "@rbxts/colour-utils";
import React from "@rbxts/react";
import { UserInputService } from "@rbxts/services";
import { ExecuteCommand } from "cmd";
import GameEnvironment from "core/GameEnvironment";

import { gameValues } from "gamevalues";
import ChatSystem from "systems/ChatSystem";
import { DefaultButton } from "UI/blocks/btn";
import { uiValues } from "UI/values";
import Signal from "util/signal";

// # Constants & variables
const KEYCODES: Enum.KeyCode[] = [Enum.KeyCode.Slash, Enum.KeyCode.KeypadDivide];

const toggleChatVisibility = new Signal<[visible?: boolean]>();

// # Functions
function FormatString(text: string) {
  return text.gsub("^%s+", "")[0].gsub("%s+$", "")[0];
}

export function ChatBar() {
  const reference = React.createRef<TextBox>();
  const [visibilityBindings, setVisible] = React.createBinding(false);

  React.useEffect(() => {
    if (!reference.current) return;

    toggleChatVisibility.Connect(visible => {
      if (!reference.current) return;

      GameEnvironment.GetDefaultEnvironment().lifecycle.YieldForTicks(2);

      if (visible === undefined)
        reference.current.Visible = !reference.current.Visible;
      else
        reference.current.Visible = visible;
    });
  });

  toggleChatVisibility.Connect(visible => setVisible(visible !== undefined ? visible : !visibilityBindings.getValue()));

  return (
    <textbox
      CursorPosition={-1}
      FontFace={new Font("rbxasset://fonts/families/BuilderSans.json", Enum.FontWeight.Medium)}
      Text={""}
      TextColor3={Color3.fromHex("#000000")}
      TextTransparency={0.1}
      TextScaled={true}
      AnchorPoint={new Vector2(0.5, 0.5)}
      AutomaticSize={"X"}
      BackgroundColor3={Color3.fromHex("#FFFFFF")}
      BackgroundTransparency={0.1}
      BorderSizePixel={0}
      Position={UDim2.fromScale(0.5, 0.25)}
      Size={UDim2.fromOffset(0, 30)}
      ref={reference}
      Visible={false}
      Event={{
        FocusLost: (inst, enterPressed) => {
          toggleChatVisibility.Fire(false);

          if (!enterPressed) return;

          const text = FormatString(inst.Text);
          inst.Text = "";
          inst.CursorPosition = -1;

          if (text === "") return;

          ChatSystem.sendMessage(text, []);

          if (text.sub(1, 1) === gameValues.cmdprefix) {
            const split = text.split(gameValues.cmdprefix);

            for (const cmd of split) {
              if (cmd === "") continue;

              ExecuteCommand(cmd, GameEnvironment.GetDefaultEnvironment()).expect();
              task.wait();
              task.wait(); // Double trouble :)
            }
          }
        },
      }}
      Change={{
        Visible: (rbx) => {
          if (rbx.Visible)
            rbx.CaptureFocus();
          else
            rbx.ReleaseFocus();
        },
      }}
    >
      <uipadding
        PaddingBottom={new UDim(0, 5)}
        PaddingLeft={new UDim(0, 5)}
        PaddingRight={new UDim(0, 5)}
        PaddingTop={new UDim(0, 5)}
      />

      <uisizeconstraint
        MinSize={new Vector2(100, 0)}
      />

      <uicorner
        CornerRadius={new UDim(0, 12)}
      />
      <imagelabel
        Image={"rbxasset://textures/ui/InGameChat/Caret.png"}
        ImageColor3={Color3.fromHex("#FAFAFA")}
        ImageTransparency={0.1}
        AnchorPoint={new Vector2(0.5, 0)}
        BackgroundTransparency={1}
        LayoutOrder={2}
        Position={new UDim2(0.5, 0, 1, 5)}
        Size={UDim2.fromOffset(18, 60)}
      />
    </textbox>
  );
}

export function ChatButton() {
  const [visibleBinding, setButtonVisible] = React.createBinding(true);

  toggleChatVisibility.Connect(vis => {
    let buttonVisible = !vis;

    if (buttonVisible && !UserInputService.TouchEnabled)
      buttonVisible = false;

    setButtonVisible(buttonVisible);
  });

  UserInputService.InputBegan.Connect(() => {
    if (!UserInputService.TouchEnabled && visibleBinding.getValue())
      setButtonVisible(false);
  });

  return <DefaultButton
    Text="Chat"
    Color={uiValues.hud_team_color[0].map(val => ColorUtils.Lighten(val, 0.75))}
    Callback={() => toggleChatVisibility.Fire(true)}
    Size={UDim2.fromOffset(80, 40)}
    Position={new UDim2(0, 20, 0.5, 0)}
    Visible={visibleBinding}
  />;
}

// # Bindings & misc
UserInputService.InputBegan.Connect((input, busy) => {
  if (busy || !KEYCODES.includes(input.KeyCode)) return;

  toggleChatVisibility.Fire();
});