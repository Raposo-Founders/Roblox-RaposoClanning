import { Players } from "@rbxts/services";
import { ConsoleFunctionCallback } from "cmd/cvar";
import GameEnvironment from "core/GameEnvironment";
import { finishNetworkPacket, startNetworkPacket } from "core/Network";
import PlayerEntity from "entities/PlayerEntity";
import { PlayerTeam } from "gamevalues";
import { gameValues } from "gamevalues";
import ChatSystem from "systems/ChatSystem";
import { writeBufferString } from "util/bufferwriter";

// # Constants & variables
const CMD_INDEX_NAME = "cmd_addbot";

// # Functions

// # Bindings & misc
new ConsoleFunctionCallback( ["addbot"], [{ name: "name", type: "string" }] )
  .setCallback( ctx => 
  {
    const entityName = ctx.getArgument( "name", "string" );

    startNetworkPacket( { id: CMD_INDEX_NAME, context: ctx.env.netctx, players: [], ignore: [], unreliable: false } );
    writeBufferString( entityName.value );
    finishNetworkPacket();
  } );

GameEnvironment.BindCallbackToEnvironmentCreation( env => 
{
  if ( !env.isServer ) return;

  env.netctx.ListenServer( CMD_INDEX_NAME, ( sender, reader ) => 
  {
    if ( !sender ) return;

    const entityName = reader.string();

    const sessionList = GameEnvironment.GetServersFromPlayer( sender );

    for ( const session of sessionList ) 
    {
      let callerEntity: PlayerEntity | undefined;
      for ( const ent of env.entity.getEntitiesThatIsA( "PlayerEntity" ) ) 
      {
        if ( ent.GetUserFromController() !== sender ) continue;
        callerEntity = ent;
        break;
      }
      if ( !callerEntity ) continue;

      session.entity.CreateEntityByName( "SwordPlayerEntity" )
        .andThen( ent => 
        {
          ent.SetName( `bot_${entityName}` );
          ent.appearanceId = sender.UserId;
          ent.team = PlayerTeam.Raiders;
          ent.networkOwner = tostring( sender!.GetAttribute( gameValues.usersessionid ) );

          session.lifecycle.BindTickrate( ( ctx, val ) => 
          {
            if ( ent.team === PlayerTeam.Spectators || ent.health <= 0 ) return;
            if ( !ent.isEquipped ) return;

            ent.AttackRequest();
          } );

          ent.died.Connect( () => 
          {
            task.wait( Players.RespawnTime );
            ent.Spawn();
          } );

          ent.Spawn();

          ChatSystem.sendSystemMessage( `Spawned bot ${ent.id}.` );
        } );
    }
  } );
} ); 