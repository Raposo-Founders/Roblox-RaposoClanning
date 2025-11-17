import { BufferByteType } from "./bufferwriter";

// # Constants

const bufferReadingStructure = {
  [BufferByteType["u8"]]: (b: buffer, offset: number, setOffset: Callback) => {
    const data = buffer.readu8(b, offset);

    setOffset(offset + 1);
    return data;
  },
  [BufferByteType["i8"]]: (b: buffer, offset: number, setOffset: Callback) => {
    const data = buffer.readi8(b, offset);

    setOffset(offset + 1);
    return data;
  },
  [BufferByteType["u16"]]: (b: buffer, offset: number, setOffset: Callback) => {
    const data = buffer.readu16(b, offset);

    setOffset(offset + 2);
    return data;
  },
  [BufferByteType["i16"]]: (b: buffer, offset: number, setOffset: Callback) => {
    const data = buffer.readi16(b, offset);

    setOffset(offset + 2);
    return data;
  },
  [BufferByteType["u32"]]: (b: buffer, offset: number, setOffset: Callback) => {
    const data = buffer.readu32(b, offset);

    setOffset(offset + 4);
    return data;
  },
  [BufferByteType["i32"]]: (b: buffer, offset: number, setOffset: Callback) => {
    const data = buffer.readi32(b, offset);

    setOffset(offset + 4);
    return data;
  },
  [BufferByteType["f32"]]: (b: buffer, offset: number, setOffset: Callback) => {
    const data = buffer.readf32(b, offset);

    setOffset(offset + 4);
    return data;
  },
  [BufferByteType["u64"]]: (b: buffer, offset: number, setOffset: Callback) => {
    const low = buffer.readu32(b, offset);
    const high = buffer.readu32(b, offset + 4);

    setOffset(offset + 8);
    return high * 2^32 + low;
  },
  [BufferByteType["f64"]]: (b: buffer, offset: number, setOffset: Callback) => {
    const data = buffer.readf64(b, offset);

    setOffset(offset + 8);
    return data;
  },
  [BufferByteType["bool"]]: (b: buffer, offset: number, setOffset: Callback) => {
    const data = buffer.readu8(b, offset) === 255;

    setOffset(offset + 1);
    return data;
  },
  [BufferByteType["str"]]: (b: buffer, offset: number, setOffset: Callback) => {
    const size = buffer.readi16(b, offset);
    offset += 2;

    const data = buffer.readstring(b, offset, size);

    setOffset(offset + size);
    return data;
  },
  [BufferByteType["vec"]]: (b: buffer, offset: number, setOffset: Callback) => {
    const addOffset = 4;

    const x = buffer.readf32(b, offset);
    const y = buffer.readf32(b, offset + addOffset);
    const z = buffer.readf32(b, offset + (addOffset * 2));
    const data = vector.create(x, y, z);

    setOffset(offset + (addOffset * 3));
    return data;
  },
};

// # Functions
export function BufferReader(bfr: buffer) {
  let currentOffset = 0;
  const setOffset = (newOffset: number) => currentOffset = newOffset;

  const stContent = {
    u8: () => bufferReadingStructure[BufferByteType.u8](bfr, currentOffset, setOffset),
    i8: () => bufferReadingStructure[BufferByteType.i8](bfr, currentOffset, setOffset),
    u16: () => bufferReadingStructure[BufferByteType.u16](bfr, currentOffset, setOffset),
    i16: () => bufferReadingStructure[BufferByteType.i16](bfr, currentOffset, setOffset),
    u32: () => bufferReadingStructure[BufferByteType.u32](bfr, currentOffset, setOffset),
    i32: () => bufferReadingStructure[BufferByteType.i32](bfr, currentOffset, setOffset),
    f32: () => bufferReadingStructure[BufferByteType.f32](bfr, currentOffset, setOffset),
    u64: () => bufferReadingStructure[BufferByteType.u64](bfr, currentOffset, setOffset),
    f64: () => bufferReadingStructure[BufferByteType.f64](bfr, currentOffset, setOffset),
    bool: () => bufferReadingStructure[BufferByteType.bool](bfr, currentOffset, setOffset),
    string: () => bufferReadingStructure[BufferByteType.str](bfr, currentOffset, setOffset),
    vec: () => bufferReadingStructure[BufferByteType.vec](bfr, currentOffset, setOffset),
  };

  return stContent;
}
