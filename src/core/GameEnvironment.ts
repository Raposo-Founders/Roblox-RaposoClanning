import { CollectionService, Players, ReplicatedStorage, RunService } from "@rbxts/services";
import { t } from "@rbxts/t";
import { LifecycleContainer } from "core/GameLifecycle";
import { EntityCompareSnapshotVersions, GetLatestClientAknowledgedSnapshot, GetSnapshotsFromEnvironmentId, ReadBufferEntityChanges, StoreEnvironmentSnapshot, WriteEntityBufferChanges } from "core/Snapshot";
import BaseEntity from "entities/BaseEntity";
import { RaposoConsole } from "logging";
import { UTIL_MATH_ConvertCFrameToVector3 } from "util/math";
import { EntityManager } from "../entities";
import { defaultNetworkContext, Gamemode, gameValues } from "../gamevalues";
import { writeBufferString } from "../util/bufferwriter";
import Signal from "../util/signal";
import { RandomString, ReplicatedInstance } from "../util/utilfuncs";
import { finishNetworkPacket, NetworkContext, startNetworkPacket } from "./Network";

// # Types
type T_EnvironmentBinding = ( env: GameEnvironment ) => void;

declare global {
  type T_GameEnvironment = typeof GameEnvironment["prototype"];
}

// # Class
class GameEnvironment 
{
  static runningInstances = new Map<string, GameEnvironment>();
  static boundCallbacks: T_EnvironmentBinding[] = [];

  static BindCallbackToEnvironmentCreation = ( callback: T_EnvironmentBinding ) => this.boundCallbacks.push( callback );
  static GetDefaultEnvironment = () => this.runningInstances.get( "default" )!;

  private readonly closingConnections: T_EnvironmentBinding[] = [];
  private readonly connections: RBXScriptConnection[] = [];

  readonly players = new Set<Player>();
  readonly playerJoined = new Signal<[user: Player, referenceId: string]>();
  readonly playerLeft = new Signal<[user: Player, reason: string]>();

  readonly blockedPlayers = new Map<Player["UserId"], string>; // UserId, reason
  readonly attributes = {
    totalTeamSize: 6,
    raidingGroupId: 0,

    healingOnKill: false,
    teamHealing: false,
    forceTieTime: 0,

    gamemode: Gamemode.KingOfTheHill,
  };

  readonly netctx: NetworkContext;
  readonly entity = new EntityManager( this );
  readonly lifecycle = new LifecycleContainer();

  isPlayback = false;

