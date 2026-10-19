import { generateStaticParamsFor, importPage } from 'nextra/pages'
import { useMDXComponents as getMDXComponents } from '../../../../mdx-components'

const allParams = generateStaticParamsFor('mdxPath')

// Product pages live under content/<lang>/products; this route owns them.
export async function generateStaticParams() {
  const params = await allParams()
  return params
    .filter(({ mdxPath }) => mdxPath?.[0] === 'products')
    .map(({ lang, mdxPath }) => ({ lang, mdxPath: mdxPath.slice(1) }))
}

const contentPath = (mdxPath) => ['products', ...(mdxPath ?? [])]

export async function generateMetadata(props) {
  const params = await props.params
  const { metadata } = await importPage(contentPath(params.mdxPath), params.lang)
  return metadata
}

const Wrapper = getMDXComponents().wrapper

export default async function Page(props) {
  const params = await props.params
  const {
    default: MDXContent,
    toc,
    metadata,
    sourceCode
  } = await importPage(contentPath(params.mdxPath), params.lang)
  return (
    <Wrapper toc={toc} metadata={metadata} sourceCode={sourceCode}>
      <MDXContent {...props} params={params} />
    </Wrapper>
  )
}
