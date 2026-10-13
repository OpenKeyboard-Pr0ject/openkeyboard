import type { KeyboardIdentity } from "../../drivers/keyboard-driver";
import { formatHex } from "../../shared/hex";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { DetailList } from "../components/DetailList";
import { PageHeader } from "../components/PageHeader";

interface DevicePageProps {
  readonly identity: KeyboardIdentity;
  readonly onDisconnect: () => void;
  readonly onForget: () => void;
}

export function DevicePage({ identity, onDisconnect, onForget }: DevicePageProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Device" description={identity.productName} />
      <Card
        actions={
          <>
            <Button size="small" onClick={onDisconnect}>Disconnect</Button>
            <Button size="small" onClick={onForget}>Forget device</Button>
          </>
        }
        title="Identity"
      >
        <DetailList
          details={[
            { label: "Vendor", value: identity.vendorName },
            { label: "Firmware", value: identity.firmwareVersion },
            { label: "Vendor ID", value: formatHex(identity.vendorId, 4) },
            { label: "Product ID", value: formatHex(identity.productId, 4) },
            {
              label: "Support",
              value: identity.hardwareVerified ? "Verified on hardware" : "Not yet verified on hardware",
            },
          ]}
        />
      </Card>
    </div>
  );
}
