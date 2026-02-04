// Type declarations for static assets imported via @assets/* path alias
// Next.js image imports resolve to StaticImageData which has src, width, height properties
//
// IMPORTANT: This file must NOT have top-level imports/exports to remain an
// ambient declaration file. Use import() type syntax instead.

// deck.gl/mapbox types (provided by deck.gl but not exported separately)
declare module "@deck.gl/mapbox" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export class MapboxOverlay implements import("react-map-gl").IControl<any> {
    constructor(props: import("@deck.gl/core").DeckProps);
    setProps(props: import("@deck.gl/core").DeckProps): void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onAdd(map: any): HTMLDivElement;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onRemove(map: any): void;
  }
}

declare module "*.svg" {
  const content: import("next/image").StaticImageData;
  export default content;
}

declare module "*.png" {
  const content: import("next/image").StaticImageData;
  export default content;
}

declare module "*.jpg" {
  const content: import("next/image").StaticImageData;
  export default content;
}

declare module "*.jpeg" {
  const content: import("next/image").StaticImageData;
  export default content;
}

declare module "*.gif" {
  const content: import("next/image").StaticImageData;
  export default content;
}

declare module "*.webp" {
  const content: import("next/image").StaticImageData;
  export default content;
}

declare module "*.ico" {
  const content: import("next/image").StaticImageData;
  export default content;
}
