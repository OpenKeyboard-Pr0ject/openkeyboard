import type { ReactNode } from "react";

export interface Detail {
  readonly label: string;
  readonly value: ReactNode;
}

export function DetailList({ details }: { readonly details: readonly Detail[] }) {
  return (
    <dl className="m-0 divide-y divide-line">
      {details.map((detail) => (
        <div key={detail.label} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-3">
          <dt className="text-base text-muted">{detail.label}</dt>
          <dd className="m-0 text-base font-semibold tabular-nums text-strong">{detail.value}</dd>
        </div>
      ))}
    </dl>
  );
}
