import { showcaseHue, showcaseLayout } from "./showcase-layout";

const LAYOUT = showcaseLayout();
const KEY_GAP_CQW = 0.35;
const GLOW_CLASSES = "pointer-events-none absolute -inset-x-16 -inset-y-10 rounded-full bg-accent-soft blur-3xl";

export function KeyboardShowcase() {
  return (
    <div className="relative w-full max-w-[880px]">
      <div aria-hidden="true" className={GLOW_CLASSES} />
      <div
        role="img"
        aria-label="A keyboard with rainbow lighting"
        className="relative rounded-xl bg-case p-[2.2%] shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
      >
        <div
          className="@container relative w-full motion-safe:animate-rgb-cycle"
          style={{ aspectRatio: `${LAYOUT.width} / ${LAYOUT.height}` }}
        >
          {LAYOUT.keys.map((key) => {
            const hue = showcaseHue(key, LAYOUT);
            return (
              <span
                key={`${key.x}-${key.y}`}
                className="absolute"
                style={{
                  left: `${(key.x / LAYOUT.width) * 100}%`,
                  top: `${(key.y / LAYOUT.height) * 100}%`,
                  width: `${(key.width / LAYOUT.width) * 100}%`,
                  height: `${(key.height / LAYOUT.height) * 100}%`,
                  padding: `${KEY_GAP_CQW}cqw`,
                }}
              >
                <span
                  className={[
                    "flex h-full w-full items-start rounded-[0.6cqw] bg-keycap px-[0.7cqw] py-[0.5cqw]",
                    "text-[clamp(6px,1.05cqw,12px)] leading-none font-semibold text-keycap-legend",
                  ].join(" ")}
                  style={{
                    boxShadow: [
                      `inset 0 0 0 1.5px hsl(${hue} 90% 58%)`,
                      `0 0 1.2cqw hsl(${hue} 90% 58% / 0.45)`,
                      "inset 0 -0.35cqw 0 rgba(0, 0, 0, 0.35)",
                    ].join(", "),
                  }}
                >
                  {key.label}
                </span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
