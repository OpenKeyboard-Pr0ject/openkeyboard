export interface AppBranding {
  readonly tagline: string;
  readonly footnote: string;
}

export const BROWSER_BRANDING: AppBranding = {
  tagline: "Configure your keyboard from the browser. No vendor app required.",
  footnote: "Works in Chrome and Edge on desktop through WebHID.",
};
