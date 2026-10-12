import { XzReadableStream } from "xz-decompress";

export async function decompressXzText(compressed: Uint8Array): Promise<string> {
  const compressedStream = new Blob([compressed.slice()]).stream();
  return new Response(new XzReadableStream(compressedStream)).text();
}
