package com.microboxlabs.miot.symptoms.route;

import jakarta.enterprise.context.ApplicationScoped;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Hot-swappable table so superadmin (later) can replace routes without a
 * process restart. The Pulsar consumer always reads {@link #get()}.
 */
@ApplicationScoped
public class RouteTableHolder {

    private final AtomicReference<RouteTable> table = new AtomicReference<>(RouteTable.empty());

    public RouteTable get() {
        return table.get();
    }

    public void replace(RouteTable next) {
        table.set(next == null ? RouteTable.empty() : next);
    }
}
