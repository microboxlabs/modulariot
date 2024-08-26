"use client";

import { Button } from "flowbite-react";
import { HiOutlineArrowRight } from "react-icons/hi";
import { TaskActionButtonProps } from "./task-action-button.types";

export default function TaskActionButton({
  label,
  onClick,
}: TaskActionButtonProps) {
  return (
    <Button size="md" color="blue" onClick={onClick}>
      {label}
      <HiOutlineArrowRight className="ml-2 h-5 w-5" />
    </Button>
  );
}
