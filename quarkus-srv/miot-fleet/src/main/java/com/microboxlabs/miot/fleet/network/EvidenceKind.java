package com.microboxlabs.miot.fleet.network;

/**
 * What an observation says about an asset. The {@code party} of the evidence is a credential client id for
 * {@link #REPORTS}, an organization id for {@link #OWNS} and {@link #OPERATES}, and the asset it travels with for
 * {@link #LINKED}.
 */
public enum EvidenceKind {
    REPORTS,
    OWNS,
    OPERATES,
    LINKED
}
