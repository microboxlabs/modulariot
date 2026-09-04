export type NavBarMessages = {
  signOutLabel: string;
  search: string;
};

export type SecuredNavBarProps = {
  messages: NavBarMessages;
  isSeachEnabled?: boolean;
  isSidebarToggleEnabled?: boolean;
  isUserMenuEnabled?: boolean;
  /** Server-fetched org logo used as fallback while client-side logos load */
  initialOrgLogo?: string | null;
  /** Threaded down to SpotlightSearch so its results stay in sync with the sidebar's Harness settings gate. */
  isHarnessSettingsEnabled?: boolean;
};
