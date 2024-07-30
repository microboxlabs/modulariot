export type SignInPageProps = {
  params: {
    lang: string;
  };
};

export type FooterSignInProps = {
  messages: (path: string, params?: Record<string, string>) => string;
};
