import React from "@rbxts/react";
import ReactRoblox from "@rbxts/react-roblox";
import { CONSOLE_OUT, RaposoConsole } from "logging";

const parentFrameRef = React.createRef<Frame>();

function ScreenLog( props: { Text: string, Color: string } )
{
  return <textlabel
    FontFace={new Font(
      "rbxassetid://16658246179",
      Enum.FontWeight.Bold,
      Enum.FontStyle.Normal
    )}
    Text={props.Text}
    TextColor3={Color3.fromHex( "#FFFFFF" )}
    TextSize={20}
    TextStrokeTransparency={0}
    AutomaticSize={"XY"}
    BackgroundColor3={Color3.fromHex( "#FFFFFF" )}
    BackgroundTransparency={1}
    BorderColor3={Color3.fromHex( "#000000" )}
    BorderSizePixel={0}
  />;
}

export function OnScreenLogging() 
{
  CONSOLE_OUT.Connect( ( level, message ) => 
  {
    if ( !parentFrameRef.current ) return;

    const root = ReactRoblox.createRoot( parentFrameRef.current, { hydrate: true } );
    root.render( <ScreenLog Text={message} Color="#FFFFFF" /> );

    task.wait( 1 );

    root.unmount();
  } );

  return (
    <frame
      BackgroundTransparency={1}
      Size={UDim2.fromScale( 1, 1 )}
      ref={parentFrameRef}
    >
      <uilistlayout
        SortOrder={"LayoutOrder"}
        VerticalAlignment={"Bottom"}
      />

      <uipadding
        PaddingLeft={new UDim( 0, 8 )}
      />
    </frame>
  );
}