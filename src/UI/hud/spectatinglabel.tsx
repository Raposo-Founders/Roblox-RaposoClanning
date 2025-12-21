import React from "@rbxts/react";
import { PlayerTeam } from "gamevalues";
import { uiValues } from "UI/values";

export function SpectatorLabel() 
{
  return <textlabel
    FontFace={new Font(
      "rbxasset://fonts/families/GothamSSm.json",
      Enum.FontWeight.Bold,
      Enum.FontStyle.Normal
    )}
    Text={"SPECTATING"}
    TextColor3={Color3.fromHex( "#FFFFFF" )}
    TextScaled={true}
    TextTransparency={0.6}
    AnchorPoint={new Vector2( 0.5, 0 )}
    BackgroundTransparency={1}
    Position={UDim2.fromScale( 0.5, 0.25 )}
    Size={UDim2.fromScale( 1, 0.125 )}
    Visible={uiValues.hud_current_team[0].map( val => val === PlayerTeam.Spectators )}
  >
    <textlabel
      FontFace={new Font(
        "rbxasset://fonts/families/GothamSSm.json",
        Enum.FontWeight.Bold,
        Enum.FontStyle.Normal
      )}
      Text={"Feel free to walk around."}
      TextColor3={Color3.fromHex( "#FFFFFF" )}
      TextScaled={true}
      TextTransparency={0.6}
      AnchorPoint={new Vector2( 0.5, 1 )}
      BackgroundTransparency={1}
      Position={UDim2.fromScale( 0.5, 1.15 )}
      Size={UDim2.fromScale( 1, 0.3 )}
      Visible={uiValues.hud_current_team[0].map( val => val === PlayerTeam.Spectators )}
    />
  </textlabel>;
}