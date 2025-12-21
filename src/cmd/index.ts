import { RunService, TextChatService } from "@rbxts/services";
import { colorTable } from "UI/values";
import GameEnvironment from "core/GameEnvironment";
import { gameValues } from "gamevalues";
import { RaposoConsole } from "logging";
import Signal from "util/signal";
import { CFUNC_REPLY_POST, ConsoleFunctionCallback, createdCVars, cvarFlags } from "./cvar";

// # Constants & variables
export const COMMAND_EXECUTED = new Signal<[name: string, args: string[]]>();

// # Functions
function FormatCommandString( text: string ) 
{
  return text.gsub( "^%s+", "" )[0].gsub( "%s+$", "" )[0];
}

export function InitializeCommands() 
{
  for ( const inst of script.WaitForChild( "commands" ).GetChildren() )
    if ( inst.IsA( "ModuleScript" ) )
      task.spawn( require, inst );
}

export async function ExecuteCommand( content: string, env: GameEnvironment ) 
{
  assert( RunService.IsClient(), "Function can only be called from the client." );

  const args = FormatCommandString( content ).split( " " );
  if ( args.size() <= 0 ) return;

  const name = args.shift() ?? "";
  const targetVariable = createdCVars.get( name );
  let targetCallback: ConsoleFunctionCallback | undefined;

  for ( const consoleFunc of ConsoleFunctionCallback.list ) 
  {
    if ( !consoleFunc.names.includes( name ) ) continue;
    targetCallback = consoleFunc;
    break;
  }

  if ( targetVariable ) 
  {
    const value1 = args.shift();
    const numValue1 = tonumber( value1 );

    if ( !value1 ) 
    {
      print( `${targetVariable.name}: ${tostring( targetVariable.Get() )} [${targetVariable.type}]` );
    }

    if ( targetVariable.flags.includes( cvarFlags.readonly ) ) 
    {
      RaposoConsole.Error( `CVar ${name} is read only.` );
      return;
    }

    if ( targetVariable.type === "number" ) 
    {
      if ( !numValue1 ) 
      {
        RaposoConsole.Error( `Value must be a number, got string.` );
        return;
      }
      targetVariable.Set( numValue1 );
    }

    if ( targetVariable.type === "string" )
      targetVariable.Set( value1 );

    print( `${name} set to ${value1}` );
    return;
  }

  if ( targetCallback ) 
  {
    COMMAND_EXECUTED.Fire( targetCallback.names[0], args );
 
    const [success, errorMessage] = pcall( () => targetCallback.execute( args, env ) );
    if ( !success )
      RaposoConsole.Error( `Command error: <b><font color="${colorTable.errorneousColor}">${errorMessage}</font></b>` );
      // ChatSystem.sendSystemMessage(`Command error: <b><font color="${colorTable.errorneousColor}">${errorMessage}</font></b>`);

    return;
  }

  RaposoConsole.Warn( `Unknown command "${content}".` );
}

// # Bindings & misc
CFUNC_REPLY_POST.Connect( ( level, message ) => 
{
  if ( level === "info" ) RaposoConsole.Info( message );
  if ( level === "warn" ) RaposoConsole.Warn( message );
  if ( level === "error" ) RaposoConsole.Error( message );
} );

for ( const inst of script.WaitForChild( "commands" ).GetChildren() ) 
{
  if ( inst.IsA( "ModuleScript" ) )
    task.spawn( require, inst );
}

if ( RunService.IsClient() )
  TextChatService.SendingMessage.Connect( msg => 
  {
    if ( msg.Text.sub( 1, 1 ) === gameValues.cmdprefix ) 
    {
      const split = msg.Text.split( gameValues.cmdprefix );
    
      for ( const cmd of split ) 
      {
        if ( cmd === "" ) continue;
    
        ExecuteCommand( cmd, GameEnvironment.runningInstances.get( "default" )! ).expect();
        task.wait();
        task.wait(); // Double trouble :)
      }
    }
  } );
