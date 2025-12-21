import React from "@rbxts/react";
import { RunService } from "@rbxts/services";
import { DoesInstanceExist } from "util/utilfuncs";

interface SpinningIconProps extends WritableInstanceProperties<ImageLabel> {
  SpinSpeed: number;
}

export function SpinningIcon( props: Partial<SpinningIconProps> ) 
{
  const imageRef = React.createRef<ImageLabel>();
  let currentSpinningThread: thread | undefined;

  const clonedProps = table.clone( props );
  delete clonedProps.SpinSpeed;

  React.useEffect( () => 
  {
    currentSpinningThread = task.spawn( () => 
    {
      while ( imageRef.current && DoesInstanceExist( imageRef.current ) ) 
      {
        const deltaTime = RunService.RenderStepped.Wait()[0];

        if ( imageRef.current.ImageTransparency === 1 || !imageRef.current.Visible ) 
        {
          continue;
        }

        imageRef.current.Rotation += ( props.SpinSpeed ?? 200 ) * deltaTime;
      }
    } );

    return () => 
    {
      if ( currentSpinningThread ) 
      {
        task.cancel( currentSpinningThread );
        currentSpinningThread = undefined;
      }
    };
  } );

  return <imagelabel {...clonedProps} ref={imageRef} />;
}