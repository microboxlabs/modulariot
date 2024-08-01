export type SignInCredentials = {
  email: string;
  password: string;
};

export type AuthenticateActionState = {
  success?: boolean;
  message?: string;
  status?: number;
};
