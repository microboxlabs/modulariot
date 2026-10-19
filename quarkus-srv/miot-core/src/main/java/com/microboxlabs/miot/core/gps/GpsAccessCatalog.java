package com.microboxlabs.miot.core.gps;

import com.microboxlabs.miot.core.iam.AccessCatalog;
import com.microboxlabs.miot.core.iam.ModuleDef;
import com.microboxlabs.miot.core.iam.PermissionDef;
import com.microboxlabs.miot.core.iam.RoleDef;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;
import java.util.Set;

/**
 * The GPS module: how a GPS provider sends positions.
 *
 * <table>
 *   <caption>Roles</caption>
 *   <tr><th>Role</th><th>Permissions</th></tr>
 *   <tr><td>{@value #VIEWER}</td><td>{@value #VIEW}</td></tr>
 *   <tr><td>{@value #PUBLISHER}</td><td>{@value #TRACK_WRITE}, for the service accounts that send positions</td></tr>
 * </table>
 *
 * <p>Only Owners can read or rotate the client secret.
 */
@ApplicationScoped
public class GpsAccessCatalog implements AccessCatalog {

    public static final String MODULE = "gps";

    public static final String VIEW = "gps:view";
    public static final String SECRET_READ = "gps:secret.read";
    public static final String SECRET_ROTATE = "gps:secret.rotate";
    public static final String TRACK_WRITE = "gps:track.write";

    public static final String VIEWER = "GPS_VIEWER";
    public static final String PUBLISHER = "GPS_PUBLISHER";

    @Override
    public List<PermissionDef> permissions() {
        return List.of(
                PermissionDef.of(VIEW, "Ver cómo integrar el GPS", "View how to integrate GPS"),
                PermissionDef.of(SECRET_READ, "Ver el secreto del cliente", "Reveal the client secret")
                        .forOwnersOnly(),
                PermissionDef.of(SECRET_ROTATE, "Renovar el secreto del cliente", "Rotate the client secret")
                        .forOwnersOnly(),
                PermissionDef.of(TRACK_WRITE, "Enviar posiciones GPS", "Send GPS positions"));
    }

    @Override
    public List<RoleDef> roles() {
        return List.of(
                RoleDef.of(VIEWER, MODULE, "Lector", "Viewer", Set.of(VIEW))
                        .describedAs("Ve cómo enviar las posiciones, sin el secreto.",
                                "Sees how to send positions, without the secret."),
                RoleDef.of(PUBLISHER, MODULE, "Emisor", "Publisher", Set.of(TRACK_WRITE))
                        .describedAs("Envía posiciones GPS. Para las claves de API del proveedor.",
                                "Sends GPS positions. For the provider's API keys."));
    }

    @Override
    public List<ModuleDef> modules() {
        return List.of(ModuleDef.of(MODULE, "GPS", "GPS",
                "Recibe las posiciones que envía el proveedor GPS.",
                "Receives the positions the GPS provider sends."));
    }
}
