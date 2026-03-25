import { Footer, FooterCopyright } from "flowbite-react";
import { FooterSignInProps } from "./footer-sign-in.types";
import ReleaseView from "@/features/layout/components/release-view/release-view";

export default function FooterSignIn({ messages }: FooterSignInProps) {
  return (
    <Footer
      date-testid="secured-footer"
      className="flex-row z-40 h-12 lg:px-5 fixed left-0 bottom-0"
      theme={{
        root: {
          base: "w-full bg-white fixed bottom-0 shadow dark:bg-gray-800 md:flex md:items-center md:justify-between",
        },
      }}
    >
      <FooterCopyright
        className=""
        href="https://microboxlabs.com"
        by={messages("footer.rights")}
        year={2024}
      />
      <ReleaseView />
    </Footer>
  );
}