  constructor( readonly id: string, readonly isServer: boolean ) 
  {
    RaposoConsole.Warn( `Creating game environment ${id}` );
    GameEnvironment.runningInstances.set( id, this );

    this.connections.push( Players.PlayerRemoving.Connect( user => this.RemovePlayer( user, "Left the game." ) ) );

    this.netctx = new NetworkContext( id, user => RunService.IsClient() || this.players.has( user ) );
    this.netctx.isServer = isServer;
    this.netctx.ListenServer( "disconnect_request", sender => 
    {
      if ( !sender ) return;
      this.RemovePlayer( sender, "Disconnected by user." );
    } );

    this.lifecycle.running = true;

    // Attributes override
    const attributesInstance = ReplicatedInstance( ReplicatedStorage, "EnvironmentOverride", "Configuration" );
    for ( const [attribute, value] of attributesInstance.GetAttributes() ) 
    {
      const keyofName = attribute as keyof typeof this.attributes;

      if ( typeOf( this.attributes[keyofName] ) === typeOf( value ) )
        rawset( this.attributes, keyofName, value );
    }

    // Spawn map entities
    if ( isServer )
      for ( const obj of CollectionService.GetTagged( gameValues.objtag ) ) 
      {
        const classnameAttribute = obj.GetAttribute( "classname" );
        if ( !classnameAttribute ) 
        {
          RaposoConsole.Warn( `${obj.GetFullName()} is missing the classname attribute.` );
          continue;
        }
        if ( !t.string( classnameAttribute ) ) 
        {
          RaposoConsole.Warn( `The classname attribute from ${obj.GetFullName()} must be a string.` );
          continue;
        }

        this.entity.CreateEntityByName( classnameAttribute as keyof GameEntities ).andThen( ent => 
        {
          if ( obj.Name !== ent.classname )
            ent.SetName( obj.Name );

          if ( obj.IsA( "BasePart" ) && ent.IsA( "WorldEntity" ) ) 
          {
            const converted = UTIL_MATH_ConvertCFrameToVector3( obj.CFrame );
            ent.position = converted.position;
            ent.rotation = converted.rotation;
            ent.size = obj.Size;
          }

          for ( const [name, value] of obj.GetAttributes() ) 
          {
            if ( name === "classname" ) continue;

            const existingValue = rawget( ent, name );
            if ( existingValue === undefined ) continue;
            if ( typeOf( existingValue ) !== typeOf( value ) ) 
            {
              RaposoConsole.Warn( `Attribute ${name} on ${obj.GetFullName()} must be a ${typeOf( existingValue )}.` );
              continue;
            }

            rawset( ent, name, value );
          }
        } );
      }

    // Execute bindings
    for ( const callback of GameEnvironment.boundCallbacks )
      task.spawn( callback, this );

    // # Replication
    if ( isServer ) 
    {
      this.lifecycle.BindTickrate( () => 
      {
        const currentSnapshot = StoreEnvironmentSnapshot( this );

        // Compute the snapshot difference for all clients
        for ( const client of this.players ) 
        {
          const lastClientSnapshot = GetLatestClientAknowledgedSnapshot( this.id, client );
          const differenceSnapshot = EntityCompareSnapshotVersions( this, lastClientSnapshot, currentSnapshot );

          startNetworkPacket( { id: "gameenv_repl", context: this.netctx, unreliable: true, players: [client], ignore: [] } );

          writeBufferString( currentSnapshot.id );
          writeBufferString( lastClientSnapshot?.id ?? "0" );
          WriteEntityBufferChanges( differenceSnapshot );

          finishNetworkPacket();

        }

        // Eliminate old snapshots
        const environmentSnapshots = GetSnapshotsFromEnvironmentId( this.id ) || new Map();
        if ( environmentSnapshots.size() > 32 ) 
        {
          for ( const [, snapshot] of environmentSnapshots ) 
          {
            if ( currentSnapshot.version - snapshot.version <= 32 ) continue;

            snapshot.entities.clear();
            snapshot.acknowledgedClients.clear();
            environmentSnapshots.delete( id );
          }
        }
      } );

      this.netctx.ListenServer( "gameenv_snap_ack", ( sender, reader ) => 
      {
        if ( !sender ) return;

        const snapshotId = reader.string();

        const snapshotList = GetSnapshotsFromEnvironmentId( this.id );
        if ( !snapshotList || snapshotList.size() <= 0 ) return;

        const targetSnapshot = snapshotList.get( snapshotId );
        if ( !targetSnapshot ) return;

        targetSnapshot.acknowledgedClients.add( sender.UserId );
      } );
    }

    if ( !isServer ) 
    {
      this.netctx.ListenClient( "gameenv_repl", reader => 
      {
        const currentSnapshotId = reader.string();
        const referenceSnapshotId = reader.string();

        const entityChanges = ReadBufferEntityChanges( reader );

        // Remove entities
        for ( const entityId of entityChanges.removed )
          if ( this.entity.entities.has( entityId ) ) 
          {
            this.entity.killThisFucker( this.entity.entities.get( entityId ) );
          }

        // Create new entities
        for ( const newEntityInfo of entityChanges.new ) 
        {

          // Check for the existing entity
          {
            let existingEntity: BaseEntity | undefined = this.entity.entities.get( newEntityInfo.id );

            if ( existingEntity && existingEntity.classname !== newEntityInfo.classname ) 
            {
              this.entity.killThisFucker( existingEntity );
              existingEntity = undefined;
            }

            if ( existingEntity ) continue;
          }

          this.entity.CreateEntityByName( newEntityInfo.classname );
        }

        // Synchronize changes
        for ( const [entityId, entityState] of entityChanges.changed ) 
        {
          const entity = this.entity.entities.get( entityId );
          if ( !entity ) continue;

          for ( const [variableName, valueInfo] of entityState ) 
          {
            const existingEntityValue = rawget( entity, variableName );
            if ( existingEntityValue === undefined ) continue;

            if ( typeOf( existingEntityValue ) !== typeOf( valueInfo.value ) ) 
            {
              RaposoConsole.Info( `Invalid entity variable type! "${variableName}" ${typeOf( existingEntityValue )} -> ${typeOf( valueInfo.value )}` );
              continue;
            }

            if ( !entity.networkablePropertiesHandlers.has( variableName ) )
              rawset( entity, variableName, valueInfo.value );

            entity.networkablePropertiesHandlers.get( variableName )?.( entityState, valueInfo.value );
          }
        }

        // Acknowledge snapshot
        startNetworkPacket( { id: "gameenv_snap_ack", context: this.netctx, players: [], ignore: [], unreliable: true } );

        writeBufferString( currentSnapshotId );

        finishNetworkPacket();
      } );
    }
  }

