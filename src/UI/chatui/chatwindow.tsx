import ColorUtils from "@rbxts/colour-utils";
import React, { useEffect } from "@rbxts/react";
import { Players, RunService, TweenService, UserInputService } from "@rbxts/services";
import { RaposoConsole } from "logging";
import { BlankWindow, Window } from "UI/blocks/window";
import { uiValues } from "UI/values";
import Signal from "util/signal";

// # Types
// # Constants & variables
const CHAT_FOCUSED = new Signal<[focused: boolean]>();
const CHAT_DISPLAY_TIME = 5;
const TWEEN_INFO = new TweenInfo( 0.125, Enum.EasingStyle.Linear );

let currentReference: Instance | undefined;

// # Functions
export function RenderChatMessage( text: string ) 
{
  let temporaryVisibility = 0;
  let focusVisibility = 1;

  const textLabel = new Instance( "TextLabel" );
  textLabel.FontFace = new Font(
    "rbxasset://fonts/families/GothamSSm.json",
    Enum.FontWeight.SemiBold,
    Enum.FontStyle.Normal
  );
  textLabel.RichText = true;
  textLabel.Text = text;
  textLabel.TextColor3 = Color3.fromHex( "#FFFFFF" );
  textLabel.TextSize = 16;
  textLabel.TextWrapped = true;
  textLabel.TextXAlignment = Enum.TextXAlignment.Left;
  textLabel.TextYAlignment = Enum.TextYAlignment.Top;
  textLabel.AutomaticSize = Enum.AutomaticSize.Y;
  textLabel.BackgroundTransparency = 1;
  textLabel.Size = UDim2.fromScale( 1, 0 );

  const uIStroke = new Instance( "UIStroke" );
  uIStroke.Thickness = 0.75;
  uIStroke.Parent = textLabel;

  {
    const value = new Instance( "NumberValue" );

    let currentTween: Tween | undefined;

    value.Value = 1;
    value.Changed.Connect( val => focusVisibility = val );

    const connection1 = CHAT_FOCUSED.Connect( focused => 
    {
      if ( currentTween ) 
      {
        currentTween.Cancel();
        currentTween.Destroy();
        currentTween = undefined;
      }

      value.Value = focused ? 1 : 0;

      currentTween = TweenService.Create( value, TWEEN_INFO, { Value: focused ? 0 : 1 } );
      currentTween.Completed.Once( () => 
      {
        currentTween?.Destroy();
        currentTween = undefined;
      } );
      currentTween.Play();
    } );

    textLabel.Destroying.Once( () => 
    {
      connection1.Disconnect();

      currentTween?.Cancel();
      currentTween?.Destroy();
      currentTween = undefined;
    } );
  }

  {
    let connection: RBXScriptConnection | undefined = RunService.PreRender.Connect( () => 
    {
      textLabel.TextTransparency = math.min( focusVisibility, temporaryVisibility );
      uIStroke.Transparency = math.min( focusVisibility, temporaryVisibility );
    } );
    textLabel.Destroying.Once( () => 
    {
      connection?.Disconnect();
      connection = undefined;
    } );
  }

  task.spawn( () => 
  {
    const value = new Instance( "NumberValue" );
    value.Value = 0;

    const tween = TweenService.Create( value, TWEEN_INFO, { Value: 1 } );
    tween.Completed.Once( () => 
    {
      value.Destroy();
      tween.Destroy();
    } );

    value.Changed.Connect( val => temporaryVisibility = val );

    task.wait( CHAT_DISPLAY_TIME );
    tween.Play();
  } );

  if ( currentReference ) 
  {
    textLabel.Parent = currentReference;
    textLabel.LayoutOrder = currentReference.GetChildren().size();
  }
}

