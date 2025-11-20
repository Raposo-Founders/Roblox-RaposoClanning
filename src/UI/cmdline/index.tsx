import ColorUtils from "@rbxts/colour-utils";
import React, { useEffect } from "@rbxts/react";
import ReactRoblox from "@rbxts/react-roblox";
import { Players, UserInputService } from "@rbxts/services";
import { ExecuteCommand } from "cmd";
import { CCVar, ConsoleFunctionCallback, createdCVars } from "cmd/cvar";
import GameEnvironment from "core/GameEnvironment";

import { CONSOLE_OUT, ConsoleOutputType } from "logging";
import { Window } from "UI/blocks/window";
import { uiValues } from "UI/values";
import Signal from "util/signal";

// # Constants & variables
const PREFIX_TEXT = `${Players.LocalPlayer?.Name}@Raposo $`;
const TEXT_SIZE = 18;
const KEYBIND = Enum.KeyCode.F2;

const LOADING_CHARS_LIST = ["|", "/", "—", "\\"] as const;
const CLEAR_ALL_OUTPUT = new Signal();

const [masterVisible, setMasterVisible] = React.createBinding(false);
const textChanged = new Signal<[newText: string]>();
const focusTextBox = new Signal();

let currentDisplayIndex = 1;
let currentContentFrame: Frame | undefined;

// # Functions
function formatString(text: string) {
  return text.gsub("^%s+", "")[0].gsub("%s+$", "")[0];
}

async function SpawnInputBar() {
  do task.wait(); while (!currentContentFrame);

  const root = ReactRoblox.createRoot(currentContentFrame, { hydrate: true });
  root.render(<InputBarElement />);

  CLEAR_ALL_OUTPUT.Once(() => {
    root.unmount();
  });
}

function InputBarElement() {
  const parentFrameRef = React.createRef<Frame>();
  const textboxRef = React.createRef<TextBox>();
  const boundConnections: Callback[] = [];

  {
    const connection = focusTextBox.Connect(() => {
      if (!textboxRef.current || !textboxRef.current.TextEditable) return;
      GameEnvironment.GetDefaultEnvironment().lifecycle.YieldForTicks(2);
      if (masterVisible.getValue())
        textboxRef.current.CaptureFocus();
      else
        textboxRef.current.ReleaseFocus(false);
    });

    boundConnections.push(() => connection.Disconnect());
  }

  return (
    <frame
      AutomaticSize={"Y"}
      BackgroundTransparency={1}
      LayoutOrder={9999}
      Size={UDim2.fromScale(1, 0)}
      ref={parentFrameRef}
    >
      <textlabel
        FontFace={new Font("rbxassetid://16658246179")}
        Text={PREFIX_TEXT}
        TextColor3={Color3.fromHex("#55AAFF")}
        TextSize={TEXT_SIZE}
        TextWrapped={false}
        AutomaticSize={"XY"}
        BackgroundTransparency={1}
      />

      <textbox
        ClearTextOnFocus={false}
        CursorPosition={-1}
        FontFace={new Font("rbxassetid://16658246179")}
        PlaceholderColor3={Color3.fromHex("#646464")}
        PlaceholderText={"Your command here"}
        Text={""}
        TextColor3={Color3.fromHex("#C8C8C8")}
        TextSize={TEXT_SIZE}
        TextWrapped={true}
        RichText={true}
        TextXAlignment={"Left"}
        AutomaticSize={"Y"}
        BackgroundTransparency={1}
        ClipsDescendants={true}
        LayoutOrder={1}
        Size={UDim2.fromScale(1, 0)}
        ref={textboxRef}
        Change={{
          Text: (rbx) => textChanged.Fire(rbx.TextEditable ? rbx.Text : ""),
        }}
        Event={{
          Destroying: () => {
            for (const callback of boundConnections)
              callback();
            boundConnections.clear();
          },

          FocusLost: (rbx, enterPressed) => {
            if (!enterPressed) return;

            const text = formatString(rbx.Text);
            const startTime = time();

            currentDisplayIndex++;
            if (parentFrameRef.current) parentFrameRef.current.LayoutOrder = currentDisplayIndex;
            rbx.TextEditable = false;
            rbx.TextColor3 = new Color3(1, 1, 1);

            const thread1 = task.spawn(() => {
              let currentIndex = 0;
              let nextRotationTime = 0;

              while (game) {
                const elapsedTime = time() - startTime;
                const timePassed = math.floor(elapsedTime * 100) * 0.01;

                if (elapsedTime >= nextRotationTime) {
                  currentIndex++;
                  if (currentIndex > LOADING_CHARS_LIST.size())
                    currentIndex = 1;

                  nextRotationTime = elapsedTime + 0.25;
                }

                rbx.Text = `${string.format("%s %.2f", LOADING_CHARS_LIST[currentIndex - 1], timePassed)}s...`;
                task.wait(0.1);
              }
            });

            ExecuteCommand(text, GameEnvironment.GetDefaultEnvironment()).finally(() => {
              task.cancel(thread1);
              rbx.Text = text;
              SpawnInputBar();
              focusTextBox.Fire();
            });
          },
        }}
      >
        <uiflexitem
          FlexMode={"Shrink"}
        />
      </textbox>

      <uilistlayout
        Padding={new UDim(0, 5)}
        FillDirection={"Horizontal"}
        SortOrder={"LayoutOrder"}
      />
    </frame>
  );
}

