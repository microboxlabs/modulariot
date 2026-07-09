import { MessagesType } from "@/features/i18n/i18n.service.types";
import type {
  FormSignInMessages,
  RegisterFormMessages,
} from "../components/form-sign-in/form-sign-in.types";
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
    requestAccessPrompt: dict("pages.login.requestAccess.prompt"),
    requestAccessLink: dict("pages.login.requestAccess.link"),
    mainTitle: dict("pages.login.welcome"),
    mainSubtitle: dict("pages.login.subtitle"),
    loginTitle: dict("pages.login.credentialsTitle"),
    loginSubtitle: dict("pages.login.credentialsSubtitle"),
  };
}

export function buildRegisterFormMessages({
  messages: dict,
}: MessagesType): RegisterFormMessages {
  return {
    title: dict("pages.login.register.title"),
    subtitle: dict("pages.login.register.subtitle"),
    nameLabel: dict("pages.login.register.fields.name.label"),
    namePlaceholder: dict("pages.login.register.fields.name.placeholder"),
    lastnameLabel: dict("pages.login.register.fields.lastname.label"),
    lastnamePlaceholder: dict(
      "pages.login.register.fields.lastname.placeholder"
    ),
    emailLabel: dict("pages.login.fields.email.label"),
    emailPlaceholder: dict("pages.login.fields.email.placeholder"),
    passwordLabel: dict("pages.login.fields.password.label"),
    confirmPasswordLabel: dict(
      "pages.login.register.fields.confirmPassword.label"
    ),
    submitLabel: dict("pages.login.register.submit"),
    passwordMismatchError: dict("pages.login.register.errors.passwordMismatch"),
    backToLoginLabel: dict("pages.login.requestAccess.backToLogin"),
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
