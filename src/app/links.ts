export type ProjectLinkIcon = "github" | "docs" | "issue";

export interface ProjectLink {
  readonly title: string;
  readonly description: string;
  readonly href: string;
  readonly icon: ProjectLinkIcon;
}

const REPOSITORY_URL = "https://github.com/OpenKeyboard-Pr0ject/openkeyboard";

export const PROJECT_LINKS: readonly ProjectLink[] = [
  {
    title: "View the source on GitHub",
    description: "OpenKeyboard is open source under AGPL-3.0",
    href: REPOSITORY_URL,
    icon: "github",
  },
  {
    title: "Read the documentation",
    description: "Protocols, safety rules and open questions",
    href: `${REPOSITORY_URL}/tree/main/docs`,
    icon: "docs",
  },
  {
    title: "Ask for your keyboard",
    description: "Report bugs or request a keyboard",
    href: `${REPOSITORY_URL}/issues`,
    icon: "issue",
  },
];
