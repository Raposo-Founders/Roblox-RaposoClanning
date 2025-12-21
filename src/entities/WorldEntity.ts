import { BufferByteType } from "util/bufferwriter";
import BaseEntity from "./BaseEntity";

declare global {
  interface GameEntities {
    WorldEntity: typeof WorldEntity;
  }
}

abstract class WorldEntity extends BaseEntity 
{
  position = new Vector3( 0, 10, 0 );
  rotation = new Vector3();
  velocity = new Vector3();
  size = new Vector3( 1, 1, 1 );

  constructor() 
  {
    super();

    this.inheritanceList.add( "WorldEntity" );

    this.RegisterNetworkableProperty( "position", BufferByteType.vec );
    this.RegisterNetworkableProperty( "rotation", BufferByteType.vec );
    this.RegisterNetworkableProperty( "velocity", BufferByteType.vec );
    this.RegisterNetworkableProperty( "size", BufferByteType.vec );
  }

  ConvertOriginToCFrame() 
  {
    return new CFrame( this.position ).mul( CFrame.Angles( math.rad( this.rotation.Y ), math.rad( this.rotation.X ), math.rad( this.rotation.Z ) ) );
  }
}

export = WorldEntity;