export function ChatWindow() 
{
  const parentFrameRef = React.createRef<ScrollingFrame>();
  const [backgroundTransparency, SetBackgroundTransparency] = React.createBinding( 1 );
  const [positionBinding, SetPosition] = React.createBinding( new UDim2( 0, 16, 1, -16 ) );
  const [anchorBinding, SetAnchor] = React.createBinding( new Vector2( 0, 1 ) );
  const backgroundValue = new Instance( "NumberValue" );

  backgroundValue.Value = 1;
  backgroundValue.Changed.Connect( val => SetBackgroundTransparency( val ) );

  let isOnBottom = false;

  const updateCanvasSize = ( inst: ScrollingFrame ) => 
  {
    const childElements: GuiBase2d[] = [];
    let totalVerticalSize = 0;

    for ( const child of inst.GetChildren() ) 
    {
      if ( !child.IsA( "GuiBase2d" ) ) continue;
      childElements.push( child );
    }

    for ( const child of childElements )
      totalVerticalSize += child.AbsoluteSize.Y;

    inst.CanvasSize = new UDim2( 0, 0, 0, totalVerticalSize );
  };

  useEffect( () => 
  {
    currentReference = parentFrameRef.current;

    UserInputService.InputBegan.Connect( () => 
    {
      SetPosition( !UserInputService.TouchEnabled ? new UDim2( 0, 16, 1, -16 ) : new UDim2( 0, 16, 0, 68 ) );
      SetAnchor( !UserInputService.TouchEnabled ? new Vector2( 0, 1 ) : new Vector2( 0, 0 ) );
    } );
  } );

  return (
    <BlankWindow
      AnchorPoint={anchorBinding}
      BackgroundTransparency={backgroundTransparency.map( val => math.lerp( 0.5, 1, val ) )}
      BackgroundColor={uiValues.hud_team_color[0].map( val => ColorUtils.Darken( val, 0.75 ) )}
      Position={positionBinding}
      Size={new UDim2( 0.3, 0, 0.4, 0 )}
      OnMouseEnter={( rbx ) => 
      {
        TweenService.Create( backgroundValue, TWEEN_INFO, { Value: 0 } ).Play();
        CHAT_FOCUSED.Fire( true );
      }}
      OnMouseLeave={( rbx ) => 
      {
        TweenService.Create( backgroundValue, TWEEN_INFO, { Value: 1 } ).Play();
        CHAT_FOCUSED.Fire( false );
      }}
    >
      <textlabel
        FontFace={new Font(
          "rbxasset://fonts/families/GothamSSm.json",
          Enum.FontWeight.SemiBold,
          Enum.FontStyle.Normal
        )}
        Text={`Press ${UserInputService.GetStringForKeyCode( Enum.KeyCode.Slash )} to open chat.`}
        TextTransparency={backgroundTransparency.map( val => math.lerp( 0.5, 1, val ) )}
        TextColor3={Color3.fromHex( "#FFFFFF" )}
        TextSize={20}
        TextWrapped={true}
        AnchorPoint={new Vector2( 0, 1 )}
        AutomaticSize={"XY"}
        BackgroundTransparency={1}
        Position={UDim2.fromOffset( 0, -6 )}
      />
      <scrollingframe
        // AutomaticCanvasSize={"Y"}
        CanvasSize={new UDim2( 0, 0, 0, 0 )}
        ScrollBarThickness={0}
        Active={true}
        BackgroundTransparency={1}
        Size={UDim2.fromScale( 1, 1 )}
        ElasticBehavior={"Never"}
        Event={{
          ChildAdded: scrollingFrame => 
          {
            task.wait();

            updateCanvasSize( scrollingFrame );

            // TODO: Make this fucking offset thing fucking work
            // if (isOnBottom) {
            //   const absoluteY = scrollingFrame.AbsoluteSize.Y;
            //   const offset = scrollingFrame.AbsoluteCanvasSize.Y - absoluteY;

            //   scrollingFrame.CanvasPosition = new Vector2(0, offset);
            // }

            scrollingFrame.CanvasPosition = new Vector2( 0, scrollingFrame.AbsoluteCanvasSize.Y );
          },
          ChildRemoved: scrollingFrame => 
          {
            task.wait();
            updateCanvasSize( scrollingFrame );
          },
        }}
        Change={{
          CanvasPosition: scrollingFrame => 
          {
            const absoluteY = scrollingFrame.AbsoluteSize.Y;
            const currentVerticalPos = scrollingFrame.CanvasPosition.Y;
            const offset = scrollingFrame.AbsoluteCanvasSize.Y - absoluteY;

            isOnBottom = currentVerticalPos === offset;
          },
        }}
        ref={parentFrameRef}
      >
        <uilistlayout SortOrder={"LayoutOrder"} />
        <uipadding PaddingLeft={new UDim( 0, 8 )} PaddingRight={new UDim( 0, 10 )} />
      </scrollingframe>
    </BlankWindow>
  );
}

// # Execution