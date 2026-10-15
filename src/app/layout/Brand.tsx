import { LogoIcon } from "../components/icons";

export function Brand({ logoSize = 36 }: { readonly logoSize?: number }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoIcon size={logoSize} />
      <span className="text-lg font-bold text-strong">OpenKeyboard</span>
    </span>
  );
}
