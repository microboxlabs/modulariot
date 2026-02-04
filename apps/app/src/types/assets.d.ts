// Type declarations for static assets imported via @assets/* path alias
// Supports both string usage and .src property access

// Inline type that mimics StaticImageData + string
interface AssetModule {
  src: string;
  height: number;
  width: number;
  blurDataURL?: string;
  blurWidth?: number;
  blurHeight?: number;
}

declare module "*.svg" {
  const content: AssetModule | string;
  export default content;
}

declare module "*.png" {
  const content: AssetModule | string;
  export default content;
}

declare module "*.jpg" {
  const content: AssetModule | string;
  export default content;
}

declare module "*.jpeg" {
  const content: AssetModule | string;
  export default content;
}

declare module "*.gif" {
  const content: AssetModule | string;
  export default content;
}

declare module "*.webp" {
  const content: AssetModule | string;
  export default content;
}

declare module "*.ico" {
  const content: AssetModule | string;
  export default content;
}
