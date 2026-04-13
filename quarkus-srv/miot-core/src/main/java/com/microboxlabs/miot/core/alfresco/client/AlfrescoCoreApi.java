package com.microboxlabs.miot.core.alfresco.client;

import com.microboxlabs.miot.core.alfresco.model.AlfrescoGroupMemberEntry;
import com.microboxlabs.miot.core.alfresco.model.AlfrescoListResponse;
import com.microboxlabs.miot.core.alfresco.model.AlfrescoPersonEntry;
import io.smallrye.mutiny.Uni;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import org.eclipse.microprofile.rest.client.annotation.RegisterProvider;
import org.eclipse.microprofile.rest.client.inject.RegisterRestClient;

/**
 * Typed REST client for Alfresco's public core API
 * ({@code /alfresco/api/-default-/public/alfresco/versions/1}).
 *
 * <p>Configure the base URL via:
 * <pre>
 *   quarkus.rest-client.alfresco-core.url=${miot.alfresco.url}/api/-default-/public/alfresco/versions/1
 * </pre>
 *
 * <p>The outgoing {@code Authorization} header is injected by
 * {@link AlfrescoAuthClientFilter}, which delegates to the active
 * {@code AlfrescoAuthProvider}.
 *
 * <p>Scope is intentionally narrow: the five methods Phase 4 needs
 * (list members, search people, create group, add/remove member).
 * New methods land pull-based as consumers require them — we do not
 * mirror the full Alfresco REST surface.
 *
 * <p><b>Reactive note:</b> methods return {@link Uni} — they are safe
 * to fan out with {@code Uni.combine()} because Alfresco calls do not
 * share a Hibernate session. The Panache no-parallel rule does not
 * apply here.
 */
@Path("/")
@RegisterRestClient(configKey = "alfresco-core")
@RegisterProvider(AlfrescoAuthClientFilter.class)
@RegisterProvider(AlfrescoExceptionMapper.class)
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public interface AlfrescoCoreApi {

    /**
     * List the direct members of an Alfresco group. Returns only
     * {@code PERSON} entries; nested subgroups are filtered out on
     * the caller side.
     */
    @GET
    @Path("/groups/{groupId}/members")
    Uni<AlfrescoListResponse<AlfrescoGroupMemberEntry>> listGroupMembers(
            @PathParam("groupId") String groupId,
            @QueryParam("maxItems") @DefaultValue("50") int maxItems,
            @QueryParam("skipCount") @DefaultValue("0") int skipCount);

    /**
     * Fetch a single person by id (username / email). Used to
     * hydrate the richer projection after listGroupMembers (which
     * only returns id + displayName).
     */
    @GET
    @Path("/people/{personId}")
    Uni<SinglePersonEntry> getPerson(@PathParam("personId") String personId);

    /**
     * Free-text search over the people directory. Matches firstName,
     * lastName, email, username — per Alfresco's {@code term} semantics.
     */
    @GET
    @Path("/people")
    Uni<AlfrescoListResponse<AlfrescoPersonEntry>> searchPeople(
            @QueryParam("term") String term,
            @QueryParam("maxItems") @DefaultValue("25") int maxItems);

    /**
     * Create an Alfresco authority group. {@code id} must start with
     * {@code GROUP_} by Alfresco convention.
     */
    @POST
    @Path("/groups")
    Uni<SingleGroupEntry> createGroup(CreateGroupRequest body);

    /**
     * Add a person to a group. {@code body.id} is the person id and
     * {@code body.memberType} is always {@code "PERSON"}.
     */
    @POST
    @Path("/groups/{groupId}/members")
    Uni<SingleMemberEntry> addGroupMember(
            @PathParam("groupId") String groupId,
            AddGroupMemberRequest body);

    /**
     * Remove a person from a group. Returns 204 on success, 404 if the
     * person wasn't a member.
     */
    @DELETE
    @Path("/groups/{groupId}/members/{personId}")
    Uni<Void> removeGroupMember(
            @PathParam("groupId") String groupId,
            @PathParam("personId") String personId);

    /** Single-person wrapper: {@code { "entry": { ... } }}. */
    record SinglePersonEntry(AlfrescoPersonEntry entry) {
    }

    /** Single-group wrapper used by createGroup's response. */
    record SingleGroupEntry(AlfrescoGroupEntry entry) {
    }

    /** Minimal shape of a group entity in Alfresco responses. */
    record AlfrescoGroupEntry(String id, String displayName, boolean isRoot) {
    }

    /** Single-member wrapper used by addGroupMember's response. */
    record SingleMemberEntry(AlfrescoGroupMemberEntry entry) {
    }
}
