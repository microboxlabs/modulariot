import { MessagesType } from "@/features/i18n/i18n.service.types";
import type { FormSignInMessages } from "../components/form-sign-in/form-sign-in.types";
import groups from "../model/groups.json";

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
    invalidFromData: dict("pages.login.errors.invalidFromData"),
    buttonContinueWithMicrosoft: dict(
      "pages.login.buttons.continueWithMicrosoft"
    ),
    buttonContinueWithEmail: dict("pages.login.buttons.continueWithEmail"),
  };
}

export function getMinifiedUserGroups(userGroups: string[]) {
  return userGroups.map((group) => groups[group as keyof typeof groups]);
}

export function getUserGroupLabel(group: string) {
  return Object.keys(groups).find(
    (key) => groups[key as keyof typeof groups] === group
  );
}

export function getUserGroupsLabels(userGroups: string[]) {
  return userGroups.map((group) => getUserGroupLabel(group));
}
