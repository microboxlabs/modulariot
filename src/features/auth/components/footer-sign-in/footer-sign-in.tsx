import { Footer, FooterCopyright } from "flowbite-react";
import { FooterSignInProps } from "./footer-sign-in.types";

export default function FooterSignIn({ messages }: FooterSignInProps) {
  return (
    <Footer
      date-testid="sign-footer"
      className="fixed bottom-3 flex flex-row gap-1 items-center"
      theme={{
        root: {
          base: "w-full md:flex md:items-center md:justify-between",
        },
      }}
    >
      <FooterCopyright
        href="https://microboxlabs.com"
        by={messages("footer.rights")}
        year={2024}
      />
    </Footer>
  );
}
