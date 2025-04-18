import React from "react";

export function GroupAllowed({
  children,
  userGroups,
  allowedTo,
  joinOperator = "OR",
}: {
  children: React.ReactNode;
  userGroups: string[];
  allowedTo: string[];
  joinOperator?: "OR" | "AND";
}) {
  const isAllowed =
    joinOperator === "OR"
      ? allowedTo.some((group) => userGroups.includes(group))
      : allowedTo.every((group) => userGroups.includes(group));

  return <>{isAllowed ? children : null}</>;
}
