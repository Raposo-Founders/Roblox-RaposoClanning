import { PlayerTeam } from "gamevalues";
import { BufferByteType } from "util/bufferwriter";
import { registerEntityClass } from ".";
import BaseEntity from "./BaseEntity";

declare global {
  interface GameEntities {
    CapturePointEntity: typeof CapturePointEntity;
  }
}

// # Constants & variables

// # Functions

// # Class
export default class CapturePointEntity extends BaseEntity 
{
  readonly classname: keyof GameEntities = "CapturePointEntity";

  current_team = PlayerTeam.Spectators;
  capture_progress = 0; // (float) -1(raiders) to 1(defenders).
  capture_speed = 2.5;
  is_instant_cap = false;

  linkedTrigger: BaseEntity["name"] = "";

  constructor() 
  {
    super();
    this.inheritanceList.add( "CapturePointEntity" );

    this.RegisterNetworkableProperty( "capture_progress", BufferByteType.f32 );
    this.RegisterNetworkableProperty( "capture_speed", BufferByteType.f32 );
    this.RegisterNetworkableProperty( "current_team", BufferByteType.u8 );
    this.RegisterNetworkableProperty( "is_instant_cap", BufferByteType.bool );
  }

  Think( dt: number ): void 
  {
    if ( !this.environment.isServer || this.environment.isPlayback ) return;

    this.UpdateCaptureProgress( dt );
  }

  UpdateCaptureProgress( dt: number ) 
  {
    let total_capture_multiplier = 0;

    const triggerEntity = this.environment.entity.namedEntities.get( this.linkedTrigger );
    if ( triggerEntity?.IsA( "TriggerEntity" ) )
      for ( const ent of triggerEntity.GetEntitiesInZone() ) 
      {
        if ( !ent.IsA( "PlayerEntity" ) || ent.team === PlayerTeam.Spectators ) continue;
        total_capture_multiplier += ent.team === PlayerTeam.Defenders ? 1 : -1;
      }

    this.capture_progress = math.clamp( this.capture_progress + ( ( this.capture_speed * total_capture_multiplier ) * dt ), -1, 1 );

    if ( this.is_instant_cap )
      this.capture_progress = math.sign( total_capture_multiplier );

    if ( this.capture_progress > 0 )
      this.current_team = PlayerTeam.Defenders;

    if ( this.capture_progress < 0 )
      this.current_team = PlayerTeam.Raiders;
  }

  Destroy(): void 
  { }
}

// # Misc
registerEntityClass( "CapturePointEntity", CapturePointEntity );
