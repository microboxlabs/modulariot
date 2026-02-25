"use client";

import { Button } from "flowbite-react";
import { HiCheck } from "react-icons/hi";
import { TaskActionButtonProps } from "./task-action-button.types";

export default function TaskActionButton({
  label,
  onClick,
  fluid = false,
  disabled = false,
}: TaskActionButtonProps) {
  return (
    <Button
      size="md"
      color="blue"
      disabled={disabled}
      onClick={onClick}
      className={`h-10 rounded-l-none w-full ${fluid ? "" : ""}`}
    >
      <HiCheck className="mr-2 h-5 w-5" />
      {label}
    </Button>
  );
}
