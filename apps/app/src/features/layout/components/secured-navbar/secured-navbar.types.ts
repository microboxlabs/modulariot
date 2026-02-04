export type NavBarMessages = {
  signOutLabel: string;
  search: string;
};

export type SecuredNavBarProps = {
  messages: NavBarMessages;
  isSeachEnabled?: boolean;
  isSidebarToggleEnabled?: boolean;
  isUserMenuEnabled?: boolean;
};
