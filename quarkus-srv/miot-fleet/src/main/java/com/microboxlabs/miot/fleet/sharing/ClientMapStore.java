package com.microboxlabs.miot.fleet.sharing;

import java.util.List;

/** The {@code asset_client_map} rows that the data shares own. */
public interface ClientMapStore {

    /** Value of {@code asset_client_map.managed_by} on the rows the data shares own. */
    String MANAGED_BY = "miot-sharing";

    List<ClientMap.Row> managed();

    /**
     * Applies the plan in one transaction. An insert takes over a row that something else wrote only when that row is
     * inactive or expired; a row in force stays as it is and keeps giving access.
     */
    void apply(ClientMap.Plan plan);
}
