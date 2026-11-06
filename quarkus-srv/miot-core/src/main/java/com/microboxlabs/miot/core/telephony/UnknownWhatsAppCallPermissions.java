package com.microboxlabs.miot.core.telephony;

import io.quarkus.arc.DefaultBean;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.Optional;

/** Used without the conversational module: the permission is unknown. */
@ApplicationScoped
@DefaultBean
public class UnknownWhatsAppCallPermissions implements WhatsAppCallPermissions {

    @Override
    public Optional<Boolean> allows(String tenantCode, String contactE164) {
        return Optional.empty();
    }
}
