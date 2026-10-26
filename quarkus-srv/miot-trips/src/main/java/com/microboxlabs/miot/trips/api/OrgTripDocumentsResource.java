package com.microboxlabs.miot.trips.api;

import com.microboxlabs.miot.core.api.OrgResourceSupport;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.content.ContentService;
import com.microboxlabs.miot.core.iam.Access;
import com.microboxlabs.miot.core.iam.OrgPermission;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.trips.access.TripsAccessCatalog;
import com.microboxlabs.miot.trips.service.TripDocumentService;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
import io.quarkus.security.PermissionsAllowed;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.StreamingOutput;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.jboss.resteasy.reactive.RestForm;
import org.jboss.resteasy.reactive.multipart.FileUpload;

/** A trip's documents (multimedia): images and PDFs by document type, their versions and review rounds. */
@Path("/api/v1/orgs/{organizationId}/trips/{id}/documents")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Trips — Documents", description = "A trip's documents, their versions and review rounds")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class OrgTripDocumentsResource extends OrgResourceSupport {

    private static final String ORG = "organizationId";
    private static final String ID = "id";
    private static final String DOCUMENT = "documentId";

    /** A null field keeps its value. */
    public record ChangeRequest(String docType, String name) {
    }

    /** {@code verdict} is APPROVED, REJECTED or PENDING (sent back for another look). */
    public record ReviewRequest(OffsetDateTime expectedUpdatedAt, String verdict, List<String> reasons, String comment) {
    }

    private final TripDocumentService documents;

    @Inject
    public OrgTripDocumentsResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            SecurityIdentity identity,
            TripDocumentService documents) {
        super(tenantContext, organizationContext, roleService, identity);
        this.documents = documents;
    }

    @GET
    @Operation(operationId = "listTripDocuments", summary = "The trip's documents, oldest first")
    @PermissionsAllowed(value = TripsAccessCatalog.VIEW, permission = OrgPermission.class, params = ORG)
    public Uni<Response> list(@PathParam(ORG) String organizationId, @PathParam(ID) String id) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(documents.list(tenant, uuid(id, ID))).build());
    }

    @GET
    @Path("/catalog")
    @Operation(operationId = "getTripDocumentCatalog",
            summary = "The organization's document types (and which need review) and review reasons")
    @PermissionsAllowed(value = TripsAccessCatalog.VIEW, permission = OrgPermission.class, params = ORG)
    public Uni<Response> catalog(@PathParam(ORG) String organizationId, @PathParam(ID) String id) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(documents.catalog(tenant)).build());
    }

    @POST
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    @Operation(operationId = "uploadTripDocument",
            summary = "Uploads an image or PDF with its document type; with deliveryId it also proves that delivery")
    @PermissionsAllowed(value = TripsAccessCatalog.DOCUMENT_MANAGE, permission = OrgPermission.class, params = ORG)
    public Uni<Response> upload(@PathParam(ORG) String organizationId, @PathParam(ID) String id,
            @RestForm("file") FileUpload file, @RestForm String docType, @RestForm String deliveryId) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return access(organizationId).flatMap(access -> work(() -> {
            UUID delivery = deliveryId == null || deliveryId.isBlank() ? null : uuid(deliveryId, "deliveryId");
            requireDeliveryAccess(access, delivery != null);
            FileUpload f = required(file);
            try (InputStream in = Files.newInputStream(f.uploadedFile())) {
                return Response.ok(documents.upload(tenant, actor, uuid(id, ID), docType, delivery, f.fileName(),
                        f.contentType(), in)).build();
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
        }));
    }

    @PUT
    @Path("/{documentId}/content")
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    @Operation(operationId = "replaceTripDocument",
            summary = "Replaces the file with a new version; a reviewed document goes back to pending")
    @PermissionsAllowed(value = TripsAccessCatalog.DOCUMENT_MANAGE, permission = OrgPermission.class, params = ORG)
    public Uni<Response> replace(@PathParam(ORG) String organizationId, @PathParam(ID) String id,
            @PathParam(DOCUMENT) String documentId, @RestForm("file") FileUpload file) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> {
            FileUpload f = required(file);
            try (InputStream in = Files.newInputStream(f.uploadedFile())) {
                return Response.ok(documents.replace(tenant, actor, uuid(id, ID), uuid(documentId, DOCUMENT),
                        f.fileName(), f.contentType(), in)).build();
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
        });
    }

    @GET
    @Path("/{documentId}/content")
    @Produces(MediaType.WILDCARD)
    @Operation(operationId = "getTripDocumentContent",
            summary = "The current file; download=true asks the browser to save it")
    @PermissionsAllowed(value = TripsAccessCatalog.VIEW, permission = OrgPermission.class, params = ORG)
    public Uni<Response> content(@PathParam(ORG) String organizationId, @PathParam(ID) String id,
            @PathParam(DOCUMENT) String documentId, @QueryParam("download") boolean download) {
        String tenant = tenantCode(organizationId);
        return work(() -> {
            ContentService.Opened opened = documents.content(tenant, uuid(id, ID), uuid(documentId, DOCUMENT));
            StreamingOutput body = out -> {
                try (InputStream in = opened.stream()) {
                    in.transferTo(out);
                }
            };
            String name = opened.content().name() == null ? "document" : opened.content().name();
            return Response.ok(body, opened.content().mimetype())
                    .header("Content-Disposition", (download ? "attachment" : "inline") + "; filename=\""
                            + name.replaceAll("[\"\\\\]", "_") + "\"")
                    .header("Content-Length", opened.content().size())
                    .header("X-Content-Type-Options", "nosniff")
                    .header("Content-Security-Policy", "sandbox")
                    .header("Cache-Control", "private, max-age=300")
                    .build();
        });
    }

    @PATCH
    @Path("/{documentId}")
    @Operation(operationId = "changeTripDocument", summary = "Renames the document or changes its type")
    @PermissionsAllowed(value = TripsAccessCatalog.DOCUMENT_MANAGE, permission = OrgPermission.class, params = ORG)
    public Uni<Response> change(@PathParam(ORG) String organizationId, @PathParam(ID) String id,
            @PathParam(DOCUMENT) String documentId, ChangeRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> Response.ok(documents.change(tenant, actor, uuid(id, ID), uuid(documentId, DOCUMENT),
                body == null ? null : body.docType(), body == null ? null : body.name())).build());
    }

    @DELETE
    @Path("/{documentId}")
    @Operation(operationId = "deleteTripDocument",
            summary = "Deletes the document; 409 when it proves a delivery with a confirmed step")
    @PermissionsAllowed(value = TripsAccessCatalog.DOCUMENT_MANAGE, permission = OrgPermission.class, params = ORG)
    public Uni<Response> delete(@PathParam(ORG) String organizationId, @PathParam(ID) String id,
            @PathParam(DOCUMENT) String documentId) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return access(organizationId).flatMap(access -> work(() -> {
            UUID trip = uuid(id, ID);
            UUID document = uuid(documentId, DOCUMENT);
            requireDeliveryAccess(access, documents.document(tenant, trip, document).deliveryId() != null);
            documents.delete(tenant, actor, trip, document);
            return Response.noContent().build();
        }));
    }

    @GET
    @Path("/{documentId}/reviews")
    @Operation(operationId = "listTripDocumentReviews", summary = "The document's review rounds, oldest first")
    @PermissionsAllowed(value = TripsAccessCatalog.VIEW, permission = OrgPermission.class, params = ORG)
    public Uni<Response> reviews(@PathParam(ORG) String organizationId, @PathParam(ID) String id,
            @PathParam(DOCUMENT) String documentId) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(documents.reviews(tenant, uuid(id, ID), uuid(documentId, DOCUMENT))).build());
    }

    @POST
    @Path("/{documentId}/reviews")
    @Operation(operationId = "reviewTripDocument",
            summary = "Records a review round on the current version: verdict, reasons and comment")
    @PermissionsAllowed(value = TripsAccessCatalog.DOCUMENT_REVIEW, permission = OrgPermission.class, params = ORG)
    public Uni<Response> review(@PathParam(ORG) String organizationId, @PathParam(ID) String id,
            @PathParam(DOCUMENT) String documentId, ReviewRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> Response.ok(documents.review(tenant, actor, uuid(id, ID), uuid(documentId, DOCUMENT),
                body == null ? null : new TripDocumentService.ReviewDecision(body.expectedUpdatedAt(),
                        body.verdict(), body.reasons(), body.comment()))).build());
    }

    private static void requireDeliveryAccess(Access access, boolean linked) {
        if (linked && !access.can(TripsAccessCatalog.DELIVERY_OPERATE)) {
            throw new SecurityException("delivery operation permission is required for linked documents");
        }
    }

    private static FileUpload required(FileUpload file) {
        if (file == null) {
            throw new IllegalArgumentException("file is required");
        }
        return file;
    }
}
