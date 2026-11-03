package com.microboxlabs.miot.symptoms.service;

import com.microboxlabs.miot.symptoms.domain.Treatment;
import com.microboxlabs.miot.symptoms.dto.AddActionRequest;
import java.util.Map;

/** What an {@code IGNORE} action does to an engine case: it puts the case on hold. */
public interface IgnoreHolds {

    /** Records the action as sent, on hold nothing. */
    IgnoreHolds NONE = new IgnoreHolds() {
        @Override
        public Checked check(String tenantCode, Treatment treatment, AddActionRequest req) {
            return new Checked(req.durationSeconds(), req.details() == null ? Map.of() : req.details());
        }

        @Override
        public void changed(String tenantCode) {
            // Nothing is held.
        }
    };

    /** The duration and details the action is stored with. */
    record Checked(Integer durationSeconds, Map<String, Object> details) {
    }

    /**
     * Checks an {@code IGNORE} against the case and its level's policy.
     *
     * @throws IllegalArgumentException when the request breaks the policy (400)
     * @throws IllegalStateException when the case is closed or already on hold (409)
     */
    Checked check(String tenantCode, Treatment treatment, AddActionRequest req);

    /** A hold started or ended. */
    void changed(String tenantCode);
}
