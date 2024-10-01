import Script from "next/script";
import { useState } from "react";

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

/**
 * AllDepsLoaded is a flag to check if all dependencies have been loaded.
 * We keep this flag in a global variable because this dependencies must be
 * loaded once and only once.
 */
let allDepsLoaded = false;

export default function SovosDeps({ onReady }: { onReady?: () => void }) {
  const [depsIndex, setDepsIndex] = useState(1);

  /**
   * handleDepsLoaded is a function to handle the loading of dependencies.
   * If all dependencies have been loaded, we call the onReady function.
   * We use setTimeout to ensure that the dependencies are loaded before calling
   * in order to avoid race conditions.
   */
  const handleDepsLoaded = () => {
    if (allDepsLoaded) {
      setTimeout(() => {
        onReady?.();
        // console.log("allDepsLoaded", allDepsLoaded);
      }, 100);
    }
  };

  /**
   * We call the handleDepsLoaded function to ensure that the dependencies are
   * already loaded before the SovosVerificationForm component is rendered.
   */
  handleDepsLoaded();

  /**
   * In slow networks, the dependencies may not be loaded in order.
   * To avoid this, we load the dependencies following the order of the array.
   */
  const sliceIndex = depsIndex <= deps.length ? depsIndex : deps.length;
  const depsToLoad = deps.slice(0, sliceIndex);

  if (allDepsLoaded) {
    return null;
  }

  return depsToLoad.map((dep, index) => (
    <Script
      key={index}
      type="text/javascript"
      src={dep}
      onReady={() => {
        setDepsIndex(depsIndex + 1);
        // console.log("depsIndex", depsIndex, "dep", dep);
        if (depsIndex >= deps.length) {
          allDepsLoaded = true;
          handleDepsLoaded();
        }
      }}
    />
  ));
}
