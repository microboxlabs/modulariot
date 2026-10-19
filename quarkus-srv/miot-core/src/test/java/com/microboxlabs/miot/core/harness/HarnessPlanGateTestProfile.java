package com.microboxlabs.miot.core.harness;

import com.microboxlabs.miot.core.auth.HarnessProxyTestProfile;
import java.util.Set;

/** {@link HarnessProxyTestProfile} with {@link RefusingHarnessPlanGate} in place of the allow-all gate. */
public class HarnessPlanGateTestProfile extends HarnessProxyTestProfile {

    @Override
    public Set<Class<?>> getEnabledAlternatives() {
        return Set.of(RefusingHarnessPlanGate.class);
    }
}
