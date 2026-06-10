"use client";

import {
  Dropdown,
  DropdownHeader,
  DropdownItem,
  Spinner,
} from "flowbite-react";
import { signOut, useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import { UserDropdownProps } from "./user-dropdown.types";
import { getAuth0LogoutUrl } from "@/features/auth/services/auth.service";

async function handleSignOut(lang: string) {
  // Land back on the current-language sign-in page after federated logout.
  const signInUrl = `${globalThis.location.origin}/app/${lang}/sign-in`;

  // Get Auth0 logout URL before signing out of NextAuth
  const auth0LogoutUrl = await getAuth0LogoutUrl(signInUrl);

  // Sign out of NextAuth first
  await signOut({ redirect: false });

  // If Auth0 is configured, redirect to Auth0 logout for federated logout
  if (auth0LogoutUrl) {
    globalThis.location.href = auth0LogoutUrl;
  } else {
    // Fallback to sign-in page if Auth0 is not configured
    globalThis.location.href = signInUrl;
  }
}

export default function UserDropdown({ messages }: UserDropdownProps) {
  const { lang } = useParams<{ lang: string }>();
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      // Redirect to login page
    },
  });

  if (status === "loading") {
    return <Spinner aria-label="Default status example" />;
  }

  // const session = await auth();
  // if (!session) {
  //   return <Dropdown label="Loading..." />;
  // }
  // const base64UserAvatar = await getBase64UserAvatar(session);

  return (
    <Dropdown
      className="rounded"
      arrowIcon={false}
      inline
      renderTrigger={(theme) => {
        return <button className="relative border flex text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 justify-center items-center transition-all duration-300 rounded-full h-10 w-10 flex-shrink-0">
          {session.user?.name ? session.user.name[0] : ""}
        </button>
      }}
      
    >
      <DropdownHeader className="px-4 py-3">
        <span className="block text-sm">{session.user?.name}</span>
        <span className="block truncate text-sm font-medium">
          {session.user?.email}
        </span>
      </DropdownHeader>
      {/* <Dropdown.Item>Dashboard</Dropdown.Item>
      <Dropdown.Item>Settings</Dropdown.Item>
      <Dropdown.Item>Earnings</Dropdown.Item> */}
      {/* <Dropdown.Divider /> */}
      <DropdownItem onClick={() => handleSignOut(lang)}>
        {messages.signOutLabel}
      </DropdownItem>
    </Dropdown>
  );
}
