import Object from "@rbxts/object-utils";
import { Players, RunService } from "@rbxts/services";
import { t } from "@rbxts/t";
import { BufferReader } from "util/bufferreader";
import { finalizeBufferCreation, startBufferCreation, writeBufferString } from "util/bufferwriter";
import Signal from "util/signal";
import { ReplicatedInstance } from "util/utilfuncs";

// # Types
interface IncomingPacketInfo {
  id: string;
  sender: Player | undefined;
  reader: ReturnType<typeof BufferReader>;
}

type NetworkListenerListener = ( sender: Player | undefined, reader: ReturnType<typeof BufferReader> ) => void;

// # Constants
const dataStreamingEvent = ReplicatedInstance( workspace, "dataStreaming", "RemoteEvent" );
const unreliableDataStreamingEvent = ReplicatedInstance( workspace, "unreliableDataStreaming", "UnreliableRemoteEvent" );

const standardEvent = ReplicatedInstance( workspace, "STANDARD", "RemoteEvent" );

// # Functions
export function SendStandardMessage( id: string, obj: object, recipient: Player | undefined ) 
{
  if ( RunService.IsServer() && !t.instanceIsA( "Player" )( recipient ) ) throw "Server messages must contain a player recipient!";
  if ( !t.table( obj ) ) throw "Message object must be a table.";

  if ( RunService.IsClient() )
    standardEvent.FireServer( id, obj );
  else
    standardEvent.FireClient( recipient!, id, obj, recipient );
}

export function ListenStandardMessage( id: string, callback: ( sender: Player | undefined, obj: Record<string, unknown> ) => void ) 
{
  if ( RunService.IsClient() )
    standardEvent.OnClientEvent.Connect( ( incomingId, obj ) => 
    {
      if ( tostring( incomingId ) !== id ) return;
      if ( !t.table( obj ) ) return;

      callback( undefined, obj as Record<string, unknown> );
    } );

  if ( RunService.IsServer() )
    standardEvent.OnServerEvent.Connect( ( sender, incomingId, obj ) => 
    {
      if ( tostring( incomingId ) !== id ) return;
      if ( !t.table( obj ) ) return;

      callback( sender, obj as Record<string, unknown> );
    } );
}

// # Class
export class NetworkPacket 
{
  players = Players.GetPlayers();
  ignore: Player[] = [];
  reliable = true;

  constructor( id: string, ) 
  {
    startBufferCreation();
    writeBufferString( id );
  }
}

export class NetworkDataStreamer 
{
  static instances: NetworkDataStreamer[] = [];

  private inboundPackets: IncomingPacketInfo[] = [];
  private listeners = new Map<string, NetworkListenerListener>();

  remoteEnabled = true;
  readonly packetPosted = new Signal<[packet: buffer]>();

  shouldDeliverPacket: ( ( sender: Player ) => boolean ) | undefined;

  constructor() 
  {
    if ( RunService.IsServer() ) 
    {
      dataStreamingEvent.OnServerEvent.Connect( ( sender, packet ) => 
      {
        if ( !this.remoteEnabled ) return;
        if ( !this.shouldDeliverPacket?.( sender ) ) return;
        if ( !t.buffer( packet ) ) return;

        this.InsertPacket( packet, sender );
      } );
      unreliableDataStreamingEvent.OnServerEvent.Connect( ( sender, packet ) => 
      {
        if ( !this.remoteEnabled ) return;
        if ( !this.shouldDeliverPacket?.( sender ) ) return;
        if ( !t.buffer( packet ) ) return;

        this.InsertPacket( packet, sender );
      } );
    }

    if ( RunService.IsClient() ) 
    {
      dataStreamingEvent.OnClientEvent.Connect( ( packet ) => 
      {
        if ( !this.remoteEnabled ) return;
        if ( !t.buffer( packet ) ) return;

        this.InsertPacket( packet, undefined );
      } );
      unreliableDataStreamingEvent.OnClientEvent.Connect( ( packet ) => 
      {
        if ( !this.remoteEnabled ) return;
        if ( !t.buffer( packet ) ) return;

        this.InsertPacket( packet, undefined );
      } );
    }

    NetworkDataStreamer.instances.push( this );
  }

  ListenPacket( id: string, callback: NetworkListenerListener ) 
  {
    this.listeners.set( id, callback );
  }

  InsertPacket( packet: buffer, sender: Player | undefined ) 
  {
    const reader = BufferReader( packet );
    const id = reader.string();

    this.inboundPackets.push( { id, sender, reader } );
  }

  SendPacket( netPacket: NetworkPacket ) 
  {
    const bfr = finalizeBufferCreation();

    if ( RunService.IsServer() && this.remoteEnabled )
      for ( const user of netPacket.players ) 
      {
        if ( !this.shouldDeliverPacket?.( user ) ) continue;

        if ( netPacket.reliable )
          dataStreamingEvent.FireClient( user, bfr );
        else
          unreliableDataStreamingEvent.FireClient( user, bfr );
      }

    if ( RunService.IsClient() && this.remoteEnabled )
      if ( netPacket.reliable )
        dataStreamingEvent.FireServer( bfr );
      else
        unreliableDataStreamingEvent.FireServer( bfr );

    this.packetPosted.Fire( bfr );
  }

  ProcessReceivedPackets() 
  {
    const list = Object.copy( this.inboundPackets );

    this.inboundPackets.clear();

    for ( const element of list ) 
    {
      const callback = this.listeners.get( element.id );
      if ( callback )
        task.spawn( callback, element.sender, element.reader );
    }

    list.clear();
  }

  Destroy() 
  {
    this.listeners.clear();
    this.packetPosted.Clear();
    this.shouldDeliverPacket = undefined;

    NetworkDataStreamer.instances.remove( NetworkDataStreamer.instances.findIndex( val => val === this ) );

    table.clear( this );
  }
}