package com.microboxlabs.miot.core.telephony;

import io.quarkus.arc.DefaultBean;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.Optional;

/** Used without the symptoms module: no caller is known. */
@ApplicationScoped
@DefaultBean
public class NoInboundCallers implements InboundCallers {

    @Override
    public Optional<Caller> find(String callerE164) {
        return Optional.empty();
    }
}
