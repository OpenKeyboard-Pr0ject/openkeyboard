type ElementChild = Node | string;

export function element<Tag extends keyof HTMLElementTagNameMap>(
  tag: Tag,
  className: string,
  children: readonly ElementChild[] = [],
): HTMLElementTagNameMap[Tag] {
  const created = document.createElement(tag);
  created.className = className;
  created.append(...children);
  return created;
}

export function millimeterInput(value: number, range: { min: number; max: number; step: number }): HTMLInputElement {
  const input = element("input", "settings-form__number");
  input.type = "number";
  input.min = String(range.min);
  input.max = String(range.max);
  input.step = String(range.step);
  input.value = value.toFixed(2);
  return input;
}

export function detailRow(label: string, value: string): HTMLElement[] {
  return [element("dt", "details__label", [label]), element("dd", "details__value", [value])];
}

export function actionButton(label: string, variant: "primary" | "secondary", onClick: () => void): HTMLButtonElement {
  const button = element("button", `button button--${variant}`, [label]);
  button.type = "button";
  button.addEventListener("click", onClick);
  return button;
}

export function select(options: ReadonlyArray<readonly [string, string]>, selected: string): HTMLSelectElement {
  const control = element("select", "settings-form__select", options.map(([value, label]) => {
    const option = element("option", "", [label]);
    option.value = value;
    return option;
  }));
  control.value = selected;
  return control;
}

export function formField(labelText: string, control: HTMLElement): HTMLLabelElement {
  return element("label", "settings-form__field", [element("span", "details__label", [labelText]), control]);
}

export function panelMessage(text: string): HTMLElement {
  return element("p", "panel__message", [text]);
}
