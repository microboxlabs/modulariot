import Script from "next/script";

const deps = [
  "/app/autentia/jquery-2.1.4.min.js",
  "/app/autentia/json2.js",
  "/app/autentia/blockui.js",
  "/app/autentia/jsbn.js",
  "/app/autentia/jsbn2.js",
  "/app/autentia/rsa.js",
  "/app/autentia/rsa2.js",
  "/app/autentia/base64.js",
  "/app/autentia/crypto-1.1.min.js",
  "/app/autentia/yahoo-min.js",
  "/app/autentia/core.js",
  "/app/autentia/md5.js",
  "/app/autentia/sha1.js",
  "/app/autentia/sha256.js",
  "/app/autentia/ripemd160.js",
  "/app/autentia/x64-core.js",
  "/app/autentia/sha512.js",
  "/app/autentia/rsapem-1.1.min.js",
  "/app/autentia/rsasign-1.2.min.js",
  "/app/autentia/asn1hex-1.1.min.js",
  "/app/autentia/x509-1.1.min.js",
  "/app/autentia/pluginautentiav3.js",
];
let pendingLoader = deps.length;
export default function SovosDeps({ onReady }: { onReady?: () => void }) {
  if (pendingLoader === 0) {
    // console.log("All deps are ready");
    onReady?.();
    return;
  }

  return deps.map((dep, index) => (
    <Script
      key={index}
      type="text/javascript"
      src={dep}
      onReady={() => {
        // console.log(`${dep} ready`);
        if (--pendingLoader === 0) {
          onReady?.();
        }
      }}
    />
  ));
}
