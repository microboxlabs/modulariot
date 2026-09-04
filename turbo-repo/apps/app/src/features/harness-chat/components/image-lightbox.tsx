"use client";

import { Modal, ModalBody } from "flowbite-react";
import type { FC } from "react";

// Frameless, near-fullscreen chrome — this is a plain image viewer, not a
// form/content modal, so the default header/footer/padding don't apply.
// Mirrors the override recipe already used by the geographic-view image
// viewer (root/content/body only, no header/footer).
const lightboxTheme = {
  root: {
    base: "fixed inset-0 z-[100] h-full w-full overflow-hidden",
  },
  content: {
    base: "relative h-full w-full p-4 md:h-auto",
    inner: "relative flex max-h-[90vh] items-center justify-center rounded-lg bg-transparent shadow-none",
  },
  body: {
    base: "flex items-center justify-center p-0",
  },
};

/**
 * Click-to-enlarge viewer for an image — used for both a sent attachment in
 * the message history and a pending attachment in the composer. `src` also
 * doubles as the open/closed flag: null means closed.
 */
export const ImageLightbox: FC<{
  src: string | null;
  alt: string;
  onClose: () => void;
}> = ({ src, alt, onClose }) => (
  <Modal dismissible show={src !== null} onClose={onClose} size="5xl" theme={lightboxTheme}>
    <ModalBody>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="max-h-[85vh] max-w-full rounded-lg object-contain" />
      )}
    </ModalBody>
  </Modal>
);
