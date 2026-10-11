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

export function actionButton(label: string, variant: "primary" | "secondary", onClick: () => void): HTMLButtonElement {
  const button = element("button", `button button--${variant}`, [label]);
  button.type = "button";
  button.addEventListener("click", onClick);
  return button;
}
