import { Footer, FooterCopyright } from "flowbite-react";
import { FooterSecuredProps } from "./footer-secured.types";
import ReleaseView from "@/features/layout/components/release-view/release-view";

export default function FooterSecuredLayout({ messages }: FooterSecuredProps) {
  return (
    <Footer
      date-testid="secured-footer"
      className="flex z-40 h-12 lg:px-5"
      theme={{
        root: {
          base: "w-full bg-white fixed bottom-0 shadow dark:bg-gray-800 md:flex md:items-center justify-between px-5 py-3",
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
