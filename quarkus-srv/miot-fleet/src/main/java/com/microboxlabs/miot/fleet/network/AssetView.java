package com.microboxlabs.miot.fleet.network;

import java.util.List;

/** An asset the viewer can see, who owns it, who reports it, and why the viewer sees it. */
public record AssetView(
        String id,
        String type,
        String label,
        OrgRef owner,
        List<OrgRef> providers,
        List<AssetAccess> access) {
}
