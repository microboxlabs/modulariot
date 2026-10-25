package com.microboxlabs.miot.symptoms.events;

import com.microboxlabs.miot.core.event.ContactDirectory;
import com.microboxlabs.miot.symptoms.domain.Contact;
import com.microboxlabs.miot.symptoms.domain.ContactChannels;
import com.microboxlabs.miot.symptoms.store.ContactStore;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.List;

/** The contact book (Ajustes › Libreta de contactos) for the communication rules. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class BookContacts implements ContactDirectory {

    private final ContactStore contacts;

    @Inject
    public BookContacts(ContactStore contacts) {
        this.contacts = contacts;
    }

    @Override
    public List<Entry> active(String tenantCode) {
        return contacts.list(tenantCode, true).stream().map(BookContacts::entry).toList();
    }

    static Entry entry(Contact c) {
        ContactChannels ch = c.channels() == null ? ContactChannels.NONE : c.channels();
        String whatsapp = ch.whatsapp() != null ? ch.whatsapp() : c.phone();
        return new Entry(c.id(), c.name(), c.role(), c.tags() == null ? List.of() : c.tags(), c.company(),
                c.companyRut(), c.position(), c.memberUserId() != null && !c.memberUserId().isBlank(), ch.email(),
                whatsapp);
    }
}
