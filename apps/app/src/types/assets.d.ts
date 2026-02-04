// Type declarations for static assets imported via @assets/* path alias
// Using flexible type to support both string and StaticImageData usage patterns

import type { StaticImageData } from "next/image";

// Asset type that supports both direct string usage and .src property access
type AssetModule = string & StaticImageData;

declare module "*.svg" {
  const content: AssetModule;
  export default content;
}

declare module "*.png" {
  const content: AssetModule;
  export default content;
}

declare module "*.jpg" {
  const content: AssetModule;
  export default content;
}

declare module "*.jpeg" {
  const content: AssetModule;
  export default content;
}

declare module "*.gif" {
  const content: AssetModule;
  export default content;
}

declare module "*.webp" {
  const content: AssetModule;
  export default content;
}

declare module "*.ico" {
  const content: AssetModule;
  export default content;
}

// Path alias specific declarations for @assets/*
declare module "@assets/*.svg" {
  const content: AssetModule;
  export default content;
}

declare module "@assets/*.png" {
  const content: AssetModule;
  export default content;
}

declare module "@assets/*.gif" {
  const content: AssetModule;
  export default content;
}

declare module "@assets/*.jpg" {
  const content: AssetModule;
  export default content;
}

declare module "@assets/*.jpeg" {
  const content: AssetModule;
  export default content;
}
