import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

import withFlowbiteReact from "flowbite-react/plugin/nextjs";


const jiti = createJiti(fileURLToPath(import.meta.url));

// Import env here to validate during build. Using jiti@^1 we can import .ts files :)
jiti.import("./env/server.ts");
jiti.import("./env/client.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@t3-oss/env-nextjs", "@t3-oss/env-core"],
};

export default withFlowbiteReact(nextConfig);
