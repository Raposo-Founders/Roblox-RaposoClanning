import React from "@rbxts/react";
import { colorTable, uiValues } from "UI/values";

export function FairzoneCounter() 
{
  return (
    <frame
      AnchorPoint={new Vector2( 0.5, 0 )}
      BackgroundTransparency={1}
      LayoutOrder={2}
      Position={UDim2.fromScale( 0.5, 0 )}
      Size={UDim2.fromOffset( 200, 50 )}
    >
      <textlabel
        FontFace={new Font(
          "rbxasset://fonts/families/GothamSSm.json",
          Enum.FontWeight.SemiBold,
          Enum.FontStyle.Normal
        )}
        Text={uiValues.hud_game_time[0].map( val => string.format( `%02i:%02i`, math.floor( val / 60 ), val % 60 ) )}
        TextColor3={Color3.fromHex( "#FFFFFF" )}
        TextSize={34}
        TextWrapped={true}
        AnchorPoint={new Vector2( 0.5, 0.5 )}
        AutomaticSize={"XY"}
        BackgroundTransparency={1}
        Position={UDim2.fromScale( 0.5, 0.5 )}
      >
        <uistroke
          Transparency={0.75}
        />
      </textlabel>

      <imagelabel
        Image={"rbxassetid://106500293207599"}
        ImageColor3={Color3.fromHex( colorTable.defendersColor )}
        ScaleType={"Fit"}
        BackgroundTransparency={1}
        Size={UDim2.fromOffset( 50, 50 )}
      />

      <imagelabel
        Image={"rbxassetid://77108112588175"}
        ImageColor3={Color3.fromHex( colorTable.raidersColor )}
        ScaleType={"Fit"}
        AnchorPoint={new Vector2( 1, 0 )}
        BackgroundTransparency={1}
        Position={UDim2.fromScale( 1, 0 )}
        Size={UDim2.fromOffset( 50, 50 )}
      />

      <textlabel // Defenders points
        FontFace={new Font(
          "rbxasset://fonts/families/GothamSSm.json",
          Enum.FontWeight.SemiBold,
          Enum.FontStyle.Normal
        )}
        Text={uiValues.hud_defenders_points[0].map( val => string.format( "%03i", val ) )}
        TextColor3={Color3.fromHex( colorTable.defendersColor )}
        TextSize={34}
        TextWrapped={true}
        AnchorPoint={new Vector2( 1, 0 )}
        AutomaticSize={"XY"}
        BackgroundTransparency={1}
        Position={new UDim2( 0.5, -5, 1, 0 )}
      >
        <uistroke
          Transparency={0.75}
        />
      </textlabel>

      <textlabel // Raiders points
        FontFace={new Font(
          "rbxasset://fonts/families/GothamSSm.json",
          Enum.FontWeight.SemiBold,
          Enum.FontStyle.Normal
        )}
        Text={uiValues.hud_raiders_points[0].map( val => string.format( "%03i", val ) )}
        TextColor3={Color3.fromHex( colorTable.raidersColor )}
        TextSize={34}
        TextWrapped={true}
        AutomaticSize={"XY"}
        BackgroundTransparency={1}
        Position={new UDim2( 0.5, 5, 1, 0 )}
      >
        <uistroke
          Transparency={0.75}
        />
      </textlabel>

      <textlabel
        FontFace={new Font(
          "rbxasset://fonts/families/GothamSSm.json",
          Enum.FontWeight.SemiBold,
          Enum.FontStyle.Normal
        )}
        Text={uiValues.hud_target_points[0].map( val => tostring( val ) )}
        TextColor3={Color3.fromHex( "#FFFFFF" )}
        TextSize={20}
        TextTransparency={0.5}
        TextWrapped={true}
        AnchorPoint={new Vector2( 0.5, 0 )}
        AutomaticSize={"XY"}
        BackgroundTransparency={1}
        Position={new UDim2( 0.5, 0, 1, 39 )}
      />
    </frame>
  );
}