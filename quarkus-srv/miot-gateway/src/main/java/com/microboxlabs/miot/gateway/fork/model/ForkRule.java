package com.microboxlabs.miot.gateway.fork.model;

import java.util.List;
import java.util.Optional;

/**
 * Resolved fork rule — built from ForkConfig at startup, immutable at runtime.
 *
 * <p>A rule matches one or more incoming paths, extracts a routing key from the
 * request body using the specified parser, checks the key against the in-memory
 * filter, and fans out matching requests to all configured targets.
 */
public record ForkRule(
        String id,
        boolean enabled,
        List<String> paths,
        BodyParserType bodyParser,
        String keyField,
        Optional<String> filterFile,
        List<ForkTarget> targets
) {}
