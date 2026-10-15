import { Card } from "../components/Card";
import { LinkCards } from "../components/LinkCards";
import { PageHeader } from "../components/PageHeader";

const PRINCIPLES: ReadonlyArray<readonly [string, string]> = [
  ["Read before writing", "Every change starts from what the keyboard reports, and unknown data is kept as it is."],
  ["Confirmed by reading back", "After saving, the setting is read again and compared with what was sent."],
  ["Verified models only", "Editing is offered only on keyboards whose writes were tested on real hardware."],
];

export function AboutPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="About OpenKeyboard" description="Configure your keyboard without the vendor app." />
      <Card title="How OpenKeyboard keeps your keyboard safe">
        <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-3">
          {PRINCIPLES.map(([title, text]) => (
            <li key={title} className="rounded-lg bg-sunken p-4">
              <p className="m-0 text-base font-bold text-strong">{title}</p>
              <p className="mt-1 mb-0 text-base text-fg">{text}</p>
            </li>
          ))}
        </ul>
      </Card>
      <LinkCards />
    </div>
  );
}
