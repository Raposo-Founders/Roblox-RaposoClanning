import { t } from "@rbxts/t";
import { RaposoConsole } from "logging";
import Signal from "util/signal";
import BaseEntity from "./BaseEntity";
import { RandomString } from "util/utilfuncs";
import { HttpService } from "@rbxts/services";

// # Types
declare global {
  type EntityType<T extends keyof GameEntities> = GameEntities[T]["prototype"];
  type EntityId = typeof BaseEntity["prototype"]["id"];
  type T_EntityEnvironment = EntityManager;
}

// # Constants
const registeredEntityClassnames = new Set<keyof GameEntities>();
const entitiesBuildList = new Map<string, new ( ...args: never[] ) => BaseEntity>();

// # Functions
export function registerEntityClass( name: keyof GameEntities, builder?: new ( ...args: never[] ) => BaseEntity ) 
{
  assert( !registeredEntityClassnames.has( name ), `Entity ${name} has already been registered.` );

  registeredEntityClassnames.add( name );

  if ( builder )
    entitiesBuildList.set( name, builder );
}

export function requireEntities() 
{
  for ( const inst of script.GetChildren() ) 
  {
    if ( !inst.IsA( "ModuleScript" ) ) continue;

    const content = require( inst );
    if ( t.nil( content ) ) continue;
    if ( !t.table( content ) || !( "constructor" in content ) ) 
    {
      RaposoConsole.Warn( inst, "did not return an valid entity class constructor." );
      continue;
    }

    const [success, message] = pcall( registerEntityClass, inst.Name as keyof GameEntities, content as new () => BaseEntity );
    if ( success ) continue;

    RaposoConsole.Warn( "Failed when requiring entity file:", inst, `\n${message}` );
  }
}

// # Class
export class EntityManager 
{
  readonly entities = new Map<EntityId, BaseEntity>();
  readonly namedEntities = new Map<string, BaseEntity>();
  readonly entityCreated = new Signal<[Entity: BaseEntity]>();
  readonly entityDeleting = new Signal<[Entity: BaseEntity]>();

  constructor( public environment: T_GameEnvironment ) 
  { }

  async CreateEntityByName<K extends keyof GameEntities>( classname: K, entityId: EntityId = HttpService.GenerateGUID( false ) ): Promise<EntityType<K>> 
  {
    const entity_constructor = entitiesBuildList.get( classname );
    assert( entity_constructor, `Attempt to create unknown entity: "${classname}"` );

    print( `Spawning entity ${classname}...` );

    const entity = new entity_constructor();

    this.entities.set( entityId, entity );
    rawset( entity, "id", entityId );
    rawset( entity, "environment", this.environment );

    for ( const callback of entity.setupFinishedCallbacks )
      task.spawn( callback );
    entity.setupFinishedCallbacks.clear();

    this.entityCreated.Fire( entity );

    return entity as unknown as EntityType<K>;
  }

  killThisFucker( entity: BaseEntity | undefined ) 
  {
    if ( !t.table( entity ) ) return;
    if ( !this.isEntityOnMemoryOrImSchizo( entity ) ) return;
    if ( !t.string( rawget( entity, "id" ) as EntityId ) )
      throw `This s### is an invalid entity. ${entity.classname} ${entity.id}`;

    print( `Killing entity ${entity.classname} ${entity.id}` );

    this.entities.delete( entity.id );
    this.namedEntities.delete( entity.name );
    this.entityDeleting.Fire( entity );

    task.defer( () => 
    {
      entity.Destroy();

      for ( const callback of entity.deletionCallbacks ) 
      {
        const [success, message] = pcall( () => callback() );
        if ( !success )
          RaposoConsole.Warn( message );
      }

      // Fuckass hack :)
      const deepClearContent = ( obj: object ) => 
      {
        for ( const [index, value] of obj as Map<string, unknown> ) 
        {
          if ( t.table( value ) && rawget( value, "_classname" ) === tostring( Signal ) )
            continue; // Will be handled later

          if ( t.table( value ) ) deepClearContent( value );

          // This is the ugliest fucking thing I've ever seen
          const [success, message] = pcall( () => ( obj as Map<string, unknown> ).set( index, undefined ) );
          if ( !success )
            RaposoConsole.Warn( "Failed when clearing object entity content.", message );
        }
      };

      rawset( entity, "environment", undefined );
      deepClearContent( entity );

      // Unbinding signals
      for ( const [key, value] of entity as unknown as Map<string, unknown> ) 
      {
        if ( !t.table( value ) || rawget( value, "_classname" ) !== tostring( Signal ) ) continue;

        // print("Clearing entity signal content:", key);
        ( value as Signal<unknown[]> ).Clear();

        rawset( entity, key, undefined );
      }

      setmetatable( entity, undefined );
    } );
  }

  isEntityOnMemoryOrImSchizo( entity: BaseEntity | undefined ): boolean 
  {
    return t.any( entity ) && t.table( entity ) && t.string( rawget( entity, "id" ) ) && this.entities.get( entity.id ) === entity;
  }

  getEntitiesThatIsA<K extends keyof GameEntities, E extends GameEntities[K]>( classname: K ): E["prototype"][] 
  {
    // Check if the classname is actually valid
    if ( !registeredEntityClassnames.has( classname ) )
      throw `Invalid entity classname: ${classname}`;

    const foundList: E["prototype"][] = [];

    for ( const [, ent] of this.entities )
    {
      if ( ent.IsA( classname ) )
        foundList.push( ent as unknown as E["prototype"] );
    }

    return foundList;
  }

  getEntitiesOfClass<K extends keyof GameEntities, E extends GameEntities[K]>( classname: K ): ( E["prototype"] )[] 
  {
    // Check if the classname is actually valid
    if ( !registeredEntityClassnames.has( classname ) )
      throw `Invalid entity classname: ${classname}`;

    const foundList: E["prototype"][] = [];

    for ( const [, ent] of this.entities )
    {
      if ( ent.classname === classname )
        foundList.push( ent as unknown as E["prototype"] );
    }

    return foundList;
  }

  getEntitiesFromInstance( inst: Instance ) 
  {
    const foundList: BaseEntity[] = [];

    for ( const [, ent] of this.entities )
    {
      if ( ent.associatedInstances.has( inst ) )
      {
        foundList.push( ent );
        continue;
      }

      for ( const associatedInstance of ent.associatedInstances ) 
      {
        if ( !inst.IsDescendantOf( associatedInstance ) ) continue;
        foundList.push( ent );
        break;
      }
    }

    return foundList;
  }

  murderAllFuckers() 
  {
    for ( const [, ent] of this.entities )
      this.killThisFucker( ent );
  }
}
