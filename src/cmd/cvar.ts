import { Players } from "@rbxts/services";
import GameEnvironment from "core/GameEnvironment";
import PlayerEntity from "entities/PlayerEntity";
import { PlayerTeam } from "gamevalues";
import Signal from "util/signal";

// # Types
interface CommandContext {
  Reply: ( message: string ) => void;
  Warn: ( message: string ) => void;
  Error: ( message: string ) => void;

  getArgument: <T extends CONFUNC_TYPES>( name: string, expectedType: T ) => CFunctionArgument<T>;

  env: GameEnvironment,
}

type CONFUNC_TYPES = "string" | "strings" | "number" | "team" | "player";
type CONFUNC_TYPES_Converted = string | string[] | number | keyof typeof PlayerTeam | PlayerEntity[];

type ___ConvertFuncType<T extends CONFUNC_TYPES> =
  T extends "string" ? string :
  T extends "number" ? number :
  T extends "strings" ? string[] :
  T extends "team" ? keyof typeof PlayerTeam :
  T extends "player" ? PlayerEntity[] : never;

interface CFunctionArgumentDefinition<T extends CONFUNC_TYPES> {
  name: string;
  description?: string;
  type: T;
}

interface CFunctionArgument<T extends CONFUNC_TYPES> {
  name: string;
  value: ___ConvertFuncType<T>;
}

// # Constants & variables
export enum cvarFlags {
  debug, // Only usable on studio
  hidden,
  readonly,
  server, // Can only be used from the server or by developers
}

export const CFUNC_REPLY_POST = new Signal<[level: "warn" | "error" | "info", content: string]>();

export const createdCVars = new Map<string, CCVar<unknown>>();

// # Functions
function formatString( text: string ) 
{
  return text.gsub( "^%s+", "" )[0].gsub( "%s+$", "" )[0];
}

function getTeamFromString( value: string ) 
{
  let targetTeamId = PlayerTeam.Spectators;

  if ( ( "defenders" ).match( ( value ).lower() )[0] ) targetTeamId = PlayerTeam.Defenders;
  if ( ( "raiders" ).match( ( value ).lower() )[0] ) targetTeamId = PlayerTeam.Raiders;
  if ( ( "spectators" ).match( ( value ).lower() )[0] ) targetTeamId = PlayerTeam.Spectators;

  return PlayerTeam[targetTeamId];
}

function getPlayersFromString( value: string, caller: Player, env: GameEnvironment ) 
{
  const foundPlayers: PlayerEntity[] = [];

  // Searching by team
  if ( value.sub( 0, 1 ) === "%" ) 
  {
    const targetTeam = getTeamFromString( value.gsub( "%%", "" )[0] );

    for ( const ent of env.entity.getEntitiesThatIsA( "PlayerEntity" ) ) 
    {
      if ( PlayerTeam[ent.team] !== targetTeam ) continue;
      foundPlayers.push( ent );
    }

    return foundPlayers;
  }

  // Referencing themselves
  if ( value === "me" ) 
  {
    for ( const ent of env.entity.getEntitiesThatIsA( "PlayerEntity" ) ) 
    {
      if ( ent.GetUserFromController() !== caller ) continue;
      foundPlayers.push( ent );
      break;
    }

    return foundPlayers;
  }

  // Searching by usernames
  {
    const usernamesSplit = value.split( "," );
    const formattedUsernamesSplit: string[] = [];

    for ( const username of usernamesSplit )
      formattedUsernamesSplit.push( formatString( username.lower() ) );

    for ( const ent of env.entity.getEntitiesThatIsA( "PlayerEntity" ) ) 
    {
      const controller = ent.GetUserFromController();
      const name = ( controller ? controller.Name : ent.name ).lower();

      for ( const username of formattedUsernamesSplit ) 
      {
        if ( name.sub( 0, username.size() ) !== username ) continue;
        foundPlayers.push( ent );
        break;
      }
    }
  }


  return foundPlayers;
}

export function convertConsoleArgumentType( argumenttype: CONFUNC_TYPES, values: string[], caller: Player, env: GameEnvironment ): CONFUNC_TYPES_Converted 
{
  if ( argumenttype === "string" )
    return tostring( values.shift() );

  if ( argumenttype === "number" )
    return tonumber( tostring( values.shift() ) ) || 0;

  if ( argumenttype === "team" )
    return getTeamFromString( tostring( values.shift() ) );

  if ( argumenttype === "player" )
    return getPlayersFromString( tostring( values.shift() ), caller, env );

  // Returning the "values" table itself
  const clonedObj = table.clone( values );
  values.clear();
  return clonedObj;
}

// # Classes
export class CCVar<T> 
{
  private currentValue: T;

  readonly type: "string" | "number";

  constructor( readonly name: string, private defaultValue: T, readonly flags: cvarFlags[] ) 
  {
    assert( !createdCVars.has( name ), `Duplicate CVar ${name}.` );
    assert( typeIs( defaultValue, "string" ) || typeIs( defaultValue, "number" ), `Only strings and numbers are supported on CVars, got ${typeOf( defaultValue )}.` );

    this.currentValue = defaultValue;
    this.type = typeIs( defaultValue, "string" ) ? "string" : "number";

    table.freeze( flags );
    createdCVars.set( name, this );
  }

  Set( newValue: T ) 
  {
    if ( this.flags.includes( cvarFlags.readonly ) ) return;
    this.currentValue = newValue;
  }

  Get() 
  {
    return this.currentValue;
  }

  Reset() 
  {
    this.currentValue = this.defaultValue;
  }
}

export class ConsoleFunctionCallback 
{
  static list = new Array<ConsoleFunctionCallback>();

  private callback: Callback | undefined;
  description = "";

  constructor(
    public readonly names: string[],
    public readonly args: CFunctionArgumentDefinition<CONFUNC_TYPES>[],
  ) 
  {
    ConsoleFunctionCallback.list.push( this );
  }

  setCallback( callback: ( ctx: CommandContext ) => void ) 
  {
    this.callback = callback;

    return this;
  }

  setDescription( description = "" ) 
  {
    this.description = description;
    return this;
  }

  execute( args: string[], env: GameEnvironment ) 
  {
    if ( !this.callback ) 
    {
      print( `No callback has been set for command ${this.names[0]}, ignoring call...` ); // This print message is an special occasion (circular dependency)
      return;
    }

    const convertedArguments = new Map<string, CFunctionArgument<never>>();

    for ( let i = 0; i < this.args.size(); i++ ) 
    {
      const element = this.args[i];
      convertedArguments.set( element.name, { name: element.name, value: convertConsoleArgumentType( element.type, args, Players.LocalPlayer, env ) as never } );
    }

    const contextEnvironment: CommandContext = {
      Reply: ( message ) => 
      {
        CFUNC_REPLY_POST.Fire( "info", `<${this.names[0]}> ${message}` );
      },
      Warn: ( message ) => 
      {
        CFUNC_REPLY_POST.Fire( "warn", `<${this.names[0]}> ${message}` );
      },
      Error: ( message ) => 
      {
        CFUNC_REPLY_POST.Fire( "error", `<${this.names[0]}> ${message}` );
      },

      getArgument: ( name, expectedType ) => 
      {
        const target = convertedArguments.get( name ) as CFunctionArgument<typeof expectedType> | undefined;
        if ( !target ) throw `Invalid command argument: ${name}`;

        return target;
      },

      env,
    };

    this.callback( contextEnvironment );
  }
}
