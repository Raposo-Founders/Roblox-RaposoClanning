import { Players, RunService } from "@rbxts/services";
import { ConsoleFunctionCallback } from "cmd/cvar";
import GameEnvironment from "core/GameEnvironment";
import { finishNetworkPacket, startNetworkPacket } from "core/Network";
import { clientSessionConnected, clientSessionDisconnected } from "defaultinsts";
import { defaultNetworkContext } from "gamevalues";
import { RaposoConsole } from "logging";
import { writeBufferBool, writeBufferString, writeBufferU8 } from "util/bufferwriter";
import Signal from "util/signal";

// # Constants & variables
enum ConnectionSteps {
  JoinRequest,
  Ready,
}

const SERVER_CONNECTION_ID = "serverconnection";

const CONNECTION_STEP_COOLDOWN = 3;
const DISCONNECT_LOCAL = new Signal();
const usersInConnectionProcess = new Set<Player["UserId"]>();

let canConnect = true;
let currentConnectionThread: thread | undefined;

// # Functions
export function clientConnectToServerSession()
{
  assert( RunService.IsClient(), "Function can only be called from the client." );
  assert( canConnect, "Function is on cooldown." );

  const defaultEnvironment = GameEnvironment.GetDefaultEnvironment();

  canConnect = false;
  currentConnectionThread = coroutine.running();

  print( "Requesting connection to server..." );
  
  startNetworkPacket( { id: SERVER_CONNECTION_ID, context: defaultNetworkContext, unreliable: false } );
  writeBufferU8( ConnectionSteps.JoinRequest );
  finishNetworkPacket();

  {
    const [connectionAllowed, negativeReason] = coroutine.yield() as LuaTuple<[boolean, string]>;
    if ( !connectionAllowed ) 
    {
      RaposoConsole.Warn( `Server has rejected connection: ${negativeReason}` );
      canConnect = true;
      return;
    }
  }

  defaultEnvironment.entity?.murderAllFuckers();

  task.wait( CONNECTION_STEP_COOLDOWN );

  startNetworkPacket( { id: SERVER_CONNECTION_ID, context: defaultNetworkContext, unreliable: false } );
  writeBufferU8( ConnectionSteps.Ready );
  finishNetworkPacket();

  {
    const [connectionAllowed, negativeReason] = coroutine.yield() as LuaTuple<[boolean, string]>;
    if ( !connectionAllowed ) 
    {
      RaposoConsole.Warn( `Server has rejected connection: ${negativeReason}` );
      canConnect = true;
      return;
    }
  }

  canConnect = true;
  currentConnectionThread = undefined;

  RaposoConsole.Warn( "CONNECTED!" );
  RaposoConsole.Warn( "CONNECTED!" );
  RaposoConsole.Warn( "CONNECTED!" );
  RaposoConsole.Warn( "CONNECTED!" );
  RaposoConsole.Warn( "CONNECTED!" );
  RaposoConsole.Warn( "CONNECTED!" );

  clientSessionConnected.Fire();
}

export function clientCreateLocalSession() 
{
  assert( RunService.IsClient(), "Function can only be called from the client." );

  const defaultEnvironment = GameEnvironment.GetDefaultEnvironment();
  const serverInst = new GameEnvironment( "local", true );

  serverInst.netctx.postRemote = false;
  const serverSessionConnection = serverInst.netctx.onNetworkPosted.Connect( packet => 
  {
    defaultEnvironment.netctx.Insert( Players.LocalPlayer, packet );
  } );

  defaultEnvironment.netctx.postRemote = false;
  const clientSessionConnection = defaultEnvironment.netctx.onNetworkPosted.Connect( packet => 
  {
    serverInst.netctx.Insert( undefined, packet );
  } );

  const connection = DISCONNECT_LOCAL.Connect( () => 
  {
    serverInst.Close();
  } );

  serverInst.BindToClose( () => 
  {
    serverSessionConnection.Disconnect();
    clientSessionConnection.Disconnect();

    defaultEnvironment.netctx.postRemote = true;

    connection.Disconnect();
  } );

  clientSessionConnected.Fire( "local" );

  serverInst.playerLeft.Connect( () => 
  {
    serverInst.Close();
  } );

  task.spawn( () => 
  {
    task.wait( CONNECTION_STEP_COOLDOWN );
    serverInst.RegisterPlayer( Players.LocalPlayer );
  } );
}

