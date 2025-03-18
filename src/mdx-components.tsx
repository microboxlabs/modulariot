import type { MDXComponents } from "mdx/types";

// Based on the nextjs documentation this is needed for reading md or mdx files
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...components,
    h1: ({ children }) => <h1 className="text-2xl font-bold">{children}</h1>,
    h2: ({ children }) => <h2 className="text-xl font-bold">{children}</h2>,
    h3: ({ children }) => <h3 className="text-lg font-bold">{children}</h3>,
    h4: ({ children }) => <h4 className="text-base font-bold">{children}</h4>,
    h5: ({ children }) => <h5 className="text-sm font-bold">{children}</h5>,
    h6: ({ children }) => <h6 className="text-xs font-bold">{children}</h6>,
    p: ({ children }) => <p className="text-base">{children}</p>,
  };
}