  async Close() 
  {
    print( `Closing game environment instance ${this.id}...` );

    this.lifecycle.Destroy();
    GameEnvironment.runningInstances.delete( this.id );

    for ( const user of this.players )
      this.RemovePlayer( user, "Instance closing." );

    this.netctx.Destroy();

    task.wait( 1 );

    for ( const callback of this.closingConnections )
      task.spawn( () => callback( this ) );
    this.closingConnections.clear();

    for ( const conn of this.connections )
      conn.Disconnect();
    this.connections.clear();

    this.entity.murderAllFuckers();

    this.playerJoined.Clear();
    this.playerLeft.Clear();

    task.wait();
    task.wait();

    table.clear( this );
  }

  BindToClose( callback: ( server: GameEnvironment ) => void ) 
  {
    this.closingConnections.push( callback );
  }

  RegisterPlayer( player: Player ) 
  {
    // const referenceId = HttpService.GenerateGUID(false);
    const referenceId = RandomString( 10 );

    RaposoConsole.Info( `${player.Name} (${referenceId}) has joined the server ${this.id}` );

    player.SetAttribute( gameValues.usersessionid, referenceId );

    this.players.add( player );
    this.playerJoined.Fire( player, referenceId );
  }

  RemovePlayer( player: Player, disconnectreason = "" ) 
  {
    if ( !this.players.has( player ) ) return;

    print( `${player.Name} has left the server ${this.id}. (${disconnectreason})` );
    player.SetAttribute( gameValues.usersessionid, undefined );

    // TODO: Send a notification to the player. (when the main menu is added)
    // SendStandardMessage( "server_disconnected", { disconnectreason }, player );

    startNetworkPacket( { id: "session_disconnected", context: defaultNetworkContext, players: [player], unreliable: false } );
    writeBufferString( disconnectreason );
    finishNetworkPacket();

    this.players.delete( player );
    this.playerLeft.Fire( player, disconnectreason );

    // TODO: Remove this whenever you add an actual main menu to the game, retard.
    player.Kick( disconnectreason );
  }

  BlockPlayer( player: Player, reason = "undefined." ) 
  {
    this.blockedPlayers.set( player.UserId, reason );

    this.RemovePlayer( player, `Blocked by administrator: ${reason}` );
  }

  static GetServersFromPlayer( user: Player ) 
  {
    const list = new Array<GameEnvironment>();

    for ( const [, server] of this.runningInstances )
      if ( server.players.has( user ) ) list.push( server );

    return list;
  }
}

// * Export
export = GameEnvironment;