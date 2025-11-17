
// # Types
interface IBufferCreator {
  currentSize: number;
}

interface IBufferEntryInfo {
  type: BufferByteType;
  value: unknown;
}

// # Constants
export enum BufferByteType {
  u8,
  i8,
  u16,
  i16,
  u32,
  i32,
  f32,
  u64,
  f64,
  str,
  bool,
  vec,
}

const defaultStringSize = 2; // 16 bytes
const bufferCreationThreads = new Map<thread, IBufferEntryInfo[]>();

// # Functions
export function startBufferCreation() {
  const thread = coroutine.running();
  bufferCreationThreads.set(thread, []);
}

export function writeBufferU8(value: number) {
  const thread = coroutine.running();
  const bufferQueue = bufferCreationThreads.get(thread);
  assert(bufferQueue, "No buffer creation spawned on the current thread.");

  assert(value >= 0 && value <= 255, "U8 number must be between 0 and 255.");

  bufferQueue.push({
    type: BufferByteType.u8,
    value: value,
  });
}

export function writeBufferI8(bufferInfo: IBufferCreator, value: number) {
  const thread = coroutine.running();
  const bufferQueue = bufferCreationThreads.get(thread);
  assert(bufferQueue, "No buffer creation spawned on the current thread.");

  assert(value >= -128 && value <= 127, "I8 number must be between -128 and 127.");

  bufferQueue.push({
    type: BufferByteType.i8,
    value: value,
  });

  bufferInfo.currentSize += 8;
}

export function writeBufferU16(value: number) {
  const thread = coroutine.running();
  const bufferQueue = bufferCreationThreads.get(thread);
  assert(bufferQueue, "No buffer creation spawned on the current thread.");

  assert(value >= 0 && value <= 65_535, "U16 number must be between 0 and 65535.");

  bufferQueue.push({
    type: BufferByteType.u16,
    value: value,
  });
}

export function writeBufferI16(value: number) {
  const thread = coroutine.running();
  const bufferQueue = bufferCreationThreads.get(thread);
  assert(bufferQueue, "No buffer creation spawned on the current thread.");

  assert(value >= -32_768 && value <= 32_767, "I16 number must be between -32768 and 32767.");

  bufferQueue.push({
    type: BufferByteType.i16,
    value: value,
  });
}

export function writeBufferU32(value: number) {
  const thread = coroutine.running();
  const bufferQueue = bufferCreationThreads.get(thread);
  assert(bufferQueue, "No buffer creation spawned on the current thread.");

  assert(value >= 0 && value <= 4_294_967_295, "U32 number must be between 0 and 4294967295.");

  bufferQueue.push({
    type: BufferByteType.u32,
    value: value,
  });
}

export function writeBufferI32(value: number) {
  const thread = coroutine.running();
  const bufferQueue = bufferCreationThreads.get(thread);
  assert(bufferQueue, "No buffer creation spawned on the current thread.");

  assert(value >= -2_147_483_648 && value <= 2_147_483_647, "I32 number must be between -2147483648 and 2147483647.");

  bufferQueue.push({
    type: BufferByteType.i32,
    value: value,
  });
}

export function writeBufferF32(value: number) {
  const thread = coroutine.running();
  const bufferQueue = bufferCreationThreads.get(thread);
  assert(bufferQueue, "No buffer creation spawned on the current thread.");

  bufferQueue.push({
    type: BufferByteType.f32,
    value: value,
  });
}

export function writeBufferU64(value: number) {
  const thread = coroutine.running();
  const bufferQueue = bufferCreationThreads.get(thread);
  assert(bufferQueue, "No buffer creation spawned on the current thread.");

  bufferQueue.push({
    type: BufferByteType.u64,
    value: value,
  });
}

export function writeBufferF64(value: number) {
  const thread = coroutine.running();
  const bufferQueue = bufferCreationThreads.get(thread);
  assert(bufferQueue, "No buffer creation spawned on the current thread.");

  bufferQueue.push({
    type: BufferByteType.f64,
    value: value,
  });
}

export function writeBufferString(value: string) {
  const thread = coroutine.running();
  const bufferQueue = bufferCreationThreads.get(thread);
  assert(bufferQueue, "No buffer creation spawned on the current thread.");

  bufferQueue.push({
    type: BufferByteType.str,
    value: value,
  });
}