function SuggestionsFrame() {
  const [suggestionsVisibleBinding, SetSuggestionsVisible] = React.createBinding(false);

  const referenceParent = React.createRef<Frame>();
  let root: ReactRoblox.Root | undefined;

  React.useEffect(() => {
    if (!referenceParent.current) return;
    root = ReactRoblox.createRoot(referenceParent.current);
  });

  textChanged.Connect((newText) => {
    const fetchedFunctionSuggestions: ConsoleFunctionCallback[] = [];
    const fetchedVariablesSuggestions: CCVar<unknown>[] = [];
    const renderElements: React.Element[] = [];

    if (newText === "") {
      root?.unmount();
      return;
    }

    newText = newText.split(" ")[0];

    for (const callbackInfo of ConsoleFunctionCallback.list) {
      let isValid = false;

      for (const name of callbackInfo.names) {
        if (name.sub(0, newText.size()) !== newText) continue;
        isValid = true;
      }

      if (isValid)
        fetchedFunctionSuggestions.push(callbackInfo);
    }

    for (const [name, variableInfo] of createdCVars) {
      if (name.sub(0, newText.size()) !== newText) continue;
      fetchedVariablesSuggestions.push(variableInfo);
    }

    // print(`"${newText}"`);
    // print("Valid callbacks:", fetchedFunctionSuggestions);
    // print("Valid variables:", fetchedVariablesSuggestions);
    SetSuggestionsVisible(fetchedFunctionSuggestions.size() > 0 || fetchedVariablesSuggestions.size() > 0);

    for (const info of fetchedFunctionSuggestions) {
      const argumentsElement: React.Element[] = [];

      for (const arg of info.args) {
        argumentsElement.push(<textlabel
          FontFace={new Font("rbxassetid://16658246179")}
          Text={`<${arg.name} (${arg.type})>`}
          TextColor3={Color3.fromHex("#FFFFFF")}
          TextSize={18}
          TextTransparency={0.5}
          TextWrapped={true}
          AutomaticSize={"XY"}
          BackgroundTransparency={1}
          LayoutOrder={argumentsElement.size() + 1}
          Size={UDim2.fromScale(0, 1)}
        >
          <uipadding
            PaddingBottom={new UDim(0, 4)}
            PaddingTop={new UDim(0, 4)}
          />
        </textlabel>);
      }

      renderElements.push(
        <frame // TODO: Change this to a text button
          // FontFace={new Font("rbxasset://fonts/families/SourceSansPro.json")}
          // Text={""}
          // TextColor3={Color3.fromHex("#000000")}
          // TextSize={14}
          BackgroundColor3={Color3.fromHex("#323232")}
          BorderColor3={Color3.fromHex("#000000")}
          BorderSizePixel={0}
          Size={new UDim2(1, 0, 0, 30)}
        >
          <frame // Left side content
            BackgroundTransparency={1}
            Size={UDim2.fromScale(1, 1)}
          >
            <uilistlayout
              Padding={new UDim(0, 5)}
              FillDirection={"Horizontal"}
              SortOrder={"LayoutOrder"}
            />

            <imagelabel // Icon
              BackgroundTransparency={1}
              Size={UDim2.fromScale(1, 1)}
              LayoutOrder={-2}
            >
              <uiaspectratioconstraint />
            </imagelabel>

            <textlabel // Name
              FontFace={new Font("rbxassetid://16658246179")}
              Text={info.names[0]}
              TextColor3={Color3.fromHex("#FFFFFF")}
              TextSize={20}
              TextWrapped={true}
              TextXAlignment={"Left"}
              AutomaticSize={"XY"}
              BackgroundTransparency={1}
              Size={UDim2.fromScale(0, 1)}
              LayoutOrder={-1}
            >
              <uipadding
                PaddingBottom={new UDim(0, 4)}
                PaddingTop={new UDim(0, 4)}
              />
            </textlabel>

            {argumentsElement}
          </frame>
          <uicorner
            CornerRadius={new UDim(0, 4)}
          />
          <uistroke
            ApplyStrokeMode={"Border"}
            Color={Color3.fromHex("#FFFFFF")}
            Transparency={0.75}
          />
        </frame>
      );

      root?.render(<>
        <uistroke
          ApplyStrokeMode={"Border"}
          Color={Color3.fromHex("#FFFFFF")}
          Transparency={0.75}
        />
        <uipadding
          PaddingBottom={new UDim(0, 4)}
          PaddingLeft={new UDim(0, 4)}
          PaddingRight={new UDim(0, 4)}
          PaddingTop={new UDim(0, 4)}
        />
        <uilistlayout
          Padding={new UDim(0, 5)}
          SortOrder={"LayoutOrder"}
        />
        <uicorner />
        {renderElements}
      </>
      );
    }
  });

  return (
    <frame
      AutomaticSize={"Y"}
      BackgroundColor3={Color3.fromHex("#000000")}
      BackgroundTransparency={0.5}
      BorderSizePixel={0}
      Size={UDim2.fromScale(1, 0)}
      Visible={suggestionsVisibleBinding}
      ref={referenceParent}
    />
  );
}

