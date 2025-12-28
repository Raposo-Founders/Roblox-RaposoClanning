import { defendersCommandCheck } from "cmd/cmdutils";
import { ConsoleFunctionCallback } from "cmd/cvar";
import GameEnvironment from "core/GameEnvironment";
import { finishNetworkPacket, startNetworkPacket } from "core/Network";
import PlayerEntity from "entities/PlayerEntity";
import { gameValues } from "gamevalues";
import ChatSystem from "systems/ChatSystem";
import { colorTable } from "UI/values";
import { writeBufferU16 } from "util/bufferwriter";

// # Constants & variables
const CMD_INDEX_NAME = "cmd_spawn";

// # Bindings & execution

GameEnvironment.BindCallbackToEnvironmentCreation( env => 
{
  if ( !env.isServer ) return;

  env.netctx.ListenServer( CMD_INDEX_NAME, ( sender, reader ) => 
  {
    if ( !sender || !sender.GetAttribute( gameValues.modattr ) ) return;

    const entityId = reader.u16();

    let callerEntity: PlayerEntity | undefined;
    for ( const ent of env.entity.getEntitiesThatIsA( "PlayerEntity" ) ) 
    {
      if ( ent.GetUserFromController() !== sender ) continue;
      callerEntity = ent;
      break;
    }
    if ( !callerEntity ) return;

    const targetEntity = env.entity.entities[entityId];
    if ( !targetEntity || !targetEntity.IsA( "PlayerEntity" ) ) 
    {
      ChatSystem.sendSystemMessage( `Invalid player entity ${entityId}`, [sender] );
      return;
    }
    
    if ( !defendersCommandCheck( callerEntity, targetEntity ) ) 
    {
      ChatSystem.sendSystemMessage( gameValues.cmdtempmoddefendersdeny );
      return;
    }

    targetEntity.Spawn();

    ChatSystem.sendSystemMessage( `Spawned ${targetEntity.GetUserFromController()} (${targetEntity.id}).` );
  } );
} ); 

new ConsoleFunctionCallback( ["spawn"], [{ name: "player", type: "player" }] )
  .setDescription( "Respawns a player(s)" )
  .setCallback( ( ctx ) => 
  {
    const targetPlayers = ctx.getArgument( "player", "player" ).value;

    if ( targetPlayers.size() <= 0 ) 
    {
      ChatSystem.sendSystemMessage( `<b><font color="${colorTable.errorneousColor}">Argument #1 unknown player.</font></b>` );
      return;
    }

    for ( const ent of targetPlayers ) 
    {
      startNetworkPacket( { id: CMD_INDEX_NAME, context: ctx.env.netctx, unreliable: false } );
      writeBufferU16( ent.id );
      finishNetworkPacket();
    }
  } );