export function writeBufferBool(value: boolean) {
  const thread = coroutine.running();
  const bufferQueue = bufferCreationThreads.get(thread);
  assert(bufferQueue, "No buffer creation spawned on the current thread.");

  bufferQueue.push({
    type: BufferByteType.bool,
    value: value,
  });
}

export function writeBufferVector(value1: number, value2: number, value3: number) {
  const thread = coroutine.running();
  const bufferQueue = bufferCreationThreads.get(thread);
  assert(bufferQueue, "No buffer creation spawned on the current thread.");

  bufferQueue.push({
    type: BufferByteType.vec,
    value: vector.create(value1, value2, value3),
  });
}

export function finalizeBufferCreation() {
  const thread = coroutine.running();
  const bufferQueue = bufferCreationThreads.get(thread);
  assert(bufferQueue, "No buffer creation spawned on the current thread.");

  let currentSize = 0;
  let currentOffset = 0;

  for (const element of bufferQueue) {
    switch (element.type) {
    case BufferByteType.u8:
      currentSize += 1;
      break;
    case BufferByteType.i8:
      currentSize += 1;
      break;
    case BufferByteType.u16:
      currentSize += 2;
      break;
    case BufferByteType.i16:
      currentSize += 2;
      break;
    case BufferByteType.u32:
      currentSize += 4;
      break;
    case BufferByteType.i32:
      currentSize += 4;
      break;
    case BufferByteType.f32:
      currentSize += 4;
      break;
    case BufferByteType.u64:
      currentSize += 8;
      break;
    case BufferByteType.f64:
      currentSize += 8;
      break;
    case BufferByteType.str: {
      const stringSize = tostring(element.value).size();
      currentSize += stringSize + defaultStringSize;
      break;
    }
    case BufferByteType.bool:
      currentSize += 1;
      break;
    case BufferByteType.vec:
      currentSize += 4 * 3;
      break;
    }
  }

  const bfr = buffer.create(currentSize);

  for (const element of bufferQueue) {
    switch (element.type) {
    case BufferByteType.u8:
      buffer.writeu8(bfr, currentOffset, element.value as number);
      currentOffset += 1;
      break;
    case BufferByteType.i8:
      buffer.writei8(bfr, currentOffset, element.value as number);
      currentOffset += 1;
      break;
    case BufferByteType.u16:
      buffer.writeu16(bfr, currentOffset, element.value as number);
      currentOffset += 2;
      break;
    case BufferByteType.i16:
      buffer.writei16(bfr, currentOffset, element.value as number);
      currentOffset += 2;
      break;
    case BufferByteType.u32:
      buffer.writeu32(bfr, currentOffset, element.value as number);
      currentOffset += 4;
      break;
    case BufferByteType.i32:
      buffer.writei32(bfr, currentOffset, element.value as number);
      currentOffset += 4;
      break;
    case BufferByteType.f32:
      buffer.writef32(bfr, currentOffset, element.value as number);
      currentOffset += 4;
      break;
    case BufferByteType.u64: {
      const low = (element.value as number % 2 ^ 32);
      const high = math.floor(element.value as number / 2 ^ 32);

      buffer.writeu32(bfr, currentOffset, low);
      buffer.writeu32(bfr, currentOffset + 4, high);
      currentOffset += 8;
      break;
    }
    case BufferByteType.f64:
      buffer.writef64(bfr, currentOffset, element.value as number);
      currentOffset += 8;
      break;
    case BufferByteType.str: {
      const stringValue = tostring(element.value);
      const stringSize = stringValue.size();

      buffer.writeu16(bfr, currentOffset, stringSize);
      currentOffset += defaultStringSize;

      buffer.writestring(bfr, currentOffset, stringValue);
      currentOffset += stringSize;
      break;
    }
    case BufferByteType.bool:
      buffer.writeu8(bfr, currentOffset, element.value === true ? 255 : 0);
      currentOffset += 1;
      break;
    case BufferByteType.vec: {
      const x = (element.value as vector).x;
      const y = (element.value as vector).y;
      const z = (element.value as vector).z;
      const addOffset = 4;

      buffer.writef32(bfr, currentOffset, x);
      buffer.writef32(bfr, currentOffset + addOffset, y);
      buffer.writef32(bfr, currentOffset + (addOffset * 2), z);

      currentOffset += (addOffset * 3);
      break;
    }
    }
  }

  bufferQueue.clear();
  bufferCreationThreads.delete(thread);
  return bfr;
}
