package com.microboxlabs.miot.conversational.calling;

import com.microboxlabs.miot.conversational.calling.CallPermissionPolicy.State;
import com.microboxlabs.miot.core.telephony.WhatsAppCallPermissions;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.Optional;

/**
 * The contact's call permission on the organization's sending number, for the telephony module. Unknown while
 * the permission flow is off or the number cannot be resolved: Meta then decides.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.conversational.enabled", stringValue = "true")
public class ConversationalWhatsAppCallPermissions implements WhatsAppCallPermissions {

    private final CallPermissionService permissions;

    @Inject
    public ConversationalWhatsAppCallPermissions(CallPermissionService permissions) {
        this.permissions = permissions;
    }

    @Override
    public Optional<Boolean> allows(String tenantCode, String contactE164) {
        CallPermissionService.View view = permissions.forManagedCalls().view(tenantCode, contactE164);
        if (!view.callingEnabled() || view.refusal() == CallPermissionPolicy.Refusal.NO_CONNECTION
                || view.refusal() == CallPermissionPolicy.Refusal.INVALID_PHONE
                || (view.permission() == CallPermissionStatus.NONE && view.lastRequestAt() == null)) {
            return Optional.empty();
        }
        return Optional.of(view.state() == State.CAN_CALL);
    }
}
