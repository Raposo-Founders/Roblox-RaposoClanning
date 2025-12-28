import { ConsoleFunctionCallback } from "cmd/cvar";
import GameEnvironment from "core/GameEnvironment";
import { PlayerTeam } from "gamevalues";
import { gameValues } from "gamevalues";
import { GetGroupInfo } from "providers/GroupsProvider";
import { uiValues } from "UI/values";
import { writeBufferF32, writeBufferU32, writeBufferU8 } from "util/bufferwriter";
import ChatSystem from "../systems/ChatSystem";
import { webhookLogEvent } from "../systems/WebhookSystem";
import { getPlayersFromTeam } from "./PlayerController";
import { finishNetworkPacket, startNetworkPacket } from "core/Network";

// # Constants & variables

// # Functions

function ResetCapturePoints( session: GameEnvironment ) 
{
  for ( const ent of session.entity.getEntitiesThatIsA( "CapturePointEntity" ) ) 
  {
    ent.capture_progress = 0;
    ent.current_team = PlayerTeam.Spectators;
  }
}

function ResetPlayers( session: GameEnvironment ) 
{
  for ( const ent of session.entity.getEntitiesThatIsA( "PlayerEntity" ) ) 
  {
    ent.anchored = false;
    ent.canDealDamage = true;
    ent.statsKills = 0;
    ent.statsDeaths = 0;
    ent.statsDamage = 0;
    ent.Spawn();
  }
}

// # Bindings & misc
GameEnvironment.BindCallbackToEnvironmentCreation( env => 
{
  if ( !env.isServer ) return;

  const teamPoints = new Map<PlayerTeam, number>();
  let isRunning = false;
  let targetPoints = 600;
  let nextUpdateTime = 0;
  let raidingGroupId = 0;
  let totalTeamSize = 5;
  
  let elapsedMatchTime = 0;

  env.netctx.ListenServer( "match_start", ( sender, reader ) => 
  {
    if ( !sender || !sender.GetAttribute( gameValues.adminattr ) ) return;

    if ( raidingGroupId === 0 ) 
    {
      ChatSystem.sendSystemMessage( `Unable to start match: Raiding group id must be set first with ${gameValues.cmdprefix}setraiders <groupId>.` );
      return;
    }

    const pointsAmount = reader.u32();

    isRunning = true;
    targetPoints = pointsAmount;
    teamPoints.clear();

    ResetCapturePoints( env );
    ResetPlayers( env );

    nextUpdateTime = time() + 1;
    elapsedMatchTime = 0;

    // SPAMMMMMM
    ChatSystem.sendSystemMessage( "!!! MATCH STARTED !!!" );
    ChatSystem.sendSystemMessage( "!!! MATCH STARTED !!!" );
    ChatSystem.sendSystemMessage( "!!! MATCH STARTED !!!" );
  } );

  env.netctx.ListenServer( "match_changepts", ( sender, reader ) => 
  {
    if ( !sender || !sender.GetAttribute( gameValues.adminattr ) ) return;
    targetPoints = reader.u32();
  } );

  // Core logic loop
  env.lifecycle.BindTickrate( ( dt ) => 
  {
    if ( !isRunning ) return;

    elapsedMatchTime += dt.tickrate;

    const currentTime = time();
    if ( currentTime < nextUpdateTime ) return;
    nextUpdateTime = currentTime + 1;

    for ( const ent of env.entity.getEntitiesThatIsA( "CapturePointEntity" ) ) 
    {
      if ( math.abs( ent.capture_progress ) !== 1 ) continue;
      if ( ent.current_team === PlayerTeam.Spectators ) continue;

      const pointsAmount = ( teamPoints.get( ent.current_team ) || 0 );
      teamPoints.set( ent.current_team, pointsAmount + 1 );
    }

    for ( const [teamIndex, points] of teamPoints ) 
    {
      if ( points < targetPoints ) continue;
      isRunning = false;

      startNetworkPacket( { id: "match_ended", context: env.netctx, unreliable: false } );
      // writeBufferU32(targetPoints);
      writeBufferU8( teamIndex );
      writeBufferU32( teamPoints.get( PlayerTeam.Defenders ) || 0 );
      writeBufferU32( teamPoints.get( PlayerTeam.Raiders ) || 0 );
      finishNetworkPacket();

      webhookLogEvent(
        teamIndex,
        teamPoints.get( PlayerTeam.Defenders ) || 0,
        teamPoints.get( PlayerTeam.Raiders ) || 0,
        env.entity,
      );

      for ( const ent of env.entity.getEntitiesThatIsA( "PlayerEntity" ) ) 
      {
        ent.canDealDamage = false;
        ent.anchored = true;
      }

      break;
    }
  } );

  // Match status update
  env.lifecycle.BindTickrate( ctx => 
  {
    startNetworkPacket( { id: "match_update", context: env.netctx, unreliable: true } );

    writeBufferU32( targetPoints );
    writeBufferU32( raidingGroupId );
    writeBufferU8( totalTeamSize );
    writeBufferU32( teamPoints.get( PlayerTeam.Defenders ) || 0 );
    writeBufferU32( teamPoints.get( PlayerTeam.Raiders ) || 0 );
    writeBufferF32( elapsedMatchTime );
    
    finishNetworkPacket();
  } );

  env.netctx.ListenServer( "match_teamamount", ( sender, reader ) => 
  {
    if ( !sender || !sender.GetAttribute( gameValues.adminattr ) ) return;

    const playersAmount = reader.u8();

    totalTeamSize = playersAmount;
    env.attributes.totalTeamSize = playersAmount;
  } );

  env.netctx.ListenServer( "match_setraiders", ( sender, reader ) => 
  {
    if ( !sender || !sender.GetAttribute( gameValues.adminattr ) ) return;

    const groupId = reader.u32();

    raidingGroupId = groupId;
    env.attributes.raidingGroupId = groupId;

    ChatSystem.sendSystemMessage( `Set raiders' group to: ${GetGroupInfo( groupId ).Name} (${groupId}).` );

    // Check to see if all the raiding players are in the raiding group
    for ( const ent of getPlayersFromTeam( env.entity, PlayerTeam.Raiders ) ) 
    {
      const controller = ent.GetUserFromController();
      if ( !controller || controller.IsInGroup( groupId ) ) continue;

      ent.team = PlayerTeam.Spectators;
      ent.Spawn();

      ChatSystem.sendSystemMessage( `Player ${controller.Name} moved to spectators: Not in the raiding group.` );
    }
  } );
} );

