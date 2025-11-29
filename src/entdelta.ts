import { t } from "@rbxts/t";
import BaseEntity from "entities/BaseEntity";
import { BufferReader } from "util/bufferreader";
import * as BufferWriter from "util/bufferwriter";

// # Info
/*
 # Writing entity state changes

 * Total changes U8

 * Initial u8
 - 0 = no changes
 - other = byte type (follows BufferByteType's index)

 ^ Variable name (string)
 & Value
*/

// # Types
type EntityState = Map<string, unknown>;

// # Constants & variables

// # Functions
function writeValue(value: unknown, bufferType: BufferWriter.BufferByteType) {
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
    if (!t.vector(value)) throw `Value is not a vector!`;
    BufferWriter.writeBufferVector(value.X, value.Y, value.Z);
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

export function writeBufferEntityNetworkDelta(entity: BaseEntity, previousState: Map<string, { value: unknown, valueType: BufferWriter.BufferByteType }>) {
  const changesList = new Map<string, { valueType: BufferWriter.BufferByteType, value: unknown }>();
  const currentState = entity.GetNetworkSnapshot();

  for (const [name, current] of currentState) {
    const oldValue = previousState.get(name);
    if (oldValue !== undefined && oldValue === current.value) continue;

    changesList.set(name, { value: current.value, valueType: current.valueType });
  }

  BufferWriter.writeBufferString(entity.id);
  BufferWriter.writeBufferU8(changesList.size()); // This limits it to only 255 changes, dickhead
  for (const [name, val] of changesList) {
    BufferWriter.writeBufferU8(val.valueType);
    BufferWriter.writeBufferString(name);
    writeValue(val.value, val.valueType);
  }
}

export function readBufferEntityNetworkDelta(reader: ReturnType<typeof BufferReader>) {
  const totalChangesTable = new Map<string, unknown>();

  const changesAmount = reader.u8();
  for (let i = 0; i < changesAmount; i++) {
    const valueType = BufferWriter.BufferByteType[reader.u8()] as keyof typeof BufferWriter.BufferByteType;
    const variableName = reader.string();

    let value: unknown;

    if (valueType === "u8") value = reader.u8();
    if (valueType === "i8") value = reader.i8();
    if (valueType === "u16") value = reader.u16();
    if (valueType === "i16") value = reader.i16();
    if (valueType === "u32") value = reader.u32();
    if (valueType === "i32") value = reader.i32();
    if (valueType === "f32") value = reader.f32();
    if (valueType === "u64") value = reader.u64();
    if (valueType === "f64") value = reader.f64();
    if (valueType === "str") value = reader.string();
    if (valueType === "bool") value = reader.bool();
    if (valueType === "vec") value = reader.vec();

    if (value !== undefined)
      totalChangesTable.set(variableName, value);
  }

  return totalChangesTable;
}
