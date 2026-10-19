package com.microboxlabs.miot.fleet.sharing;

import org.jboss.logging.Logger;

/** Brings the share-owned rows of {@code asset_client_map} in line with the active shares. */
public class ClientMapSync {

    private static final Logger LOG = Logger.getLogger(ClientMapSync.class);

    private final SharingService sharing;
    private final ClientMapStore store;

    public ClientMapSync(SharingService sharing, ClientMapStore store) {
        this.sharing = sharing;
        this.store = store;
    }

    /** One pass. Reads everything before writing, so a failed read changes nothing. */
    public synchronized ClientMap.Plan run() {
        ClientMap.Plan plan = ClientMap.plan(sharing.clientMap(), store.managed());
        store.apply(plan);
        if (!plan.isEmpty()) {
            LOG.infof("Data sharing: asset_client_map +%d ~%d -%d", plan.insert().size(), plan.update().size(),
                    plan.delete().size());
        }
        return plan;
    }
}
