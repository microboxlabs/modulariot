import { Footer, FooterCopyright } from "flowbite-react";
import { FooterSecuredProps } from "./footer-secured.types";

export default function FooterSecuredLayout({ messages }: FooterSecuredProps) {
  return (
    <Footer
      date-testid="secured-footer"
      className="flex-row z-40 h-12 lg:px-5 overflow-auto"
      theme={{
        root: {
          base: "w-full bg-white shadow dark:bg-gray-800 md:flex md:items-center md:justify-between",
        },
      }}
    >
      <FooterCopyright
        className=""
        href="https://microboxlabs.com"
        by={messages("footer.rights")}
        year={2024}
      />
    </Footer>
  );
}
