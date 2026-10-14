package com.microboxlabs.miot.core.iam;

/** The one role every membership has. Ordered from least to most. */
public enum BaseRole {
    /** Reads the organization; module access only through module roles. */
    MEMBER,
    /** Every permission except the explicit-only and owner-only ones. */
    ADMIN,
    /** Every permission except the explicit-only ones. */
    OWNER;

    public boolean atLeast(BaseRole other) {
        return compareTo(other) >= 0;
    }

    public static BaseRole max(BaseRole a, BaseRole b) {
        if (a == null) {
            return b;
        }
        return b == null || a.atLeast(b) ? a : b;
    }
}