GameEnvironment.BindCallbackToEnvironmentCreation( env => 
{
  if ( env.isServer ) return;

  env.netctx.ListenClient( "match_update", reader => 
  {
    const targetPoints = reader.u32();
    const raidingGroupId = reader.u32();
    const matchTeamSize = reader.u8();
    const defendersPoints = reader.u32();
    const raidersPoints = reader.u32();
    const elapsedTime = reader.f32();

    uiValues.hud_target_points[1]( targetPoints );
    uiValues.hud_defenders_points[1]( defendersPoints );
    uiValues.hud_raiders_points[1]( raidersPoints );
    uiValues.hud_game_time[1]( elapsedTime );
    uiValues.hud_gamemode[1]( "Fairzone" ); // TODO: Replicate current gamemode
    uiValues.hud_team_size[1]( matchTeamSize );
    uiValues.hud_raiders_group[1]( raidingGroupId );
  } );
} );

new ConsoleFunctionCallback( ["setraiders"], [{ name: "groupId", type: "number" }] )
  .setDescription( "Sets the raiding group's ID" )
  .setCallback( ctx => 
  {
    const raidingGroupId = ctx.getArgument( "groupId", "number" );

    startNetworkPacket( { id: "match_setraiders", context: ctx.env.netctx, unreliable: false } );
    writeBufferU32( raidingGroupId.value );
    finishNetworkPacket();
  } );

new ConsoleFunctionCallback( ["teamsize"], [{ name: "amount", type: "number" }] )
  .setDescription( "Changes the amount of players allowed on each playing team" )
  .setCallback( ( ctx ) => 
  {
    const playersAmount = math.min( ctx.getArgument( "amount", "number" ).value, 255 );

    startNetworkPacket( { id: "match_teamamount", context: ctx.env.netctx, unreliable: false } );
    writeBufferU8( playersAmount );
    finishNetworkPacket();
  } );

new ConsoleFunctionCallback( ["start"], [{ name: "points", type: "number" }, { name: "raidersGroupId", type: "number" }] )
  .setDescription( "Starts the match with the given points and raiding group ID" )
  .setCallback( ( ctx ) => 
  {
    const pointsAmount = ctx.getArgument( "points", "number" ).value;

    startNetworkPacket( { id: "match_start", context: ctx.env.netctx, unreliable: false } );
    writeBufferU32( pointsAmount );
    finishNetworkPacket();
  } );