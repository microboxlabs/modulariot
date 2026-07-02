package com.microboxlabs.miot.conversational;

import com.microboxlabs.miot.core.config.AbstractMiotComponent;
import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import org.jboss.logging.Logger;

@ApplicationScoped
@LookupIfProperty(name = "miot.component.conversational.enabled", stringValue = "true")
public class ConversationalComponent extends AbstractMiotComponent {

    private static final Logger LOG = Logger.getLogger(ConversationalComponent.class);

    @Override
    protected Logger log() {
        return LOG;
    }

    @Override
    public String name() {
        return "conversational";
    }

    @Override
    public int priority() {
        return 160;
    }
}
