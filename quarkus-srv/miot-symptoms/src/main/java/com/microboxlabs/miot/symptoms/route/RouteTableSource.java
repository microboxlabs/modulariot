package com.microboxlabs.miot.symptoms.route;

/**
 * Where the dispatcher reads its routing table.
 *
 * <p>Today: {@link BootstrapRouteTableSource} (JSON file / env).
 * Later: a superadmin-settings implementation that returns the same
 * {@link RouteTable}.
 */
public interface RouteTableSource {

    RouteTable load();
}
