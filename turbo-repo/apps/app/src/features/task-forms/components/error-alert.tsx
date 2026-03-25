import { Alert } from "flowbite-react";
import {
  AlerceInvolvedObject,
  ErrorWithAlfrescoError,
} from "./task-confirm-modal/task-confirm-modal.types";

export function ErrorAlert({ error }: { error: ErrorWithAlfrescoError }) {
  let message = error.info.error.message;
  if (
    error.info.error.exceptionType === "com.alerce.errors.AlerceTripInitError"
  ) {
    message = (error.info.error.details?.involvedObject as AlerceInvolvedObject)
      ?.respuesta as string;
  }
  return <Alert color="red">{message}</Alert>;
}
