import { ConsoleFunctionCallback } from "cmd/cvar";
import GameEnvironment from "core/GameEnvironment";
import { NetworkPacket } from "core/NetworkModel";
import { gameValues } from "gamevalues";
import ChatSystem from "systems/ChatSystem";
import { writeBufferString } from "util/bufferwriter";

// # Constants & variables
const CMD_INDEX_NAME = "cmd_joke";

// # Bindings & execution

GameEnvironment.BindCallbackToEnvironmentCreation( env => 
{
  if ( !env.isServer ) return;

  env.network.ListenPacket( CMD_INDEX_NAME, ( sender, reader ) => 
  {
    if ( !sender || !sender.GetAttribute( gameValues.modattr ) ) return;

    ChatSystem.sendSystemMessage( `Nice try ${sender.Name}, but this is not Kohl's admin.` );
  } );
} ); 

new ConsoleFunctionCallback( ["fly", "ff", "forcefield", "invisible", "invis", "god", "to", "bring"], [] )
  .setCallback( ( ctx ) => 
  {
    const packet = new NetworkPacket( CMD_INDEX_NAME );
    writeBufferString( "joke" );
    ctx.env.network.SendPacket( packet );
  } );