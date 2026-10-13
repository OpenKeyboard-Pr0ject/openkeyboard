import { LogoIcon } from "../components/icons";

export function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-on-accent">
        <LogoIcon width={20} height={20} />
      </span>
      <span className="text-base font-semibold tracking-tight text-fg">OpenKeyboard</span>
    </div>
  );
}
