package com.microboxlabs.miot.symptoms.domain;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * The address a contact answers on, per channel: a full international number
 * for phone and WhatsApp, an account email for Meet and Teams, and the email
 * address messages go to. Null when the contact is not reachable on that channel.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ContactChannels(String phone, String whatsapp, String meet, String teams, String email) {

    public static final ContactChannels NONE = new ContactChannels(null, null, null, null, null);

    public ContactChannels(String phone, String whatsapp, String meet, String teams) {
        this(phone, whatsapp, meet, teams, null);
    }
}
