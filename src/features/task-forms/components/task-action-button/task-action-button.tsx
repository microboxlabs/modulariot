"use client";

import { Button } from "flowbite-react";
import { HiCheck } from "react-icons/hi";
import { TaskActionButtonProps } from "./task-action-button.types";

export default function TaskActionButton({
  label,
  onClick,
  fluid = false,
}: TaskActionButtonProps) {
  return (
    <Button
      size="md"
      color="blue"
      onClick={onClick}
      className={`lg:w-1/2 h-10 ${fluid ? "w-full" : ""}`}
    >
      <HiCheck className="mr-2 h-5 w-5" />
      {label}
    </Button>
  );
}
