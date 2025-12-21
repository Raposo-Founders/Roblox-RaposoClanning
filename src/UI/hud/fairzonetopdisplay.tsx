import React from "@rbxts/react";
import { UserInputService } from "@rbxts/services";
import { uiValues } from "UI/values";

export function FairzoneTopDisplay( props: React.PropsWithChildren ) 
{
  const scaleReference = React.createRef<UIScale>();

  UserInputService.InputBegan.Connect( () => 
  {
    if ( !scaleReference.current ) return;

    scaleReference.current.Scale = UserInputService.TouchEnabled ? 0.75 : 1;
  } );

  return (
    <frame
      AnchorPoint={new Vector2( 0.5, 0 )}
      BackgroundTransparency={1}
      Position={UDim2.fromScale( 0.5, 0 )}
      Size={new UDim2( 1, 0, 0, 50 )}
      Visible={uiValues.hud_gamemode[0].map( val => val === "Fairzone" )}
    >
      <uilistlayout
        Padding={new UDim( 0, 5 )}
        FillDirection={"Horizontal"}
        HorizontalAlignment={"Center"}
        SortOrder={"LayoutOrder"}
      />
      <uiscale ref={scaleReference} />
      {props.children}
    </frame>
  );
}