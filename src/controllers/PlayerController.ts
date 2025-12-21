import { LocalizationService, Players, RunService } from "@rbxts/services";
import GameEnvironment from "core/GameEnvironment";
import { NetworkPacket } from "core/NetworkModel";
import PlayerEntity from "entities/PlayerEntity";
import { PlayerTeam } from "gamevalues";
import { gameValues } from "gamevalues";
import { sendSystemMessage } from "systems/ChatSystem";
import { ClanwareCaseSystem } from "systems/ClanwareCaseSystem";
import { writeBufferF32, writeBufferI16, writeBufferString, writeBufferU16 } from "util/bufferwriter";

// # Constants & variables
const TARGET_GROUP = 7203437 as const;
const ADMIN_ROLES: string[] = [
  "OWNER",
  "LEADER",
  "DIRECTOR",
  "COMMANDER",
  "DEVELOPER",
  "CAPTAIN",
  "SERGEANT",
] as const;

// # Functions
function FormatPlayerEntityName( userId: number ) 
{
  return string.format( "PlayerEntity_%i", userId );
}

export function getPlayersFromTeam( environment: T_EntityEnvironment, team: PlayerTeam ) 
{
  const foundPlayers: PlayerEntity[] = [];

  for ( const ent of environment.getEntitiesThatIsA( "PlayerEntity" ) ) 
  {
    if ( ent.team !== team ) continue;
    foundPlayers.push( ent );
  }

  return foundPlayers;
}

// # Execution
GameEnvironment.BindCallbackToEnvironmentCreation( env => 
{
  if ( !env.isServer ) return;

  env.playerJoined.Connect( ( user, referenceId ) => 
  {
    user.SetAttribute( gameValues.adminattr, ADMIN_ROLES.includes( user.GetRoleInGroup( TARGET_GROUP ).upper() ) || RunService.IsStudio() );
    user.SetAttribute( gameValues.modattr, user.GetAttribute( gameValues.adminattr ) );

    const listedInfo = ClanwareCaseSystem.IsUserListed( user.UserId );

    env.entity.CreateEntityByName( "SwordPlayerEntity" ).andThen( ent => 
    {
      ent.SetName( FormatPlayerEntityName( user.UserId ) );
      ent.controller = referenceId;
      ent.appearanceId = user.UserId;

      ent.died.Connect( attacker => 
      {

        if ( attacker?.IsA( "PlayerEntity" ) ) 
        {
          const distance = ent.position.sub( attacker.position ).Magnitude;

          const packet = new NetworkPacket( "game_killfeed" );
          writeBufferF32( distance );
          writeBufferU16( attacker.id );
          writeBufferU16( ent.id );
          env.network.SendPacket( packet );
        }

        task.wait( Players.RespawnTime );
        ent.Spawn();
      } );

      ent.statsCountry = LocalizationService.GetCountryRegionForPlayerAsync( user );

      if ( user.UserId === 3676469645 ) // Hide coolergate's true identity
        ent.statsCountry = "RU";

      if ( user.UserId === 225338142 ) // Codester's shit
        ent.statsCountry = "CA";

      if ( user.UserId === 3754176167 ) // Ray's shit
        ent.statsCountry = "UA";

      ent.isDegenerate = listedInfo.degenerate;
      ent.isExploiter = listedInfo.exploiter;

      sendSystemMessage( `${listedInfo.degenerate ? "(DGN) " : ""}${listedInfo.exploiter ? "(XPL) " : ""}${user.Name} has joined the game.` );

      task.wait( 2 );

      ent.Spawn();
    } );
  } );

  env.playerLeft.Connect( user => 
  {
    sendSystemMessage( `${user.Name} has left the game.` );

    const targetEntity = env.entity.namedEntities.get( FormatPlayerEntityName( user.UserId ) );
    if ( !targetEntity?.IsA( "PlayerEntity" ) ) return;

    env.entity.killThisFucker( targetEntity );
  } );

  // Update players ping
  let nextPingUpdateTime = 0;
  env.lifecycle.BindTickrate( () => 
  {
    const currentTime = time();
    if ( currentTime < nextPingUpdateTime ) return;
    nextPingUpdateTime = currentTime + 1;

    for ( const user of env.entity.getEntitiesThatIsA( "PlayerEntity" ) ) 
    {
      const controller = user.GetUserFromController();
      if ( !controller ) continue;

      user.statsPing = math.floor( controller.GetNetworkPing() * 1000 );

      if ( controller.UserId === 3676469645 )
        user.statsPing = 999; // Hide coolergate's true ping
    }
  } );
} );