// # Execution
new ConsoleFunctionCallback( ["disconnect", "dc"], [] )
  .setDescription( "Disconnects from the current session." )
  .setCallback( ( ctx ) => 
  {
    ctx.Reply( "Disconnecting from session..." );

    DISCONNECT_LOCAL.Fire();

    startNetworkPacket( { id: "disconnect_request", context: defaultNetworkContext, unreliable: false } );
    writeBufferString( "sessionIds" );
    finishNetworkPacket();
  } );

new ConsoleFunctionCallback( ["connect"], [{ name: "id", type: "string" }] )
  .setDescription( "Attempts to connect to a multiplayer session." )
  .setCallback( ( ctx ) => clientConnectToServerSession() );

new ConsoleFunctionCallback( ["connectlocal"], [{ name: "id", type: "string" }] )
  .setDescription( "Attempts to connect to a multiplayer session." )
  .setCallback( ( ctx ) => clientCreateLocalSession() );

// Connection requests
if ( RunService.IsServer() )
  defaultNetworkContext.ListenServer( SERVER_CONNECTION_ID, ( sender, reader ) => 
  {
    if ( !sender ) return;

    const connectionStep = reader.u8();
    const environment = GameEnvironment.GetDefaultEnvironment();

    const cancelStep = ( reason: string ) =>
    {
      usersInConnectionProcess.delete( sender.UserId );

      startNetworkPacket( { id: SERVER_CONNECTION_ID, context: defaultNetworkContext, players: [sender], unreliable: false } );
      writeBufferBool( false );
      writeBufferString( reason );
      finishNetworkPacket();
    };

    const confirmStep = () =>
    {
      startNetworkPacket( { id: SERVER_CONNECTION_ID, context: defaultNetworkContext, players: [sender], unreliable: false } );
      writeBufferBool( true );
      writeBufferString( "Y E S." );
      finishNetworkPacket();
    };

    if ( environment.blockedPlayers.has( sender.UserId ) )
    {
      cancelStep( `User is blocked from the session: ${environment.blockedPlayers.get( sender.UserId )}` );
      return;
    }

    RaposoConsole.Info( "CONNECTION STEP:", ConnectionSteps[connectionStep] );
    RaposoConsole.Info( "USER ON PROCESS:", usersInConnectionProcess.has( sender.UserId ) );

    if ( connectionStep === ConnectionSteps.JoinRequest ) 
    {
      if ( usersInConnectionProcess.has( sender.UserId ) )
      {
        cancelStep( "User is already at a connection step." );
        return;
      }

      usersInConnectionProcess.add( sender.UserId );
      RaposoConsole.Info( "USER ADDED TO PROCESS!", usersInConnectionProcess.has( sender.UserId ) );

      confirmStep();
      return;
    }

    if ( connectionStep === ConnectionSteps.Ready )
    {

      if ( !usersInConnectionProcess.has( sender.UserId ) ) 
      {
        cancelStep( "User did not start a connection process." );
        return;
      }

      usersInConnectionProcess.delete( sender.UserId );
      environment.RegisterPlayer( sender );
      confirmStep();
      return;
    }
  } );

if ( RunService.IsClient() )
  defaultNetworkContext.ListenClient( SERVER_CONNECTION_ID, ( reader ) => 
  {
    const isAllowed = reader.bool();
    const rejectReason = reader.string();

    RaposoConsole.Info( "Server connection reply received:", currentConnectionThread, isAllowed, rejectReason );

    if ( !currentConnectionThread )
      return;


    coroutine.resume( currentConnectionThread, isAllowed, rejectReason );
  } );

// Handling disconnections
if ( RunService.IsClient() )
  defaultNetworkContext.ListenClient( "session_disconnected", reader => 
  {
    const reason = reader.string();

    clientSessionDisconnected.Fire( reason );

    RaposoConsole.Warn( "Disconnected from session:", reason );

    GameEnvironment.GetDefaultEnvironment().entity.murderAllFuckers();
  } );

if ( RunService.IsServer() )
  defaultNetworkContext.ListenServer( "disconnect_request", sender => 
  {
    if ( !sender ) return;

    const sessionList = GameEnvironment.GetServersFromPlayer( sender );

    for ( const session of sessionList )
      session.RemovePlayer( sender, "Disconnected by user." );
  } );
