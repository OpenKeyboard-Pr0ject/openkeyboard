const BITS_PER_BYTE = 8;

export function flattenCollections(collections: readonly HIDCollectionInfo[]): HIDCollectionInfo[] {
  return collections.flatMap((collection) => [collection, ...flattenCollections(collection.children ?? [])]);
}

export function hasCollection(device: HIDDevice, usagePage: number, usage: number): boolean {
  return flattenCollections(device.collections).some(
    (collection) => collection.usagePage === usagePage && collection.usage === usage,
  );
}

export interface DeclaredReport {
  readonly reportId: number;
  readonly byteLength: number;
}

export class NoFittingOutputReportError extends Error {
  constructor(byteLength: number) {
    super(`The device declares no output report that holds ${byteLength} bytes.`);
    this.name = "NoFittingOutputReportError";
  }
}

export function featureReportByteLength(device: HIDDevice, reportId: number): number {
  const report = flattenCollections(device.collections)
    .flatMap((collection) => collection.featureReports ?? [])
    .find((candidate) => candidate.reportId === reportId);
  return report ? reportByteLength(report) : 0;
}

export function smallestOutputReportHolding(device: HIDDevice, byteLength: number): DeclaredReport {
  const fitting = flattenCollections(device.collections)
    .flatMap((collection) => collection.outputReports ?? [])
    .map((report) => ({ reportId: report.reportId ?? 0, byteLength: reportDataByteLength(report) }))
    .filter((report) => report.byteLength >= byteLength)
    .sort((first, second) => first.byteLength - second.byteLength);
  if (fitting.length === 0) throw new NoFittingOutputReportError(byteLength);
  return fitting[0];
}

function reportByteLength(report: HIDReportInfo): number {
  return byteLengthOf(report.items ?? []);
}

function reportDataByteLength(report: HIDReportInfo): number {
  return byteLengthOf((report.items ?? []).filter((item) => !item.isConstant));
}

function byteLengthOf(items: readonly HIDReportItem[]): number {
  const bitLength = items.reduce((total, item) => total + (item.reportSize ?? 0) * (item.reportCount ?? 0), 0);
  return Math.ceil(bitLength / BITS_PER_BYTE);
}
