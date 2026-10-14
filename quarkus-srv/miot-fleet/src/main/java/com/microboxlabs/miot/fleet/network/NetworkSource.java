package com.microboxlabs.miot.fleet.network;

/** Loads the network as the given organization may know it. Throws {@link NetworkUnavailableException}. */
public interface NetworkSource {

    NetworkSnapshot load(Viewer viewer);
}
