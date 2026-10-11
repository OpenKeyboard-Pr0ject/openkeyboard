export function formatHex(value: number, digits: number): string {
  return `0x${value.toString(16).toUpperCase().padStart(digits, "0")}`;
}
