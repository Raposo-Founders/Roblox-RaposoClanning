import ColorUtils from "@rbxts/colour-utils";
import React from "@rbxts/react";

interface DefaultButtonProps {
  Color: React.Binding<Color3>;
  Text: string;
  AnchorPoint?: Vector2;
  Position: UDim2;
  Size: UDim2;
  Callback: Callback;
  Visible?: boolean | React.Binding<boolean>;
}

export function DefaultButton( props: DefaultButtonProps ) 
{
  return (
    <textbutton
      AnchorPoint={props.AnchorPoint}
      FontFace={new Font(
        "rbxasset://fonts/families/GothamSSm.json",
        Enum.FontWeight.SemiBold,
        Enum.FontStyle.Normal
      )}
      Text={props.Text}
      TextColor3={props.Color.map( val => ColorUtils.Darken( val, 0.75 ) )}
      TextScaled={true}
      BackgroundColor3={props.Color}
      Position={props.Position}
      Size={props.Size}
      Event={{
        Activated: () => props.Callback?.(),
      }}
      Visible={props.Visible}
    >
      <uicorner
        CornerRadius={new UDim( 0, 12 )}
      />

      <uipadding
        PaddingBottom={new UDim( 0.15, 0 )}
        PaddingLeft={new UDim( 0.15, 0 )}
        PaddingRight={new UDim( 0.15, 0 )}
        PaddingTop={new UDim( 0.15, 0 )}
      />
    </textbutton>
  );
}

