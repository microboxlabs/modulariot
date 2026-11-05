package com.microboxlabs.miot.core.iam;

import io.smallrye.mutiny.Uni;
import java.util.UUID;

/** A module can refuse deletion of an IAM team while its own settings still assign that team. */
public interface TeamDeletionGuard {

    Uni<Void> requireUnused(UUID teamId);

    /** Shared transaction lock for team deletion and new module assignments. */
    static String lockKey(UUID teamId) {
        return "iam-team:" + teamId;
    }
}
