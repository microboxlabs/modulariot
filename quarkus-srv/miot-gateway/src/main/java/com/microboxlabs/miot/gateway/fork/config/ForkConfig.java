package com.microboxlabs.miot.gateway.fork.config;

import com.microboxlabs.miot.gateway.fork.model.BodyParserType;
import io.smallrye.config.ConfigMapping;
import io.smallrye.config.WithDefault;
import java.util.List;
import java.util.Optional;

/**
 * Fork engine configuration.
 *
 * <p>Configure via application.properties or environment variables.
 * For complex rule structures a mounted ConfigMap properties file is recommended.
 *
 * <pre>
 * application.properties                       Env var (MicroProfile naming)
 * ──────────────────────────────────────────── ────────────────────────────────────────
 * fork.enabled                                 FORK_ENABLED
 * fork.rules[0].id                             FORK_RULES_0__ID
 * fork.rules[0].enabled                        FORK_RULES_0__ENABLED
 * fork.rules[0].paths[0]                       FORK_RULES_0__PATHS_0_
 * fork.rules[0].body-parser                    FORK_RULES_0__BODY_PARSER
 * fork.rules[0].key-field                      FORK_RULES_0__KEY_FIELD
 * fork.rules[0].filter-file                    FORK_RULES_0__FILTER_FILE
 * fork.rules[0].targets[0].id                  FORK_RULES_0__TARGETS_0__ID
 * fork.rules[0].targets[0].mirror-host         FORK_RULES_0__TARGETS_0__MIRROR_HOST
 * fork.rules[0].targets[0].mirror-path         FORK_RULES_0__TARGETS_0__MIRROR_PATH
 * fork.rules[0].targets[0].timeout             FORK_RULES_0__TARGETS_0__TIMEOUT
 * </pre>
 *
 * <p>For most deployments, mount a ConfigMap as an application.properties file:
 * <pre>
 * fork.enabled=true
 * fork.rules[0].id=asset-track-canary
 * fork.rules[0].paths[0]=/v1/asset/track
 * fork.rules[0].body-parser=json
 * fork.rules[0].key-field=asset_id
 * fork.rules[0].filter-file=/config/asset-ids.txt
 * fork.rules[0].targets[0].id=storm
 * fork.rules[0].targets[0].mirror-host=https://storm.modulariot.com
 * fork.rules[0].targets[0].mirror-path=/v1/asset/track
 * </pre>
 */
@ConfigMapping(prefix = "fork")
public interface ForkConfig {

    /** Master switch — enable/disable the entire fork engine. */
    @WithDefault("false")
    boolean enabled();

    /**
     * Fork rules. Each rule matches incoming paths, extracts a routing key,
     * checks the in-memory filter, and fans out to one or more targets.
     */
    List<RuleConfig> rules();

    interface RuleConfig {

        /** Unique rule identifier used in metrics and management API. */
        String id();

        /** Whether this rule is active. Disabled rules are ignored at startup. */
        @WithDefault("true")
        boolean enabled();

        /**
         * Incoming paths this rule applies to.
         * All paths in this list trigger the same body parser and target fan-out.
         */
        List<String> paths();

        /**
         * How to parse the request body to extract the routing key.
         * Supported: JSON (default), CSV.
         */
        @WithDefault("json")
        BodyParserType bodyParser();

        /**
         * Field name (JSON) or column name/index (CSV) to extract as the routing key.
         * The extracted value is checked against the in-memory filter.
         */
        @WithDefault("asset_id")
        String keyField();

        /**
         * Path to a plain-text file containing one routing key per line.
         * Lines starting with # and blank lines are ignored.
         * Intended to be mounted as a Kubernetes ConfigMap volume.
         * If absent, the filter starts empty (forward nothing until populated via API).
         */
        Optional<String> filterFile();

        /** Forward targets — all matching targets receive the request in parallel. */
        List<TargetConfig> targets();

        interface TargetConfig {
            /** Unique target identifier used in metrics labels. */
            String id();

            /** Target base URL (scheme + host + optional port), no trailing slash. */
            String mirrorHost();

            /** Path on the target host. Combined with mirrorHost to form the full URL. */
            @WithDefault("/")
            String mirrorPath();

            /** HTTP timeout in milliseconds for forwarded requests. */
            @WithDefault("5000")
            int timeout();
        }
    }
}
