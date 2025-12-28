import { Players, RunService } from "@rbxts/services";
import { t } from "@rbxts/t";
import { RaposoConsole } from "logging";
import { BufferReader } from "util/bufferreader";
import { finalizeBufferCreation, startBufferCreation, writeBufferString } from "util/bufferwriter";
import Signal from "util/signal";
import { ReplicatedInstance } from "util/utilfuncs";

// # Interfaces & types
interface NetworkPost_I {
  id: string;
  data: buffer;
  ignore?: Player[];
  players?: Player[];
  unreliable: boolean;
  context: NetworkContext,
}

// # Constants
const NETWORK_PORT_SEPARATOR = "::";

const remoteEvent = ReplicatedInstance( workspace, "RemoteEvent", "RemoteEvent" );
const unreliableRemoteEvent = ReplicatedInstance( workspace, "UnreliableRemoteEvent", "UnreliableRemoteEvent" );

export const mappedThreadPackets = new Map<thread, ExcludeMembers<NetworkPost_I, buffer>>;

// # Functions
export function startNetworkPacket( info: ExcludeMembers<NetworkPost_I, buffer> )
{
  mappedThreadPackets.set( coroutine.running(), info );

  startBufferCreation();
  writeBufferString( `${info.context.port}${NETWORK_PORT_SEPARATOR}${info.id}` );
}

export function finishNetworkPacket( )
{
  const packetInfo = mappedThreadPackets.get( coroutine.running() );
  assert( packetInfo, "A network task has not been started in the current thread." );

  if ( !packetInfo.context.isServer && RunService.IsServer() ) throw `Attempted to send a client-server packet from the server side instance.`;

  const buffer = finalizeBufferCreation();
  const fullData: Required<NetworkPost_I> = {
    players: Players.GetPlayers(),
    ignore: [],
    ...packetInfo,
    data: buffer,
  };

  if ( fullData.context.isServer )
    fullData.players = fullData.players.filter( val => !fullData.ignore.includes( val ) );

  mappedThreadPackets.delete( coroutine.running() );
  fullData.context.onNetworkPosted.Fire( fullData );

  if ( fullData.context.postRemote )
    if ( fullData.context.isServer )
      for ( const user of fullData.players ) 
      {
        if ( !user.IsDescendantOf( Players ) ) continue;
        if ( !fullData.context.ShouldSendPlayer( user ) ) continue;
        if ( fullData.unreliable )
          unreliableRemoteEvent.FireClient( user, fullData.data );
        else
          remoteEvent.FireClient( user, fullData.data );
      }
    else
      if ( fullData.unreliable )
        unreliableRemoteEvent.FireServer( fullData.data );
      else
        remoteEvent.FireServer( fullData.data );
}

// Class
export class NetworkContext 
{
  postRemote = true;
  isServer = RunService.IsServer();
  readonly onNetworkPosted = new Signal<[info: NetworkPost_I]>();

  private serverListeners = new Map<string, Callback>();
  private clientListeners = new Map<string, Callback>();

  private connections: RBXScriptConnection[] = [];

  constructor( public readonly port: string, public readonly ShouldSendPlayer: ( user: Player ) => boolean ) 
  {
    if ( RunService.IsClient() ) 
    {
      remoteEvent.OnClientEvent.Connect( data => this.Insert( undefined, data ) );
      unreliableRemoteEvent.OnClientEvent.Connect( data => this.Insert( undefined, data ) );
    }
    else 
    {
      remoteEvent.OnServerEvent.Connect( ( sender, data ) => this.Insert( sender, data ) );
      unreliableRemoteEvent.OnServerEvent.Connect( ( sender, data ) => this.Insert( sender, data ) );
    }
  }

  Destroy() 
  {
    this.serverListeners.clear();
    this.clientListeners.clear();
    this.onNetworkPosted.Clear();

    for ( const connection of this.connections )
      connection.Disconnect();
    this.connections.clear();
  }

  ListenServer( id: string, callback: ( user: Player, data: ReturnType<typeof BufferReader> ) => void | buffer ) 
  {
    this.serverListeners.set( id, callback );
  }

  ListenClient( id: string, callback: ( data: ReturnType<typeof BufferReader> ) => void )
  {
    this.clientListeners.set( id, callback );
  }

  Insert( sender: Player | undefined, data: unknown )
  {
    if ( this.isServer && !t.instanceIsA( "Player" )( sender ) ) 
    {
      RaposoConsole.Error( `Received server packets must include a sender. ${typeOf( sender )} ${sender}` );
      return;
    }

    if ( !t.buffer( data ) ) 
    {
      RaposoConsole.Error( `Received data packet must be a buffer. ${typeOf( buffer )} ${buffer}` );
      return;
    }

    const reader = BufferReader( data );
    const packagedId = reader.string();

    // RaposoConsole.Info( "Received package!", sender, packagedId, data );

    // Check id, to match with this current context's port
    const splitIdString = packagedId.split( NETWORK_PORT_SEPARATOR );
    const portId = splitIdString[0];
    const protocolId = splitIdString[1];

    if ( portId !== this.port ) return;

    // RaposoConsole.Info( "Package data info:", protocolId, data );
    // RaposoConsole.Info( "Has Client:", this.clientListeners.has( protocolId ) );
    // RaposoConsole.Info( "Has Server:", this.serverListeners.has( protocolId ) );
    // RaposoConsole.Info( "===================================================" );

    if ( this.isServer )
    {
      if ( !this.serverListeners.has( protocolId ) ) RaposoConsole.Warn( `Unmapped network id ${protocolId} from user ${sender?.UserId} (@${sender?.Name})` );
      this.serverListeners.get( protocolId )?.( sender, reader );
    }

    if ( !this.isServer )
    {
      if ( !this.clientListeners.has( protocolId ) ) RaposoConsole.Warn( `Unmapped network id ${protocolId} from server.` );
      this.clientListeners.get( protocolId )?.( reader );
    }
  }
}

// # Bindings & misc
