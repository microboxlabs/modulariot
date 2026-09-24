package com.microboxlabs.miot.core.selectable;

import java.util.List;

/**
 * The lists a component wants an organization to start with. Implement it as a
 * CDI bean: every implementation's lists are seeded the first time an
 * organization reads its selectables, and again on reset.
 */
public interface SelectableDefaults {

    List<Selectable> forTenant(String tenantCode);
}
