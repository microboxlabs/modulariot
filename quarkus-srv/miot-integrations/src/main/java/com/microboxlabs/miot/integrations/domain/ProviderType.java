package com.microboxlabs.miot.integrations.domain;

public enum ProviderType {
    POSTGREST,
    ALERCE_TMS,
    N8N,
    AUTH0,
    ECM,
    CUSTOM_HTTP,
    WHATSAPP,
    /** Tenant-owned outbound GPS position webhooks with filter criteria. */
    GPS_WEBHOOK,
    /** Transactional email through the Resend API. */
    RESEND,
    /** Vehicle studio images through carimagesapi.com. */
    CAR_IMAGES,
    /** Forward geocoding through Mapbox or Google; {@code metadata.provider} picks which. */
    GEOCODING,
    /** Calls from the browser through Telnyx WebRTC; the credential holds the API key. */
    TELNYX,
    /** Calls through the operator's Teams client; an Entra app credential reads the call records. */
    TEAMS_PHONE
}
