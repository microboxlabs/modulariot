export type FormSignInMessages = {
  emailPlaceHolder: string;
  emailLabel: string;
  passwordLabel: string;
  rememberMeLabel: string;
  forgotPasswordLabel: string;
  buttonSubmitLabel: string;
  invalidCredentials: string;
  invalidFromData: string;
  buttonContinueWithMicrosoft: string;
  buttonContinueWithEmail: string;
};

export type FormSignInProps = {
  messages: FormSignInMessages;
};
