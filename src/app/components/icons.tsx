import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function LogoIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="512" height="512">
		<defs>
			<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
			<stop offset="0" stop-color="#7C5CFF"/>
			<stop offset="1" stop-color="#22D3EE"/>
			</linearGradient>
		</defs>
		<rect x="16" y="58" width="224" height="140" rx="30" fill="#15171C"/>
		<g fill="#fff" fill-opacity=".9">
			<rect x="42" y="78" width="28" height="28" rx="7"/>
			<rect x="78" y="78" width="28" height="28" rx="7"/>
			<rect x="114" y="78" width="28" height="28" rx="7"/>
			<rect x="150" y="78" width="28" height="28" rx="7"/>
			<rect x="186" y="78" width="28" height="28" rx="7"/>
			<rect x="42" y="114" width="28" height="28" rx="7"/>
			<rect x="78" y="114" width="28" height="28" rx="7"/>
			<rect x="150" y="114" width="28" height="28" rx="7"/>
			<rect x="186" y="114" width="28" height="28" rx="7"/>
			<rect x="42" y="150" width="28" height="28" rx="7"/>
			<rect x="78" y="150" width="100" height="28" rx="7"/>
			<rect x="186" y="150" width="28" height="28" rx="7"/>
		</g>
		<rect x="114" y="114" width="28" height="28" rx="7" fill="url(#g)"/>
	</svg>
  );
}

export function DeviceIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="6" y="6" width="12" height="12" rx="2" />
      <path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />
    </Icon>
  );
}

export function ProfilesIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 13 9 5 9-5" />
    </Icon>
  );
}

export function KeymapIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </Icon>
  );
}

export function LightingIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Icon>
  );
}

export function BatteryIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2" y="7" width="17" height="10" rx="2" />
      <path d="M22 11v2M6 10v4M10 10v4" />
    </Icon>
  );
}

export function ActivityIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 12h4l3-8 4 16 3-8h4" />
    </Icon>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
    </Icon>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" />
    </Icon>
  );
}

export function MonitorIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </Icon>
  );
}

export function RefreshIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8" />
      <path d="M4 3v5h5" />
      <path d="M4 13a8 8 0 0 0 14.3 4.9L20 16" />
      <path d="M20 21v-5h-5" />
    </Icon>
  );
}

export function PlugIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-12 0V8ZM12 17v5" />
    </Icon>
  );
}
