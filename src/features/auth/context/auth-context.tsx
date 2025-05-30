"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { getGroupsForPerson } from "@/features/common/providers/alfresco-api/alfresco-api.provider";

interface AuthContextType {
  userGroups: string[];
  isLoading: boolean;
  hasPermission: (requiredGroups: string[], operator?: "OR" | "AND") => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [userGroups, setUserGroups] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadUserGroups() {
      if (session?.user?.ticket) {
        try {
          const groups = await getGroupsForPerson(session.user.ticket);
          console.log("groups", groups);
          setUserGroups(groups);
        } catch (error) {
          console.error("Failed to load user groups:", error);
        } finally {
          setIsLoading(false);
        }
      }
    }

    loadUserGroups();
  }, [session?.user?.ticket]);

  const hasPermission = (
    requiredGroups: string[],
    operator: "OR" | "AND" = "OR",
  ) => {
    if (!requiredGroups.length) return true;

    return operator === "OR"
      ? requiredGroups.some((group) => userGroups.includes(group))
      : requiredGroups.every((group) => userGroups.includes(group));
  };

  return (
    <AuthContext.Provider value={{ userGroups, isLoading, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
