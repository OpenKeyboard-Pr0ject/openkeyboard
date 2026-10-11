const BITS_PER_BYTE = 8;

export function flattenCollections(collections: readonly HIDCollectionInfo[]): HIDCollectionInfo[] {
  return collections.flatMap((collection) => [collection, ...flattenCollections(collection.children ?? [])]);
}

export function hasCollection(device: HIDDevice, usagePage: number, usage: number): boolean {
  return flattenCollections(device.collections).some(
    (collection) => collection.usagePage === usagePage && collection.usage === usage,
  );
}

export function featureReportByteLength(device: HIDDevice, reportId: number): number {
  const report = flattenCollections(device.collections)
    .flatMap((collection) => collection.featureReports ?? [])
    .find((candidate) => candidate.reportId === reportId);
  const bitLength = (report?.items ?? []).reduce(
    (total, item) => total + (item.reportSize ?? 0) * (item.reportCount ?? 0),
    0,
  );
  return Math.ceil(bitLength / BITS_PER_BYTE);
}
