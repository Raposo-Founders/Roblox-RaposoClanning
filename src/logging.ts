import { HttpService, RunService } from "@rbxts/services";
import { t } from "@rbxts/t";
import Signal from "util/signal";


// # Types
export type ConsoleOutputType = "warn" | "error" | "info";

// # Constants
export const CONSOLE_OUT = new Signal<[Level: ConsoleOutputType, message: string]>();

// # Functions
function concatString( content: unknown[] ) 
{
  let finalString = "";

  for ( const element of content )
    if ( t.table( element ) )
      finalString += `${HttpService.JSONEncode( element )} `;
    else
      finalString += `${tostring( element )} `;

  return finalString;
}

// # Namespace
export namespace RaposoConsole {
  export function Info( ...content: unknown[] ) 
  {
    CONSOLE_OUT.Fire( "info", concatString( content ) );

    if ( RunService.IsStudio() )
      print( ...content );
  }
  export function Warn( ...content: unknown[] ) 
  {
    CONSOLE_OUT.Fire( "warn", concatString( content ) );

    if ( RunService.IsStudio() || RunService.IsServer() )
      warn( ...content );
  }
  export function Error( ...content: unknown[] ) 
  {
    CONSOLE_OUT.Fire( "error", concatString( content ) );

    if ( RunService.IsStudio() || RunService.IsServer() )
      warn( ...content );
  }
}
