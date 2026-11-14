# Dependency patches

## texture-compressor 1.0.2

The workspace overrides `image-size` to 2.0.3 to fix malformed-image denial of
service vulnerabilities. `texture-compressor` still calls the old default export
with a filename. The patch updates both its TypeScript source and distributed
CLI to use the named `imageSize` export with a file buffer.

The root `postinstall` applies this patch through `patch-package`. Keep it until
an upstream release supports the new API. Run `npm run test:dependencies` from
the workspace root to verify image dimensions through the actual compressor
consumer, malformed ICNS/ZIP rejection, JWT validation, sanitization, cyclic
merges, presentation export, and math rendering.
