"use client";

import React, { createContext, useContext, useEffect } from "react";
import { useUserGroups } from "@/features/common/providers/client-api.provider";

interface AuthContextType {
  userGroups: string[];
  isLoading: boolean;
  hasPermission: (requiredGroups: string[], operator?: "OR" | "AND") => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: userGroups, isLoading } = useUserGroups();

  useEffect(() => {
    console.log("groups", userGroups);
  }, [userGroups]);

  const hasPermission = (
    requiredGroups: string[],
    operator: "OR" | "AND" = "OR",
  ) => {
    if (!requiredGroups.length) return true;

    return operator === "OR"
      ? requiredGroups.some((group) => userGroups?.includes(group))
      : requiredGroups.every((group) => userGroups?.includes(group));
  };

  return (
    <AuthContext.Provider
      value={{
        userGroups: Array.isArray(userGroups) ? userGroups : [],
        isLoading,
        hasPermission,
      }}
    >
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
