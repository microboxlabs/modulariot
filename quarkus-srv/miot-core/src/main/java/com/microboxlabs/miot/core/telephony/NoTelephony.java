package com.microboxlabs.miot.core.telephony;

import io.quarkus.arc.DefaultBean;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;

/** Used when the integrations module is not in the build: no telephony lines. */
@ApplicationScoped
@DefaultBean
public class NoTelephony implements Telephony {

    @Override
    public List<TelephonyLine> lines(String tenantCode) {
        return List.of();
    }
}
