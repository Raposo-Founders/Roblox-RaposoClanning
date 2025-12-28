import { defendersCommandCheck } from "cmd/cmdutils";
import { ConsoleFunctionCallback } from "cmd/cvar";
import GameEnvironment from "core/GameEnvironment";
import { finishNetworkPacket, startNetworkPacket } from "core/Network";
import PlayerEntity from "entities/PlayerEntity";
import { gameValues } from "gamevalues";
import ChatSystem from "systems/ChatSystem";
import { colorTable } from "UI/values";
import { startBufferCreation, writeBufferString, writeBufferU16 } from "util/bufferwriter";

// # Constants & variables
const CMD_INDEX_NAME = "cmd_kick";

// # Bindings & execution

GameEnvironment.BindCallbackToEnvironmentCreation( env => 
{
  if ( !env.isServer ) return;

  env.netctx.ListenServer( CMD_INDEX_NAME, ( sender, reader ) => 
  {
    if ( !sender || !sender.GetAttribute( gameValues.modattr ) ) return;

    const entityId = reader.u16();
    const reason = reader.string();

    // TODO: Properly make this command only available for admins
    if ( !sender.GetAttribute( gameValues.adminattr ) ) 
    {
      ChatSystem.sendSystemMessage( "Players cannot be kicked by temporary moderators." );
      return;
    }

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

    // Send kick message to all players
    ChatSystem.sendSystemMessage( `Kicked ${targetEntity.GetUserFromController()} (${targetEntity.id}): ${reason}` );

    {
      const targetEntityController = targetEntity.GetUserFromController();

      if ( targetEntityController )
        env.RemovePlayer( targetEntityController, `Kicked by administrator.\n\n${sender.Name}: ${reason}.` );
      else
        env.entity.killThisFucker( targetEntity );
    }
  } );
} ); 

new ConsoleFunctionCallback( ["kick"], [{ name: "player", type: "player" }, { name: "reason", type: "strings" }] )
  .setDescription( "Kicks a player from the current session" )
  .setCallback( ( ctx ) => 
  {
    const targetPlayers = ctx.getArgument( "player", "player" ).value;
    const reason = ctx.getArgument( "reason", "strings" ).value;

    if ( targetPlayers.size() <= 0 ) 
    {
      ChatSystem.sendSystemMessage( `<b><font color="${colorTable.errorneousColor}">Argument #1 unknown player.</font></b>` );
      return;
    }

    for ( const ent of targetPlayers ) 
    {
      startNetworkPacket( { id: CMD_INDEX_NAME, context: ctx.env.netctx, unreliable: false } );
      writeBufferU16( ent.id );
      writeBufferString( reason.join( " " ) );
      finishNetworkPacket();
    }
  } );