package com.microboxlabs.miot.core.telephony;

import java.util.Optional;

/**
 * Whether a contact allowed the organization's WhatsApp number to call it. Implemented by the conversational
 * module; empty means unknown, and Meta decides (a SIP 403 when there is no permission).
 */
public interface WhatsAppCallPermissions {

    Optional<Boolean> allows(String tenantCode, String contactE164);
}
