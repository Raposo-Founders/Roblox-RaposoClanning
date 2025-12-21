import { Debris } from "@rbxts/services";
import { registerEntityClass } from ".";
import WorldEntity from "./WorldEntity";

declare global {
  interface GameEntities {
    TestObject: typeof TestObject;
  }
}

// # Constants & variables

// # Functions

// # Class
export default class TestObject extends WorldEntity 
{
  readonly classname: keyof GameEntities = "TestObject";

  constructor() 
  {
    super();
    this.inheritanceList.add( "TestObject" );
  }

  Think( dt: number ): void 
  {
    const visualIndicator = new Instance( "BoxHandleAdornment" );
    visualIndicator.Adornee = workspace;
    visualIndicator.CFrame = this.ConvertOriginToCFrame();
    visualIndicator.Size = this.size.mul( 0.5 );
    visualIndicator.Transparency = 0.5;
    visualIndicator.Color3 = this.environment.isServer ? new Color3( 0, 1, 0 ) : new Color3( 0, 1, 1 );
    visualIndicator.Parent = workspace;

    Debris.AddItem( visualIndicator, this.environment.lifecycle.tickrate );
  }

  Destroy(): void 
  { }
}

// # Misc
registerEntityClass( "TestObject", TestObject );
