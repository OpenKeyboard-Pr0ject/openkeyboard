import type { ReactNode } from "react";

interface CardProps {
  readonly title?: ReactNode;
  readonly description?: string;
  readonly actions?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
}

export function Card({ title, description, actions, children, className = "" }: CardProps) {
  return (
    <section className={`rounded-lg bg-panel p-5 md:p-6 ${className}`}>
      {(title || actions) && (
        <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {title && <h2 className="m-0 flex items-center gap-2 text-xl font-bold text-strong">{title}</h2>}
            {description && <p className="mt-1 mb-0 text-base text-fg">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function SectionLabel({ children }: { readonly children: ReactNode }) {
  return <h3 className="mt-0 mb-2 text-sm font-bold tracking-wide text-fg uppercase">{children}</h3>;
}
