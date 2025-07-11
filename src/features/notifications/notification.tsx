/* eslint-disable */
import { toast } from "sonner";
import React from "react";

type NotificationAction =
  | { type: "success"; message: string }
  | { type: "error"; message: string }
  | { type: "warning"; message: string }
  | { type: "info"; message: string }
  | { type: "default"; message: string }
  | { type: "description"; message: string; description: string }
  | {
    type: "action";
    label: string;
    message: string | React.ReactNode;
    onClick: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  }
  | {
    type: "promise";
    promise: Promise<any> | (() => Promise<any>);
    loading: string;
    ok: string;
    error: string;
  };

/**
 * # Show Notification
 * This function displays an especific type of notification based entirely on the action type
 *
 * Remember that this MUST be used in a client component since it should be triggered by
 * an action, submit, button or others.
 *
 * The main sintax is ShowNotification({ type: "success", message: "this is an example" })
 *
 * For special cases like the description, action and promise, the main structure follows the examples of the
 * official documentation in: https://sonner.emilkowal.ski/
 *
 */
export function ShowNotification(action: NotificationAction) {
  switch (action.type) {
    case "success":
      toast.success(action.message);
      break;
    case "error":
      toast.error(action.message);
      break;
    case "warning":
      toast.warning(action.message);
      break;
    case "info":
      toast.warning(action.message);
      break;
    case "description":
      toast.message(action.message, { description: action.description });
      break;
    case "action":
      toast(action.message, {
        action: {
          label: action.label,
          onClick: action.onClick,
        },
      });
      break;
    case "promise":
      toast.promise(action.promise, {
        loading: action.loading,
        success: action.ok,
        error: action.error,
      });
      break;
    default:
      toast(action.message);
  }
}

export function CustomNotification(children: React.ReactNode) {
  toast(children, {
    style: {
      width: "fit-content",
      minWidth: "400px",
      maxWidth: "90vw",
      height: "auto",
      minHeight: "fit-content",
    },
  });
}
