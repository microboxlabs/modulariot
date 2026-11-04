package com.microboxlabs.miot.integrations.telephony;

import com.microboxlabs.miot.core.telephony.Telephony;
import com.microboxlabs.miot.core.telephony.TelephonyLine;
import com.microboxlabs.miot.core.telephony.TelephonyProvider;
import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.persistence.IntegrationConnectionRepository;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.ArrayList;
import java.util.List;
import java.util.function.BiFunction;

/** {@link Telephony} from the organization's TELNYX and TEAMS_PHONE connections. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class IntegrationsTelephony implements Telephony {

    private final BiFunction<String, ProviderType, IntegrationConnection> connections;

    @Inject
    public IntegrationsTelephony(IntegrationConnectionRepository repository) {
        this(repository::findActiveByProvider);
    }

    /** {@code connections}: the tenant's connection of a provider, or null. */
    public IntegrationsTelephony(BiFunction<String, ProviderType, IntegrationConnection> connections) {
        this.connections = connections;
    }

    @Override
    public List<TelephonyLine> lines(String tenantCode) {
        List<TelephonyLine> lines = new ArrayList<>();
        for (TelephonyProvider provider : TelephonyProvider.values()) {
            IntegrationConnection c = connections.apply(tenantCode, ProviderType.valueOf(provider.name()));
            if (c != null) {
                lines.add(new TelephonyLine(c.id(), provider, c.name(), callerNumber(c, provider),
                        c.status() == ConnectionStatus.ACTIVE));
            }
        }
        return List.copyOf(lines);
    }

    private static String callerNumber(IntegrationConnection c, TelephonyProvider provider) {
        String key = provider == TelephonyProvider.TELNYX ? TelephonyKeys.CALLER_NUMBER
                : TelephonyKeys.DEFAULT_CALLER_ID;
        return c.metadata() == null ? null : PhoneNumbers.e164(c.metadata().get(key));
    }
}
