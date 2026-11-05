package com.microboxlabs.miot.conversational.access;

import com.microboxlabs.miot.core.iam.AccessCatalog;
import com.microboxlabs.miot.core.iam.CoordinatorAccessCatalog;
import com.microboxlabs.miot.core.iam.PermissionDef;
import com.microboxlabs.miot.core.iam.RoleDef;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;
import java.util.Set;

/** Starting a communication rule on request, for the service accounts of integrations. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.conversational.enabled", stringValue = "true")
public class ConversationsAccessCatalog implements AccessCatalog {

    public static final String RULE_INVOKE = "conversations:rule.invoke";

    public static final String INVOKER = "CONVERSATIONS_INVOKER";

    @Override
    public List<PermissionDef> permissions() {
        return List.of(PermissionDef.of(RULE_INVOKE, "Invocar comunicaciones", "Invoke communications"));
    }

    @Override
    public List<RoleDef> roles() {
        return List.of(RoleDef.of(INVOKER, CoordinatorAccessCatalog.CONVERSATIONS, "Invocador", "Invoker",
                Set.of(RULE_INVOKE))
                .describedAs("Inicia las comunicaciones publicadas por API, sin editarlas. Para integraciones.",
                        "Starts published communications through the API, without editing them. For integrations."));
    }
}
