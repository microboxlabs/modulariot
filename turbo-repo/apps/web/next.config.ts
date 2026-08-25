import withFlowbiteReact from "flowbite-react/plugin/nextjs";
import createNextIntlPlugin from "next-intl/plugin";
import path from "path";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig = {
  output: "standalone",
  transpilePackages: ["flowbite-react"],
  // La landing vivió bajo el prefijo oculto /alpha-2506 hasta su publicación en
  // la raíz. Se mantiene el redirect permanente para enlaces ya compartidos.
  async redirects() {
    return [
      { source: "/alpha-2506", destination: "/", permanent: true },
      { source: "/alpha-2506/:path*", destination: "/:path*", permanent: true },
    ];
  },
};

// Apply Flowbite last so it resolves next-intl's config function before
// extending it. Applying next-intl last treats the function as an object and
// drops base settings such as `output: "standalone"`.
// Untyped `nextConfig` + cast through `unknown`: the monorepo has two hoisted
// copies of "next" (root + apps/web) with structurally-identical but
// nominally distinct NextConfig types, at both plugin boundaries.
export default withFlowbiteReact(
  withNextIntl(nextConfig as unknown as Parameters<typeof withNextIntl>[0]) as unknown as Parameters<
    typeof withFlowbiteReact
  >[0],
);
