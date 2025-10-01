"use client";

// import { signOutAction } from "@/features/auth/services/client-auth.service";
// import { getBase64UserAvatar } from "@/features/common/providers/alfresco-api.provider";
import { Dropdown, Spinner } from "flowbite-react";
import { signOut, useSession } from "next-auth/react";
import { UserDropdownProps } from "./user-dropdown.types";
import { useRouter } from "next/navigation";

export default function UserDropdown({ messages }: UserDropdownProps) {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      // Redirect to login page
    },
  });

  const router = useRouter();

  if (status === "loading") {
    return <Spinner aria-label="Default status example" />;
  }

  async function handleSignOut() {
    await signOut({ redirect: false });
    router.replace("/sign-in");
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
      label={
        <span className="flex items-center text-sm gap-3">
          <span className="sr-only">User menu</span>
          <div className="relative border flex text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 justify-center items-center transition-all duration-300 rounded-full h-10 w-10 flex-shrink-0">
            {session.user?.name ? session.user.name[0] : ""}
          </div>
          {/*
            <Avatar alt="" img="/app/api/user/-me-/avatar" rounded size="sm" />
            */}
          <span className="dark:text-gray-400 hidden">
            {session.user?.name}
          </span>
        </span>
      }
    >
      <Dropdown.Header className="px-4 py-3">
        <span className="block text-sm">{session.user?.name}</span>
        <span className="block truncate text-sm font-medium">
          {session.user?.email}
        </span>
      </Dropdown.Header>
      {/* <Dropdown.Item>Dashboard</Dropdown.Item>
      <Dropdown.Item>Settings</Dropdown.Item>
      <Dropdown.Item>Earnings</Dropdown.Item> */}
      {/* <Dropdown.Divider /> */}
      <Dropdown.Item onClick={handleSignOut}>
        {messages.signOutLabel}
      </Dropdown.Item>
    </Dropdown>
  );
}
