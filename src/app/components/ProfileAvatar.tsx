import { KeyboardIcon } from "./icons";

export function ProfileAvatar({ color, slot }: { readonly color: string; readonly slot?: number }) {
  return (
    <span className="relative shrink-0">
      <span
        className="flex h-10 w-10 items-center justify-center rounded-full bg-panel text-strong"
        style={{ boxShadow: `0 0 0 2px ${color}` }}
      >
        <KeyboardIcon width={20} height={20} />
      </span>
      {slot !== undefined && (
        <span className="absolute -top-1.5 -left-1.5 rounded bg-tint-strong px-1 text-xs font-bold text-strong">
          {slot + 1}
        </span>
      )}
    </span>
  );
}
