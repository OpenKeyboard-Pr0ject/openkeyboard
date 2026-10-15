import type { KeyboardIdentity } from "../../drivers/keyboard-driver";
import { formatHex } from "../../shared/hex";
import { Badge } from "../components/feedback";
import { KeyboardIcon } from "../components/icons";

export function DeviceBar({ identity }: { readonly identity: KeyboardIdentity }) {
  const ids = `${formatHex(identity.vendorId, 4)}:${formatHex(identity.productId, 4)}`;
  return (
    <header className="flex flex-wrap items-center gap-4 rounded-lg bg-panel px-4 py-3 md:min-h-20 md:px-5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sunken ring-2 ring-accent">
        <KeyboardIcon width={22} height={22} className="text-strong" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="m-0 truncate text-base font-bold text-strong" title={identity.productName}>
          {identity.productName}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <Badge>{identity.vendorName}</Badge>
          <Badge>Firmware {identity.firmwareVersion}</Badge>
          <Badge>{ids}</Badge>
        </div>
      </div>
      <Badge tone={identity.hardwareVerified ? "positive" : "warning"}>
        {identity.hardwareVerified ? "Verified on hardware" : "Not yet verified on hardware"}
      </Badge>
    </header>
  );
}
