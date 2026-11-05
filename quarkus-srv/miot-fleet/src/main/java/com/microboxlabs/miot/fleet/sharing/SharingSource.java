package com.microboxlabs.miot.fleet.sharing;

import java.util.List;
import java.util.Map;
import java.util.Set;

/** The organizations and their assets, read from where they live. */
public interface SharingSource {

    List<SharingOrg.Ref> organizations();

    /** Assets per client, counting only those whose last signal came from that client. */
    Map<String, Integer> assetCounts(Set<String> clientIds);

    /** The clients among {@code clientIds} that create trips. */
    Set<String> operators(Set<String> clientIds);

    List<SharingAsset> assets(String clientId);
}
