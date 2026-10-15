const WIRE_VARINT = 0;
const WIRE_FIXED64 = 1;
const WIRE_LENGTH_DELIMITED = 2;
const WIRE_FIXED32 = 5;
const WIRE_TYPE_RANGE = 8;
const VARINT_PAYLOAD_BITS = 7;
const VARINT_PAYLOAD_RANGE = 0x80;
const VARINT_PAYLOAD_MASK = 0x7f;
const VARINT_CONTINUATION_BIT = 0x80;
const MAX_VARINT_BYTES = 10;

type ProtobufFieldValue = number | Uint8Array;

interface ProtobufField {
  readonly fieldNumber: number;
  readonly wireType: number;
  readonly value: ProtobufFieldValue;
}

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
  private constructor(private readonly fields: readonly ProtobufField[]) {}

  static decode(bytes: Uint8Array): ProtobufMessage {
    const cursor = new ProtobufCursor(bytes);
    const fields: ProtobufField[] = [];
    while (!cursor.done) {
      const tag = cursor.readVarint();
      const fieldNumber = Math.floor(tag / WIRE_TYPE_RANGE);
      const wireType = tag % WIRE_TYPE_RANGE;
      if (fieldNumber === 0) throw new ProtobufDecodeError("Field number 0 is not valid.");
      fields.push({ fieldNumber, wireType, value: readFieldValue(cursor, wireType) });
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
    return this.valuesOf(fieldNumber)
      .filter((value): value is Uint8Array => value instanceof Uint8Array)
      .map((value) => ProtobufMessage.decode(value));
  }

  repeatedVarints(fieldNumber: number): number[] {
    return this.valuesOf(fieldNumber).flatMap((value) => (typeof value === "number" ? [value] : unpackVarints(value)));
  }

  static empty(): ProtobufMessage {
    return new ProtobufMessage([]);
  }

  fieldNumbers(): number[] {
    return [...new Set(this.fields.map((field) => field.fieldNumber))];
  }

  has(fieldNumber: number): boolean {
    return this.fields.some((field) => field.fieldNumber === fieldNumber);
  }

  withVarint(fieldNumber: number, value: number): ProtobufMessage {
    return this.withField({ fieldNumber, wireType: WIRE_VARINT, value });
  }

  withMessage(fieldNumber: number, message: ProtobufMessage): ProtobufMessage {
    return this.withField({ fieldNumber, wireType: WIRE_LENGTH_DELIMITED, value: message.encode() });
  }

  withRepeatedVarints(fieldNumber: number, values: readonly number[]): ProtobufMessage {
    return this.withRepeated(fieldNumber, values.map((value) => ({ fieldNumber, wireType: WIRE_VARINT, value })));
  }

  withPackedVarints(fieldNumber: number, values: readonly number[]): ProtobufMessage {
    const packed = Uint8Array.from(values.flatMap(encodeVarint));
    return this.withField({ fieldNumber, wireType: WIRE_LENGTH_DELIMITED, value: packed });
  }

  withRepeatedMessages(fieldNumber: number, messages: readonly ProtobufMessage[]): ProtobufMessage {
    return this.withRepeated(
      fieldNumber,
      messages.map((message) => ({ fieldNumber, wireType: WIRE_LENGTH_DELIMITED, value: message.encode() })),
    );
  }

  without(fieldNumber: number): ProtobufMessage {
    return new ProtobufMessage(this.fields.filter((field) => field.fieldNumber !== fieldNumber));
  }

  encode(): Uint8Array<ArrayBuffer> {
    return Uint8Array.from(this.fields.flatMap(encodeField));
  }

  private withField(replacement: ProtobufField): ProtobufMessage {
    const index = this.fields.findIndex((field) => field.fieldNumber === replacement.fieldNumber);
    if (index >= 0) {
      return new ProtobufMessage(this.fields.map((field, position) => (position === index ? replacement : field)));
    }
    const insertAt = insertionIndexFor(this.fields, replacement.fieldNumber);
    return new ProtobufMessage([...this.fields.slice(0, insertAt), replacement, ...this.fields.slice(insertAt)]);
  }

  private withRepeated(fieldNumber: number, replacements: readonly ProtobufField[]): ProtobufMessage {
    const firstIndex = this.fields.findIndex((field) => field.fieldNumber === fieldNumber);
    const remaining = this.fields.filter((field) => field.fieldNumber !== fieldNumber);
    const insertAt = firstIndex >= 0
      ? this.fields.slice(0, firstIndex).filter((field) => field.fieldNumber !== fieldNumber).length
      : insertionIndexFor(remaining, fieldNumber);
    return new ProtobufMessage([...remaining.slice(0, insertAt), ...replacements, ...remaining.slice(insertAt)]);
  }

  private valuesOf(fieldNumber: number): ProtobufFieldValue[] {
    return this.fields.filter((field) => field.fieldNumber === fieldNumber).map((field) => field.value);
  }

  private lastValue(fieldNumber: number): ProtobufFieldValue | undefined {
    return this.valuesOf(fieldNumber).at(-1);
  }
}

function insertionIndexFor(fields: readonly ProtobufField[], fieldNumber: number): number {
  const index = fields.findIndex((field) => field.fieldNumber > fieldNumber);
  return index < 0 ? fields.length : index;
}

function encodeField(field: ProtobufField): number[] {
  const tag = encodeVarint(field.fieldNumber * WIRE_TYPE_RANGE + field.wireType);
  if (typeof field.value === "number") return [...tag, ...encodeVarint(field.value)];
  const lengthPrefix = field.wireType === WIRE_LENGTH_DELIMITED ? encodeVarint(field.value.length) : [];
  return [...tag, ...lengthPrefix, ...field.value];
}

function encodeVarint(value: number): number[] {
  const bytes: number[] = [];
  let remaining = value;
  while (remaining >= VARINT_PAYLOAD_RANGE) {
    bytes.push((remaining % VARINT_PAYLOAD_RANGE) | VARINT_CONTINUATION_BIT);
    remaining = Math.floor(remaining / VARINT_PAYLOAD_RANGE);
  }
  bytes.push(remaining);
  return bytes;
}

function unpackVarints(packed: Uint8Array): number[] {
  const cursor = new ProtobufCursor(packed);
  const values: number[] = [];
  while (!cursor.done) values.push(cursor.readVarint());
  return values;
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
