package com.microboxlabs.miot.fleet.network;

/** Loads the network as the given organization may know it. */
public interface NetworkSource {

    NetworkSnapshot load(Viewer viewer);

    /** The source is not configured or cannot be read. */
    class UnavailableException extends RuntimeException {
        public UnavailableException(String message) {
            super(message);
        }
    }
}
