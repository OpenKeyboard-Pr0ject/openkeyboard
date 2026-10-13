import type { ReactNode } from "react";

export interface Detail {
  readonly label: string;
  readonly value: ReactNode;
}

export function DetailList({ details }: { readonly details: readonly Detail[] }) {
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2.5 text-sm">
      {details.map((detail) => (
        <div key={detail.label} className="contents">
          <dt className="text-muted">{detail.label}</dt>
          <dd className="m-0 tabular-nums text-fg">{detail.value}</dd>
        </div>
      ))}
    </dl>
  );
}