export function CommandLine() {
  SpawnInputBar();

  const contentRef = React.createRef<Frame>();

  useEffect(() => {
    if (!contentRef.current) return;
    currentContentFrame = contentRef.current;
  });

  return <Window
      AccentColor={uiValues.hud_team_color[0]}
      BackgroundColor={uiValues.hud_team_color[0].map(val => ColorUtils.Darken(val, 0.75))}
      Size={UDim2.fromScale(0.5, 0.5)}
      Title="Raposo Console"
      Visible={masterVisible}
      OnClose={() => setMasterVisible(false)}
    >
    <frame
      AnchorPoint={new Vector2(0.5, 0.5)}
      BackgroundColor3={Color3.fromHex("#FFFFFF")}
      BackgroundTransparency={1}
      BorderColor3={Color3.fromHex("#000000")}
      BorderSizePixel={0}
      Position={UDim2.fromScale(0.5, 0.5)}
      Size={UDim2.fromScale(1, 1)}
      ref={contentRef}
    >
      <uilistlayout
        Padding={new UDim(0, 5)}
        VerticalAlignment={"Bottom"}
        HorizontalAlignment={"Center"}
        SortOrder={"LayoutOrder"}
      />
      <uipadding
        PaddingBottom={new UDim(0, 5)}
        PaddingLeft={new UDim(0, 7)}
        PaddingRight={new UDim(0, 5)}
        PaddingTop={new UDim(0, 5)}
      />
    </frame>
    {/* <SuggestionsFrame /> */}
  </Window>;
}

export function renderConsoleMessage(msgType: ConsoleOutputType, message: string) {
  if (!currentContentFrame) return;

  let textColor = Color3.fromHex("#FFFFFF");
  if (msgType === "warn") textColor = Color3.fromRGB(255, 200, 0);
  if (msgType === "error") textColor = Color3.fromRGB(255, 30, 0);

  currentDisplayIndex++;

  const element = <textbox
    ClearTextOnFocus={false}
    CursorPosition={-1}
    FontFace={new Font("rbxassetid://16658246179")}
    PlaceholderText=""
    Text={message}
    TextColor3={textColor}
    TextEditable={false}
    TextSize={TEXT_SIZE}
    TextWrapped={true}
    TextXAlignment={"Left"}
    AutomaticSize={"Y"}
    BackgroundTransparency={1}
    ClipsDescendants={true}
    LayoutOrder={currentDisplayIndex}
    Size={UDim2.fromScale(1, 0)}
  />;

  const root = ReactRoblox.createRoot(currentContentFrame, { "hydrate": true });
  root.render(element);

  CLEAR_ALL_OUTPUT.Once(() => root.unmount());
}

// # Execution
CONSOLE_OUT.Connect((msgType, message) => renderConsoleMessage(msgType, message));

UserInputService.InputBegan.Connect((input, gameProcessed) => {
  if (input.KeyCode !== KEYBIND || gameProcessed) return;
  setMasterVisible(!masterVisible.getValue());
  focusTextBox.Fire();
});

new ConsoleFunctionCallback(["testyield"], [{ name: "time", type: "number" }])
  .setCallback((ctx) => {
    const timeAmount = ctx.getArgument("time", "number").value;
    ctx.Reply(`Yielding for ${timeAmount} seconds!`);
    task.wait(10);
  });

new ConsoleFunctionCallback(["clear", "cls"], [])
  .setDescription("Clears the console output.")
  .setCallback((ctx) => {
    currentDisplayIndex = 1;
    CLEAR_ALL_OUTPUT.Fire();
  });
