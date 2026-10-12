const WIRE_VARINT = 0;
const WIRE_FIXED64 = 1;
const WIRE_LENGTH_DELIMITED = 2;
const WIRE_FIXED32 = 5;
const WIRE_TYPE_BITS = 8;
const VARINT_PAYLOAD_BITS = 7;
const VARINT_PAYLOAD_MASK = 0x7f;
const VARINT_CONTINUATION_BIT = 0x80;
const MAX_VARINT_BYTES = 10;

type ProtobufFieldValue = number | Uint8Array;

export class ProtobufDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProtobufDecodeError";
  }
}

class ProtobufCursor {
  private offset = 0;

  constructor(private readonly bytes: Uint8Array) {}

  get done(): boolean {
    return this.offset >= this.bytes.length;
  }

  readVarint(): number {
    let value = 0;
    for (let index = 0; index < MAX_VARINT_BYTES; index += 1) {
      const byte = this.readByte();
      value += (byte & VARINT_PAYLOAD_MASK) * 2 ** (VARINT_PAYLOAD_BITS * index);
      if ((byte & VARINT_CONTINUATION_BIT) === 0) return value;
    }
    throw new ProtobufDecodeError(`A varint is longer than ${MAX_VARINT_BYTES} bytes.`);
  }

  readBytes(length: number): Uint8Array {
    if (this.offset + length > this.bytes.length) {
      throw new ProtobufDecodeError("A field is longer than the remaining message.");
    }
    const slice = this.bytes.slice(this.offset, this.offset + length);
    this.offset += length;
    return slice;
  }

  private readByte(): number {
    if (this.done) throw new ProtobufDecodeError("The message ends in the middle of a varint.");
    const byte = this.bytes[this.offset];
    this.offset += 1;
    return byte;
  }
}

export class ProtobufMessage {
  private constructor(private readonly fields: ReadonlyMap<number, readonly ProtobufFieldValue[]>) {}

  static decode(bytes: Uint8Array): ProtobufMessage {
    const cursor = new ProtobufCursor(bytes);
    const fields = new Map<number, ProtobufFieldValue[]>();
    while (!cursor.done) {
      const tag = cursor.readVarint();
      const fieldNumber = Math.floor(tag / WIRE_TYPE_BITS);
      if (fieldNumber === 0) throw new ProtobufDecodeError("Field number 0 is not valid.");
      fields.set(fieldNumber, [...(fields.get(fieldNumber) ?? []), readFieldValue(cursor, tag % WIRE_TYPE_BITS)]);
    }
    return new ProtobufMessage(fields);
  }

  varint(fieldNumber: number): number {
    const value = this.lastValue(fieldNumber);
    return typeof value === "number" ? value : 0;
  }

  bytes(fieldNumber: number): Uint8Array {
    const value = this.lastValue(fieldNumber);
    return value instanceof Uint8Array ? value : new Uint8Array();
  }

  string(fieldNumber: number): string {
    return new TextDecoder().decode(this.bytes(fieldNumber));
  }

  message(fieldNumber: number): ProtobufMessage {
    return ProtobufMessage.decode(this.bytes(fieldNumber));
  }

  repeatedMessages(fieldNumber: number): ProtobufMessage[] {
    return (this.fields.get(fieldNumber) ?? [])
      .filter((value): value is Uint8Array => value instanceof Uint8Array)
      .map((value) => ProtobufMessage.decode(value));
  }

  packedVarints(fieldNumber: number): number[] {
    const cursor = new ProtobufCursor(this.bytes(fieldNumber));
    const values: number[] = [];
    while (!cursor.done) values.push(cursor.readVarint());
    return values;
  }

  private lastValue(fieldNumber: number): ProtobufFieldValue | undefined {
    return this.fields.get(fieldNumber)?.at(-1);
  }
}

function readFieldValue(cursor: ProtobufCursor, wireType: number): ProtobufFieldValue {
  switch (wireType) {
    case WIRE_VARINT:
      return cursor.readVarint();
    case WIRE_LENGTH_DELIMITED:
      return cursor.readBytes(cursor.readVarint());
    case WIRE_FIXED64:
      return cursor.readBytes(8);
    case WIRE_FIXED32:
      return cursor.readBytes(4);
    default:
      throw new ProtobufDecodeError(`Wire type ${wireType} is not supported.`);
  }
}
