import nextra from 'nextra'

 
// Set up Nextra with its configuration
const withNextra = nextra({
  // ... Add Nextra-specific options here
  search: {
    codeblocks: false,
  }
})
 
// Export the final Next.js config with Nextra included
export default withNextra({
  // ... Add regular Next.js options here
  turbopack: {
    resolveAlias: {
      'next-mdx-import-source-file': './mdx-components.js'
    }
  }
})