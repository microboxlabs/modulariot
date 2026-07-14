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
    stepOrganizationTitle: dict("pages.login.register.steps.organization.title"),
    stepOrganizationSubtitle: dict(
      "pages.login.register.steps.organization.subtitle"
    ),
    organizationNameLabel: dict(
      "pages.login.register.fields.organizationName.label"
    ),
    organizationNamePlaceholder: dict(
      "pages.login.register.fields.organizationName.placeholder"
    ),
    teamNameLabel: dict("pages.login.register.fields.teamName.label"),
    teamNamePlaceholder: dict("pages.login.register.fields.teamName.placeholder"),
    teamNameSsoLabel: dict("pages.login.register.fields.teamName.sso"),
    teamNameInvalidMessage: dict(
      "pages.login.register.fields.teamName.invalid"
    ),
    organizationLocationLabel: dict(
      "pages.login.register.fields.organizationLocation.label"
    ),
    organizationLocationPlaceholder: dict(
      "pages.login.register.fields.organizationLocation.placeholder"
    ),
    organizationLocationNoResults: dict(
      "pages.login.register.fields.organizationLocation.noResults"
    ),
    organizationPhoneLabel: dict(
      "pages.login.register.fields.organizationPhone.label"
    ),
    organizationPhonePlaceholder: dict(
      "pages.login.register.fields.organizationPhone.placeholder"
    ),
    organizationSizeLabel: dict(
      "pages.login.register.fields.organizationSize.label"
    ),
    industryLabel: dict("pages.login.register.fields.industry.label"),
    industryOtherPlaceholder: dict(
      "pages.login.register.fields.industry.otherPlaceholder"
    ),
    monitoringInterestLabel: dict(
      "pages.login.register.fields.monitoringInterest.label"
    ),
    monitoringInterestOtherPlaceholder: dict(
      "pages.login.register.fields.monitoringInterest.otherPlaceholder"
    ),
    optionalLabel: dict("pages.login.register.optionalLabel"),

    stepProfileTitle: dict("pages.login.register.steps.profile.title"),
    stepProfileSubtitle: dict("pages.login.register.steps.profile.subtitle"),
    createAccountWithLabel: dict("pages.login.register.createAccountWith"),
    dividerText: dict("pages.login.divider"),
    fullNameLabel: dict("pages.login.register.fields.fullName.label"),
    fullNamePlaceholder: dict("pages.login.register.fields.fullName.placeholder"),
    emailLabel: dict("pages.login.fields.email.label"),
    emailPlaceholder: dict("pages.login.fields.email.placeholder"),

    stepVerificationTitle: dict("pages.login.register.steps.verification.title"),
    verificationMessage: dict("pages.login.register.steps.verification.message"),
    verifyEmailLabel: dict("pages.login.register.buttons.verifyEmail"),

    nextLabel: dict("pages.login.register.buttons.next"),
    backLabel: dict("pages.login.register.buttons.back"),
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
