export class RazerWriteNotVerifiedError extends Error {
  constructor(settingNames: readonly string[]) {
    super(`The keyboard did not keep the new ${settingNames.join(" and ")}.`);
    this.name = "RazerWriteNotVerifiedError";
  }
}

export interface WrittenSetting {
  readonly name: string;
  readonly kept: boolean;
}

export function assertSettingsKept(settings: readonly WrittenSetting[]): void {
  const notKept = settings.filter((setting) => !setting.kept).map((setting) => setting.name);
  if (notKept.length > 0) throw new RazerWriteNotVerifiedError(notKept);
}
