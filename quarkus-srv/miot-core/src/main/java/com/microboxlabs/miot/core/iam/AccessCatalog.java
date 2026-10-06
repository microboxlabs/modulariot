package com.microboxlabs.miot.core.iam;

import java.util.List;

/**
 * The permissions and module roles a module adds. Every module that checks permissions provides one bean;
 * {@link AccessRegistry} validates them all at startup.
 */
public interface AccessCatalog {

    List<PermissionDef> permissions();

    List<RoleDef> roles();
}
