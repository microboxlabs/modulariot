# Trivy remediation (2026-10-10)

The [2026-10-08 Trivy analysis](https://api.github.com/repos/microboxlabs/modulariot/code-scanning/analyses/1918884875)
reported 868 results: 833 OS package findings, 32 application dependency findings,
and three secret detections in the builder image's Maven settings file.

## Changes

- Use UBI's Java 21 runtime image instead of the builder image. Maven and JDK
  build tools are not needed to run the packaged application.
- Apply available UBI package updates during the image build. CI pulls the base
  image and rebuilds the update layer so Docker caching cannot retain old errata.
- Upgrade Quarkus to 3.33.4, which manages patched Jackson 2.21.7, Netty
  4.1.138.Final, and Bouncy Castle 1.86.
- Align OpenTelemetry through its 1.62.0 BOM and update Aircompressor to 2.0.3,
  Async HTTP Client and its Netty utilities to 2.16.1, and BookKeeper's allocator,
  CPU affinity and checksum libraries to 4.17.4. The BookKeeper updates remove
  legacy Commons Configuration and Commons Lang.
- Align Pulsar's client artifacts on maintenance release 3.3.9, which also
  migrates Pulsar's own URI parsing away from legacy Commons Lang.
- Pin the Trivy action, scan the published image digest, and surface scan/upload
  failures in CI. Findings are still reported at every severity; no ignores or
  severity filters have been added.

## Compatibility limits

Async HTTP Client 3.0.14 fixes additional findings, but is not binary compatible
with Pulsar 3.3.x: Pulsar's HTTP lookup calls `setConnectTimeout(int)`, which 3.x
replaced with a `Duration` argument. The compatibility test reproduces the
`NoSuchMethodError` with 3.0.14 and checks HTTP lookup initialization and Pulsar
LZ4/ZSTD compression with the selected dependencies. Upgrading this client to 3.x
requires upgrading and validating the Quarkus/Pulsar connector together.

[CVE-2025-14969](https://github.com/advisories/GHSA-frpp-8pwq-hjrx) is reported
against Hibernate Reactive 3.2.13.Final. The advisory identifies 4.2.1 as fixed.
Do not override this artifact alone: it must remain compatible with the platform's
Hibernate ORM and Quarkus persistence integration. It remains visible pending a
compatible platform upgrade or vendor backport.

The four remaining HTTP client findings are CVE-2026-107227 and CVE-2026-107230
(high), and CVE-2026-107226 and CVE-2026-107228 (medium).

Unfixed UBI findings also remain visible. Rebuild and rescan when Red Hat
publishes security errata; a successful build does not mean the image has zero
vulnerabilities.

## Verification

The final clean Maven verification completed with 1,570 passing tests, 19 skipped,
and no failures or errors. The three dependency compatibility tests passed.
The AMD64 Docker image built successfully. Trivy 0.75.0 reported:

| Findings | Previous published scan | Local rebuilt image |
| --- | ---: | ---: |
| OS package vulnerabilities | 833 | 327 |
| Application dependency vulnerabilities | 32 | 5 |
| Secret detections | 3 | 0 |
| Total | 868 | 332 |

The rebuilt image has zero critical findings, 21 high, 202 medium, and 109 low.
None of its 327 OS findings has a fixed version listed in the scanner database.
Counts compare the October 8 published scan with the October 10 local scan;
databases and vendor advisories may change between scans.

Workflow validation passed with `actionlint -shellcheck=''`; full actionlint
also reports pre-existing shell quoting/style warnings in unchanged scripts.
Native image compilation and a full deployment with external services were not
validated in this change.

## Reproduction

From `quarkus-srv`, run the same `./mvnw clean verify` command and component flags
as the workflow, then build with `docker build --pull --no-cache -t miot-trivy-check .`.
Run `trivy image --format json --output trivy-results.json miot-trivy-check`.
Do not commit the generated image or scanner output. GitHub alerts update after
the workflow publishes and scans the changed image on the default branch.
