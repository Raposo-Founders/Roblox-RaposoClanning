import { t } from "@rbxts/t";
import { BufferReader } from "util/bufferreader";
import * as BufferWriter from "util/bufferwriter";

// # Types

declare global {
  interface I_Snapshot {
    id: string;
    version: number;
    entities: Map<EntityId, T_EntityState>;
    acknowledgedClients: Set<Player["UserId"]>;
  }
}

interface I_EntityChanges {
  new: {id: EntityId, classname: keyof GameEntities}[];
  changed: Map<EntityId, T_EntityState>;
  removed: EntityId[];
}

// # Constants & variables
const storedSnapshots = new Map<T_GameEnvironment["id"], Map<I_Snapshot["id"], I_Snapshot>>();

// # Functions
export function GetLatestClientAknowledgedSnapshot(envId: T_GameEnvironment["id"], client: Player) {
  const environmentSnapshots = storedSnapshots.get(envId);
  if (!environmentSnapshots) return;

  let latestSnapshot: I_Snapshot | undefined;

  for (const [, snapshot] of environmentSnapshots) {
    if (latestSnapshot && latestSnapshot.version > snapshot.version) continue;
    if (!snapshot.acknowledgedClients.has(client.UserId)) continue;

    latestSnapshot = snapshot;
  }

  return latestSnapshot;
}

export function GetSnapshotsFromEnvironmentId(envId: T_GameEnvironment["id"]) {
  return storedSnapshots.get(envId);
}

export function EntityCompareSnapshotVersions(env: T_GameEnvironment, fromSnapshot: I_Snapshot | undefined, toSnapshot: I_Snapshot) {
  const entityChanges: I_EntityChanges = {
    new: [],
    changed: new Map(),
    removed: [],
  };

  for (const [entityId, values] of toSnapshot.entities) {
    // Check if the entity is new
    if (!fromSnapshot || !fromSnapshot.entities.has(entityId)) {
      const entity = env.entity.entities[entityId];
      if (!entity) continue;

      entityChanges.new.push({id: entityId, classname: entity.classname});
      entityChanges.changed.set(entityId, values);
      continue;
    }

    // Check for entity variable changes
    const changesMap: T_EntityState = new Map();
    const previousState = fromSnapshot.entities.get(entityId)!;

    entityChanges.changed.set(entityId, changesMap);

    for (const [variableName, currentValue] of values) {
      const previousValue = previousState.get(variableName);
      if (previousValue && previousValue.value === currentValue.value) continue;

      changesMap.set(variableName, currentValue);
    }
  }

  // Check removed entities
  if (fromSnapshot)
    for (const [entityId, values] of fromSnapshot.entities) {
      if (toSnapshot.entities.has(entityId)) continue;

      entityChanges.removed.push(entityId);
    }

  return entityChanges;
}

export function StoreEnvironmentSnapshot(env: T_GameEnvironment) {
  const existingSnapshots = storedSnapshots.get(env.id) || new Map();

  const snapshot: I_Snapshot = {
    id: `Snapshot${existingSnapshots.size() + 1}`,
    version: existingSnapshots.size() + 1,
    entities: new Map(),
    acknowledgedClients: new Set(),
  };

  for (const entity of env.entity.entities)
    snapshot.entities.set(entity.id, entity.GetStateSnapshot());

  existingSnapshots.set(snapshot.id, snapshot);
  storedSnapshots.set(env.id, existingSnapshots);

  return snapshot;
}

