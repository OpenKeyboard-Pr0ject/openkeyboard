import { useState } from "react";
import type {
  DeviceSettings,
  KeyboardDeviceSettingsEditor,
  KeyboardDeviceSettingsReader,
} from "../../../keyboard/device-settings";
import { describeError } from "../../../shared/describe-error";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { DetailList } from "../../components/DetailList";
import { Message, Notice } from "../../components/feedback";
import { RefreshIcon } from "../../components/icons";
import { Field, SelectInput } from "../../components/inputs";
import { PageHeader } from "../../components/PageHeader";
import { formatBattery, formatIdleTimeout, formatPollingRate } from "../../format/device-settings-format";
import { useLoadable } from "../../hooks/use-loadable";
import { deviceSettingsChange, idleTimeoutOptions, pollingRateOptions } from "./device-settings-draft";

const SAVED_NOTICE = "Saved to the keyboard and confirmed by reading it back.";
const FORM_NOTE = "The sleep timer applies in wireless mode. "
  + "Changes are saved on the keyboard and read back to confirm.";

interface DeviceSettingsPageProps {
  readonly reader: KeyboardDeviceSettingsReader;
  readonly editor: KeyboardDeviceSettingsEditor | undefined;
}

export function DeviceSettingsPage({ reader, editor }: DeviceSettingsPageProps) {
  const settings = useLoadable(() => reader.readDeviceSettings());
  const [editing, setEditing] = useState(false);
  const { state } = settings;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Battery and performance"
        description="Battery, polling rate and sleep timer."
        actions={
          <Button size="small" icon={<RefreshIcon width={14} height={14} />} onClick={settings.reload}>
            Refresh
          </Button>
        }
      />
      <Card>
        {state.status === "loading" && <Message>Reading device settings…</Message>}
        {state.status === "failed" && (
          <Message>Could not read the device settings: {describeError(state.error)}</Message>
        )}
        {state.status === "ready" && editing && editor && (
          <DeviceSettingsForm
            current={state.value}
            editor={editor}
            onSaved={(saved) => {
              setEditing(false);
              settings.show(saved, SAVED_NOTICE);
            }}
            onCancel={() => setEditing(false)}
          />
        )}
        {state.status === "ready" && !(editing && editor) && (
          <div className="flex flex-col gap-5">
            {state.notice && <Notice>{state.notice}</Notice>}
            <DetailList
              details={[
                { label: "Battery", value: formatBattery(state.value.battery) },
                { label: "Polling rate", value: formatPollingRate(state.value.pollingRateHz) },
                { label: "Sleep after", value: formatIdleTimeout(state.value.idleTimeoutSeconds) },
              ]}
            />
            {editor && (
              <div>
                <Button variant="primary" onClick={() => setEditing(true)}>
                  Change settings
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

interface DeviceSettingsFormProps {
  readonly current: DeviceSettings;
  readonly editor: KeyboardDeviceSettingsEditor;
  readonly onSaved: (settings: DeviceSettings) => void;
  readonly onCancel: () => void;
}

function DeviceSettingsForm({ current, editor, onSaved, onCancel }: DeviceSettingsFormProps) {
  const [pollingRate, setPollingRate] = useState(String(current.pollingRateHz));
  const [idleTimeout, setIdleTimeout] = useState(String(current.idleTimeoutSeconds));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>();

  const save = async () => {
    const change = deviceSettingsChange(current, Number(pollingRate), Number(idleTimeout));
    if (Object.keys(change).length === 0) {
      setStatus("Nothing changed.");
      return;
    }
    setBusy(true);
    setStatus("Writing to the keyboard…");
    try {
      onSaved(await editor.updateDeviceSettings(change));
    } catch (error) {
      setStatus(`Not saved: ${describeError(error)}`);
      setBusy(false);
    }
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={(event) => event.preventDefault()}>
      <Field label="Polling rate">
        <SelectInput
          label="Polling rate"
          value={pollingRate}
          options={pollingRateOptions(editor)}
          disabled={busy}
          onChange={setPollingRate}
        />
      </Field>
      <Field label="Sleep after">
        <SelectInput
          label="Sleep after"
          value={idleTimeout}
          options={idleTimeoutOptions(editor, current.idleTimeoutSeconds)}
          disabled={busy}
          onChange={setIdleTimeout}
        />
      </Field>
      <Message>{FORM_NOTE}</Message>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" disabled={busy} onClick={() => void save()}>
          Save to keyboard
        </Button>
        <Button disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
      </div>
      {status && <Message>{status}</Message>}
    </form>
  );
}
