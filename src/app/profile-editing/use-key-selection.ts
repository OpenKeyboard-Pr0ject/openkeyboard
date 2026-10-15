import { useMemo, useState } from "react";
import type { MatrixKey } from "../../keyboard/matrix-key";
import type { BoardKey } from "./board";

export interface KeySelection {
  readonly selectedIds: ReadonlySet<string>;
  readonly selectedKeys: readonly MatrixKey[];
  toggle(id: string): void;
  selectAll(): void;
  clear(): void;
}

export function useKeySelection(boardKeys: readonly BoardKey[]): KeySelection {
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const selectedKeys = useMemo(
    () => boardKeys.filter((key) => selectedIds.has(key.id)).map((key) => key.matrixKey),
    [boardKeys, selectedIds],
  );
  return {
    selectedIds,
    selectedKeys,
    toggle: (id) => setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    }),
    selectAll: () => setSelectedIds(new Set(boardKeys.map((key) => key.id))),
    clear: () => setSelectedIds(new Set()),
  };
}
