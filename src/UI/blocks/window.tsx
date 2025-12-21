import ColorUtils from "@rbxts/colour-utils";
import React from "@rbxts/react";
import { RunService, UserInputService } from "@rbxts/services";

// # Types
interface WindowBaseProperties {
  AnchorPoint?: React.Binding<Vector2> | Vector2;
  BackgroundColor?: Color3 | React.Binding<Color3>;
  BackgroundTransparency?: number | React.Binding<number>;
  Position?: React.Binding<UDim2>;
  Size?: UDim2 | React.Binding<UDim2>;
  Visible?: boolean | React.Binding<boolean>;
  OnMouseEnter?: ( rbx: ImageLabel ) => void;
  OnMouseLeave?: ( rbx: ImageLabel ) => void;
}

interface WindowProperties {
  Title: string;
  Draggable?: boolean;
  CanClose?: boolean;
  OnClose?: Callback;
  AccentColor: React.Binding<Color3>;
}

// # Constants & variables
const TITLEBAR_SIZE = 30;

// # Functions
export function BlankWindow( props: WindowBaseProperties & React.PropsWithChildren ) 
{
  return (
    <imagelabel
      AnchorPoint={props.AnchorPoint}
      Image={"rbxassetid://117621230005124"}
      ImageColor3={props.BackgroundColor}
      ImageTransparency={props.BackgroundTransparency}
      ScaleType={"Slice"}
      SliceCenter={new Rect( 18, 18, 258, 258 )}
      BackgroundTransparency={1}
      Position={props.Position ?? new UDim2( 0.25, 0, 0.25, 0 )}
      Size={props.Size}
      Visible={props.Visible}
      Event={{
        MouseEnter: ( rbx ) => props.OnMouseEnter?.( rbx ),
        MouseLeave: ( rbx ) => props.OnMouseLeave?.( rbx ),
      }}
    >
      <uipadding
        PaddingBottom={new UDim( 0, 10 )}
        PaddingLeft={new UDim( 0, 10 )}
        PaddingRight={new UDim( 0, 10 )}
        PaddingTop={new UDim( 0, 10 )}
      />
      <uiscale Scale={UserInputService.TouchEnabled ? 0.75 : 1} />
      {props.children}
    </imagelabel>
  );
}

export function Window( props: WindowProperties & Exclude<WindowBaseProperties, WindowProperties> & React.PropsWithChildren ) 
{
  const [windowPosition, SetWindowPosition] = React.createBinding( props.Position?.getValue() ?? new UDim2( 0.25, 0, 0.25, 0 ) );
  let currentDraggingThread: thread | undefined;
  let currentInput: InputObject | undefined;

  UserInputService.InputEnded.Connect( input => 
  {
    if ( input !== currentInput ) return;

    if ( currentDraggingThread )
      task.cancel( currentDraggingThread );

    currentInput = undefined;
    currentDraggingThread = undefined;
  } );

  return (
    <BlankWindow
      AnchorPoint={props.AnchorPoint}
      BackgroundColor={props.BackgroundColor}
      BackgroundTransparency={props.BackgroundTransparency}
      Position={windowPosition}
      Size={props.Size}
      Visible={props.Visible}
      OnMouseEnter={props.OnMouseEnter}
      OnMouseLeave={props.OnMouseLeave}
    >
      <frame // Title bar
        BackgroundColor3={props.AccentColor}
        BorderSizePixel={0}
        Size={new UDim2( 1, 0, 0, TITLEBAR_SIZE )}
        Event={{
          InputBegan: ( rbx, input ) => 
          {
            if ( props.Draggable !== undefined && !props.Draggable ) return;
            if ( input.UserInputType.Name !== "MouseButton1" && input.UserInputType.Name !== "Touch" ) return;

            if ( currentDraggingThread ) 
            {
              task.cancel( currentDraggingThread );
              currentDraggingThread = undefined;
            }

            let lastPosition: Vector2;

            const getInputPosition = () => 
            {
              if ( input.UserInputType.Name === "MouseButton1" )
                return UserInputService.GetMouseLocation();

              return new Vector2( input.Position.X, input.Position.Y );
            };

            const getInputDelta = () => 
            {
              if ( input.UserInputType.Name === "MouseButton1" )
                return lastPosition.sub( getInputPosition() );

              return lastPosition.sub( new Vector2( input.Position.X, input.Position.Y ) );
            };

            currentInput = input;
            lastPosition = getInputPosition();
            currentDraggingThread = task.spawn( () => 
            {
              while ( game ) 
              {
                const currentInputPosition = getInputPosition();
                const delta = getInputDelta().mul( -1 );

                SetWindowPosition( windowPosition.getValue().add( UDim2.fromOffset( delta.X, delta.Y ) ) );

                lastPosition = currentInputPosition;
                RunService.Heartbeat.Wait();
              }
            } );
          },
        }}
      >
        <uicorner />

        <textlabel
          FontFace={new Font(
            "rbxasset://fonts/families/GothamSSm.json",
            Enum.FontWeight.SemiBold,
            Enum.FontStyle.Normal
          )}
          Text={props.Title}
          TextColor3={props.AccentColor.map( val => ColorUtils.Lighten( val, 0.75 ) )}
          TextSize={20}
          TextXAlignment={"Left"}
          TextYAlignment={"Top"}
          AnchorPoint={new Vector2( 0, 0.5 )}
          AutomaticSize={"XY"}
          BackgroundTransparency={1}
          Position={new UDim2( 0, 10, 0.5, 0 )}
        />

        <frame
          AnchorPoint={new Vector2( 1, 1 )}
          BackgroundColor3={props.AccentColor}
          BorderSizePixel={0}
          Position={UDim2.fromScale( 1, 1 )}
          Size={new UDim2( 1, 0, 0, 8 )}
        />

        <imagebutton // Close button
          Image={"rbxassetid://121170729755093"}
          ImageColor3={props.AccentColor.map( val => ColorUtils.Lighten( val, 0.75 ) )}
          ScaleType={"Fit"}
          AnchorPoint={new Vector2( 1, 0.5 )}
          BackgroundTransparency={1}
          BorderSizePixel={0}
          Position={new UDim2( 1, -10, 0.5, 0 )}
          Size={UDim2.fromOffset( 32, 32 )}
          Visible={props.CanClose ?? true}
          Event={{
            Activated: () => props.OnClose?.(),
          }}
        >
          <uiaspectratioconstraint />
        </imagebutton>
      </frame>
      <frame // Content frame
        BackgroundTransparency={1}
        Size={new UDim2( 1, 0, 1, -TITLEBAR_SIZE )}
        Position={new UDim2( 0, 0, 0, TITLEBAR_SIZE )}
      >
        {props.children}
      </frame>
    </BlankWindow>
  );
}