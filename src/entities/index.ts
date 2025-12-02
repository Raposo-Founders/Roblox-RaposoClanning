import { RunService } from "@rbxts/services";
import { t } from "@rbxts/t";
import Signal from "util/signal";
import { RandomString } from "util/utilfuncs";
import BaseEntity from "./BaseEntity";
import { RaposoConsole } from "logging";

// # Types
declare global {
  type EntityType<T extends keyof GameEntities> = GameEntities[T]["prototype"];
  type EntityId = typeof BaseEntity["prototype"]["id"];
  type T_EntityEnvironment = EntityManager;
}

// # Constants
const registeredEntityClassnames = new Set<keyof GameEntities>();
const entitiesBuildList = new Map<string, new (...args: never[]) => BaseEntity>();

// # Functions
export function registerEntityClass(name: keyof GameEntities, builder?: new (...args: never[]) => BaseEntity) {
  assert(!registeredEntityClassnames.has(name), `Entity ${name} has already been registered.`);

  registeredEntityClassnames.add(name);

  if (builder)
    entitiesBuildList.set(name, builder);
}

export function requireEntities() {
  for (const inst of script.GetChildren()) {
    if (!inst.IsA("ModuleScript")) continue;

    const content = require(inst);
    if (t.nil(content)) continue;
    if (!t.table(content) || !("constructor" in content)) {
      RaposoConsole.Warn(inst, "did not return an valid entity class constructor.");
      continue;
    }

    const [success, message] = pcall(registerEntityClass, inst.Name as keyof GameEntities, content as new () => BaseEntity);
    if (success) continue;

    RaposoConsole.Warn("Failed when requiring entity file:", inst, `\n${message}`);
  }
}

// # Class
export class EntityManager {
  readonly entities = new Map<EntityId, BaseEntity>();
  readonly entityCreated = new Signal<[Entity: BaseEntity]>();
  readonly entityDeleting = new Signal<[Entity: BaseEntity]>();

  constructor(public environment: T_GameEnvironment) { }

  async createEntity<
    K extends keyof GameEntities,
    E extends GameEntities[K],
    C extends E extends new (...args: infer A) => BaseEntity ? A : never[],
  >(classname: K, entityId: string | undefined, ...args: C): Promise<EntityType<K>> {
    const entity_constructor = entitiesBuildList.get(classname);
    assert(entity_constructor, `Attempt to create unknown entity: "${classname}"`);

    print(`Spawning entity ${classname}...`);

    // Make sure to prevent any duplicate entity IDs
    if (entityId === undefined)
      while (entityId === undefined) {
        const randomId = RandomString(5);

        if (this.entities.has(randomId))
          continue;

        entityId = randomId;
        break;
      }

    if (this.entities.has(entityId))
      throw `Entity of id ${entityId} already exists as an ${this.entities.get(entityId)!.classname}.`;

    const entity = new entity_constructor(...(args as never[]));
    rawset(entity, "environment", this.environment);
    rawset(entity, "id", entityId);

    this.entities.set(entity.id, entity);

    for (const callback of entity.setupFinishedCallbacks)
      task.spawn(callback);

    this.entityCreated.Fire(entity);

    return entity as unknown as EntityType<K>;
  }

  killThisFucker(entity: BaseEntity) {
    if (!this.isEntityOnMemoryOrImSchizo(entity)) return;
    if (!t.table(entity) || !t.string(rawget(entity, "id") as EntityId))
      throw `This s### is an invalid entity. ${entity.classname} ${entity.id}`;

    print(`Killing entity ${entity.classname} ${entity.id}`);

    this.entities.delete(entity.id);
    this.entityDeleting.Fire(entity);

    task.defer(() => {
      entity.Destroy();

      for (const callback of entity.deletionCallbacks) {
        const [success, message] = pcall(() => callback());
        if (!success)
          RaposoConsole.Warn(message);
      }

      // Fuckass hack :)
      const deepClearContent = (obj: object) => {
        for (const [index, value] of obj as Map<string, unknown>) {
          if (t.table(value) && rawget(value, "_classname") === tostring(Signal))
            continue; // Will be handled later

          if (t.table(value)) deepClearContent(value);

          // This is the ugliest fucking thing I've ever seen
          const [success, message] = pcall(() => (obj as Map<string, unknown>).set(index, undefined));
          if (!success)
            RaposoConsole.Warn("Failed when clearing object entity content.", message);
        }
      };

      rawset(entity, "environment", undefined);
      deepClearContent(entity);

      // Unbinding signals
      for (const [key, value] of entity as unknown as Map<string, unknown>) {
        if (!t.table(value) || rawget(value, "_classname") !== tostring(Signal)) continue;

        // print("Clearing entity signal content:", key);
        (value as Signal<unknown[]>).Clear();

        rawset(entity, key, undefined);
      }

      setmetatable(entity, undefined);
    });
  }

  isEntityOnMemoryOrImSchizo(entity: BaseEntity | EntityId | undefined): boolean {

    // If an nil value is given.
    if (!t.any(entity)) return false;

    // If an string value is given.
    if (t.string(entity)) return this.entities.has(entity);

    // If the object is not an table.
    if (!t.table(entity)) return false;

    // Try to get the "id" variable from the object
    const id = rawget(entity, "id") as EntityId;
    if (!t.string(id)) return false;

    return this.entities.has(id);

    // Why the fuck did you have to comment each and every step of this?
    // Are we teaching this to a toddler or something?
  }

  getEntitiesThatIsA<K extends keyof GameEntities, E extends GameEntities[K]>(classname: K): E["prototype"][] {
    const list: (E["prototype"])[] = [];

    // Check if the classname is actually valid
    if (!registeredEntityClassnames.has(classname))
      throw `Invalid entity classname: ${classname}`;

    for (const [, ent] of this.entities) {
      if (!ent.IsA(classname)) continue;
      list.push(ent as unknown as EntityType<K>);
    }

    return list;
  }

  getEntitiesOfClass<K extends keyof GameEntities, E extends GameEntities[K]>(classname: K): E["prototype"][] {
    const list: (E["prototype"])[] = [];

    // Check if the classname is actually valid
    if (!registeredEntityClassnames.has(classname))
      throw `Invalid entity classname: ${classname}`;

    for (const [, ent] of this.entities) {
      if (ent.classname !== classname) continue;
      list.push(ent as unknown as EntityType<K>);
    }

    return list;
  }

  getEntitiesFromInstance(inst: Instance) {
    const list: BaseEntity[] = [];

    for (const [, ent] of this.entities) {
      if (ent.associatedInstances.has(inst)) {
        list.push(ent);
        continue;
      }

      for (const associatedInstance of ent.associatedInstances) {
        if (!inst.IsDescendantOf(associatedInstance)) continue;

        list.push(ent);
        break;
      }
    }

    return list;
  }

  murderAllFuckers() {
    for (const [entid, info] of this.entities)
      this.killThisFucker(info);
  }
}
