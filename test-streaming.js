// Test script to check if StreamHub API supports true streaming
// Run with: node test-streaming.js

const https = require("https");

const url =
  "https://iot.streamhub.cl/api/v1/avl/fleet/streaming/positions?assetId=YOUR_ASSET_ID&startDate=2024-01-01T00:00:00 -0000&endDate=2024-01-01T23:59:59 -0000";

console.log("🔍 Testing StreamHub API streaming capabilities...\n");

https
  .get(
    url,
    {
      headers: {
        Authorization: "Bearer YOUR_TOKEN_HERE",
      },
    },
    (res) => {
      console.log("=== RESPONSE HEADERS ===");
      console.log(`Status: ${res.statusCode}`);
      console.log(`Transfer-Encoding: ${res.headers["transfer-encoding"]}`);
      console.log(`Content-Length: ${res.headers["content-length"]}`);
      console.log(`Content-Type: ${res.headers["content-type"]}\n`);

      if (res.headers["transfer-encoding"] === "chunked") {
        console.log(
          "✅ CHUNKED ENCODING DETECTED - TRUE STREAMING SUPPORTED\n"
        );
      } else {
        console.log("❌ NO CHUNKED ENCODING - DATA SENT ALL AT ONCE\n");
      }

      let chunkCount = 0;
      let totalSize = 0;
      const startTime = Date.now();

      res.on("data", (chunk) => {
        chunkCount++;
        totalSize += chunk.length;
        const elapsed = Date.now() - startTime;
        console.log(
          `📦 Chunk ${chunkCount}: ${chunk.length} bytes (Total: ${totalSize} bytes) at ${elapsed}ms`
        );
      });

      res.on("end", () => {
        const totalTime = Date.now() - startTime;
        console.log(
          `\n🏁 Stream ended: ${chunkCount} chunks, ${totalSize} total bytes in ${totalTime}ms`
        );

        if (chunkCount > 1) {
          console.log("✅ Multiple chunks received - API supports streaming");
        } else {
          console.log("❌ Only one chunk - API sends all data at once");
        }
      });
    }
  )
  .on("error", (err) => {
    console.error("Error:", err);
  });