function QuickBufferWriteValue(value: unknown, bufferType: BufferWriter.BufferByteType) {
  if (bufferType === BufferWriter.BufferByteType.str) {
    if (!t.string(value)) throw `Value is not a string!`;
    BufferWriter.writeBufferString(value);
    return;
  }

  if (bufferType === BufferWriter.BufferByteType.bool) {
    if (!t.boolean(value)) throw `Value is not a boolean!`;
    BufferWriter.writeBufferBool(value);
    return;
  }

  if (bufferType === BufferWriter.BufferByteType.vec) {
    if (!t.Vector3(value)) throw `Value is not a Vector3!`;
    BufferWriter.writeBufferVector(value);
    return;
  }

  if (!t.number(value)) throw `Value is not a number!`;

  if (bufferType === BufferWriter.BufferByteType.u8) BufferWriter.writeBufferU8(value);
  if (bufferType === BufferWriter.BufferByteType.i8) BufferWriter.writeBufferI8(value);
  if (bufferType === BufferWriter.BufferByteType.u16) BufferWriter.writeBufferU16(value);
  if (bufferType === BufferWriter.BufferByteType.i16) BufferWriter.writeBufferI16(value);
  if (bufferType === BufferWriter.BufferByteType.u32) BufferWriter.writeBufferU32(value);
  if (bufferType === BufferWriter.BufferByteType.i32) BufferWriter.writeBufferI32(value);
  if (bufferType === BufferWriter.BufferByteType.f32) BufferWriter.writeBufferF32(value);
  if (bufferType === BufferWriter.BufferByteType.u64) BufferWriter.writeBufferU64(value);
  if (bufferType === BufferWriter.BufferByteType.f64) BufferWriter.writeBufferF64(value);
}

export function ReadBufferEntityChanges(reader: ReturnType<typeof BufferReader>) {
  const content: I_EntityChanges = {
    new: [],
    changed: new Map(),
    removed: [],
  };

  // Read new entities
  const newEntitiesAmount = reader.u8();
  for (let i = 0; i < newEntitiesAmount; i++) {
    const entityId = reader.u16();
    const classname = reader.string();

    content.new.push({ id: entityId, classname: classname as keyof GameEntities });
  }

  // Read entity changes
  const changesAmount = reader.u8();
  for (let i = 0; i < changesAmount; i++) {
    const entityId = reader.u16();
    const valuesAmount = reader.u8();
    const entityMap = content.changed.get(entityId) || new Map();

    for (let valueId = 0; valueId < valuesAmount; valueId++) {
      const variableName = reader.string();
      const valueType = reader.u8();

      const bufferType = BufferWriter.BufferByteType[valueType] as keyof typeof BufferWriter.BufferByteType;

      let value: unknown;

      if (bufferType === "u8") value = reader.u8();
      if (bufferType === "i8") value = reader.i8();
      if (bufferType === "u16") value = reader.u16();
      if (bufferType === "i16") value = reader.i16();
      if (bufferType === "u32") value = reader.u32();
      if (bufferType === "i32") value = reader.i32();
      if (bufferType === "f32") value = reader.f32();
      if (bufferType === "u64") value = reader.u64();
      if (bufferType === "f64") value = reader.f64();
      if (bufferType === "str") value = reader.string();
      if (bufferType === "bool") value = reader.bool();
      if (bufferType === "vec") value = reader.vec();

      if (value !== undefined)
        entityMap.set(variableName, { value, valueType });
    }

    content.changed.set(entityId, entityMap);
  }

  // Read removed entities
  const removedEntities = reader.u8();
  for (let i = 0; i < removedEntities; i++) {
    const entityId = reader.u16();

    content.removed.push(entityId);
  }

  return content;
}

export function WriteEntityBufferChanges(states: I_EntityChanges) {
  // Write new entities
  BufferWriter.writeBufferU8(states.new.size());
  for (const ent of states.new) {
    BufferWriter.writeBufferU16(ent.id);
    BufferWriter.writeBufferString(ent.classname);
  }

  // Write entity changes
  BufferWriter.writeBufferU8(states.changed.size()); // This limits it to only 255 changes, dickhead
  for (const [entityId, entityValues] of states.changed) {
    BufferWriter.writeBufferU16(entityId);
    BufferWriter.writeBufferU8(entityValues.size());

    for (const [variableName, variableState] of entityValues) {
      BufferWriter.writeBufferString(variableName);
      BufferWriter.writeBufferU8(variableState.valueType);

      QuickBufferWriteValue(variableState.value, variableState.valueType);
    }
  }

  // Write removed entities
  BufferWriter.writeBufferU8(states.removed.size());
  for (const entityId of states.removed)
    BufferWriter.writeBufferU16(entityId);
}

// # Class
export class SnapshotContext {
  
}

// # Bindings & misc

