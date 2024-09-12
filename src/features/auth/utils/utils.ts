import { MessagesType } from "@/features/i18n/i18n.service.types";
import type { FormSignInMessages } from "../components/form-sign-in/form-sign-in.types";

export function buildSignInFormMessages({
  messages: dict,
}: MessagesType): FormSignInMessages {
  return {
    emailPlaceHolder: dict("pages.login.fields.email.placeholder"),
    emailLabel: dict("pages.login.fields.email.label"),
    passwordLabel: dict("pages.login.fields.password.label"),
    rememberMeLabel: dict("pages.login.fields.remember.label"),
    forgotPasswordLabel: dict("pages.login.fields.forgot.label"),
    buttonSubmitLabel: dict("pages.login.buttons.submit"),
    invalidCredentials: dict("pages.login.errors.invalidCredentials"),
  };
}
