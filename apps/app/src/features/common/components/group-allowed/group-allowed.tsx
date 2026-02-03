import React from "react";

export function GroupAllowed({
  children,
  userGroups,
  allowedTo,
  notAllowedTo,
  joinOperator = "OR",
}: {
  children: React.ReactNode;
  userGroups: string[];
  allowedTo?: string[];
  notAllowedTo?: string[];
  joinOperator?: "OR" | "AND";
}) {
  let isAllowed = false;

  if (allowedTo) {
    isAllowed =
      joinOperator === "OR"
        ? allowedTo.some((group) => userGroups.includes(group))
        : allowedTo.every((group) => userGroups.includes(group));
  }

  if (notAllowedTo) {
    isAllowed =
      joinOperator === "OR"
        ? !notAllowedTo.some((group) => userGroups.includes(group))
        : !notAllowedTo.every((group) => userGroups.includes(group));
  }
  return <>{isAllowed ? children : null}</>;
}
