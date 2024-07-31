import { Footer, FooterCopyright } from "flowbite-react";
import { FooterSignInProps } from "./footer-sign-in.types";

export default function FooterSignIn({ messages }: FooterSignInProps) {
  return (
    <Footer
      date-testid="sign-footer"
      className="flex flex-row gap-1 items-center"
    >
      <FooterCopyright
        href="https://microboxlabs.com"
        by={messages("footer.rights")}
        year={2024}
      />
    </Footer>
  );
}
