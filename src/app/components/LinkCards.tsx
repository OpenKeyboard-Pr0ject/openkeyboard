import type { ComponentType, SVGProps } from "react";
import { PROJECT_LINKS, type ProjectLinkIcon } from "../links";
import { BookIcon, GitHubIcon, IssueIcon } from "./icons";

const LINK_ICONS: Readonly<Record<ProjectLinkIcon, ComponentType<SVGProps<SVGSVGElement>>>> = {
  github: GitHubIcon,
  docs: BookIcon,
  issue: IssueIcon,
};

export function LinkCards() {
  return (
    <ul className="m-0 grid w-full list-none gap-4 p-0 md:grid-cols-3">
      {PROJECT_LINKS.map((link) => {
        const LinkIcon = LINK_ICONS[link.icon];
        return (
          <li key={link.href}>
            <a
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className={[
                "flex h-full items-center gap-3 rounded-lg bg-panel px-4 py-3 text-left no-underline transition",
                "hover:bg-tint focus-visible:outline-2 focus-visible:outline-accent",
              ].join(" ")}
            >
              <LinkIcon width={26} height={26} className="shrink-0 text-strong" />
              <span className="min-w-0">
                <span className="block text-base font-bold text-strong">{link.title}</span>
                <span className="block text-sm text-fg">{link.description}</span>
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
