package com.microboxlabs.miot.teltonika.store;

/**
 * Runs a periodic job in one receiver instance at a time (expiring commands, ending intensive
 * tracking, packet-log retention). The other instances skip that round.
 */
@FunctionalInterface
public interface ClusterLock {

    /** Runs {@code work} if no other instance holds {@code job}; returns whether it ran. */
    boolean runExclusively(String job, Runnable work);

    /** Single instance (tests, local): always runs. */
    static ClusterLock local() {
        return (job, work) -> {
            work.run();
            return true;
        };
    }
}
