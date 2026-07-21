package com.microboxlabs.miot.core.permission;

import com.microboxlabs.miot.core.alfresco.AlfrescoPerson;
import com.microboxlabs.miot.core.alfresco.IAlfrescoDirectoryClient;
import com.microboxlabs.miot.core.api.dto.ContentReviewPermissionDto;
import com.microboxlabs.miot.core.api.dto.SetContentReviewPermissionRequest;
import com.microboxlabs.miot.core.auth.WriteAuthorizer;
import com.microboxlabs.miot.core.model.Organization;
import com.microboxlabs.miot.core.model.OrganizationPermissionSetting;
import com.microboxlabs.miot.core.model.OrganizationRoleAssignment;
import io.quarkus.hibernate.reactive.panache.Panache;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.NotFoundException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.TreeSet;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * Owns automatic content-review permission state and projects effective role
 * assignments into the Alfresco group consumed by ecm-coordinator.
 */
@ApplicationScoped
public class ContentReviewPermissionService {

    public static final String PERMISSION_CODE = "CONTENT_MULTIMEDIA_REVIEW_AUTO_APPROVE";
    public static final String ROLE_CODE = "CONTENT_REVIEW_AUTO_APPROVER";

    private static final int PAGE_SIZE = 50;
    private static final Logger LOG = Logger.getLogger(ContentReviewPermissionService.class);

    private final IAlfrescoDirectoryClient directoryClient;
    private final AlfrescoGroupProjector groupProjector;
    private final WriteAuthorizer writeAuthorizer;
    private final String targetGroupPrefix;
    private final String siteTargetGroupPrefix;

    @Inject
    public ContentReviewPermissionService(
            IAlfrescoDirectoryClient directoryClient,
            AlfrescoGroupProjector groupProjector,
            WriteAuthorizer writeAuthorizer,
            @ConfigProperty(
                    name = "miot.permissions.content-review.alfresco-group-prefix",
                    defaultValue = "GROUP_MINTRAL_AUTO_APPROVERS_") String targetGroupPrefix,
            @ConfigProperty(
                    name = "miot.permissions.content-review.alfresco-site-group-prefix",
                    defaultValue = "GROUP_MINTRAL_AUTO_APPROVERS_SITE_") String siteTargetGroupPrefix) {
        this.directoryClient = directoryClient;
        this.groupProjector = groupProjector;
        this.writeAuthorizer = writeAuthorizer;
        this.targetGroupPrefix = targetGroupPrefix;
        this.siteTargetGroupPrefix = siteTargetGroupPrefix;
    }

    public Uni<ContentReviewPermissionDto> get(String organizationSlug) {
        return Panache.withSession(() -> Organization.findBySlug(organizationSlug)
                .flatMap(org -> {
                    if (org == null) {
                        return Uni.createFrom().failure(new NotFoundException(
                                "Organization not found: " + organizationSlug));
                    }
                    return loadDto(org.id, targetGroupFor(org));
                }));
    }

    public Uni<ContentReviewPermissionDto> replace(
            String organizationSlug, SetContentReviewPermissionRequest request) {
        Set<String> assigneeIds = normalize(request);

        return authorizeAndResolve(organizationSlug)
                .flatMap(target -> validateOrganizationMembers(target, assigneeIds))
                .flatMap(target -> persistDesiredState(target, request.enabled(), assigneeIds))
                .flatMap(target -> reconcileProjection(target, request.enabled(), assigneeIds)
                        .flatMap(v -> markProjection(
                                target.organizationId(), "SYNCED", null, Instant.now()))
                        .onFailure().recoverWithUni(error -> {
                            LOG.errorf(error, "Content-review role projection to %s failed",
                                    target.targetGroupId());
                            return markProjection(target.organizationId(), "FAILED",
                                    abbreviate(error.getMessage()), null);
                        }))
                .flatMap(organizationId -> Panache.withSession(() -> Organization.<Organization>findById(organizationId)
                        .flatMap(org -> loadDto(organizationId, targetGroupFor(org)))));
    }

    private Uni<OrganizationTarget> authorizeAndResolve(String organizationSlug) {
        return Panache.withSession(() -> Organization.findBySlug(organizationSlug)
                .flatMap(org -> {
                    if (org == null) {
                        return Uni.createFrom().failure(new NotFoundException(
                                "Organization not found: " + organizationSlug));
                    }
                    if (org.alfrescoGroupId == null || org.alfrescoGroupId.isBlank()) {
                        return Uni.createFrom().failure(new BadRequestException(
                                "Organization has no Alfresco group binding"));
                    }
                    OrganizationTarget target = new OrganizationTarget(
                            org.id, org.alfrescoGroupId, targetGroupFor(org));
                    return writeAuthorizer.requireParentSiteManager(org).replaceWith(target);
                }));
    }

    private Uni<OrganizationTarget> validateOrganizationMembers(
            OrganizationTarget target, Set<String> requested) {
        if (requested.isEmpty()) {
            return Uni.createFrom().item(target);
        }
        return listAllMembers(target.alfrescoGroupId())
                .map(members -> members.stream().map(AlfrescoPerson::id).collect(java.util.stream.Collectors.toSet()))
                .map(validIds -> {
                    Set<String> invalid = new TreeSet<>(requested);
                    invalid.removeAll(validIds);
                    if (!invalid.isEmpty()) {
                        throw new BadRequestException(
                                "Auto-approvers must be organization members: " + String.join(", ", invalid));
                    }
                    return target;
                });
    }

    private Uni<OrganizationTarget> persistDesiredState(
            OrganizationTarget target, boolean enabled, Set<String> assigneeIds) {
        return Panache.withTransaction(() -> OrganizationPermissionSetting
                .findSetting(target.organizationId(), PERMISSION_CODE)
                .flatMap(setting -> {
                    OrganizationPermissionSetting row = setting != null
                            ? setting
                            : new OrganizationPermissionSetting(target.organizationId(), PERMISSION_CODE);
                    row.enabled = enabled;
                    row.projectionStatus = "PENDING";
                    row.projectionError = null;
                    row.updatedAt = Instant.now();
                    return row.<OrganizationPermissionSetting>persist();
                })
                .flatMap(setting -> replaceAssignments(target.organizationId(), assigneeIds))
                .replaceWith(target));
    }

    @SuppressWarnings("java:S3252")
    private Uni<Void> replaceAssignments(Long organizationId, Set<String> assigneeIds) {
        return OrganizationRoleAssignment
                .delete("id.organizationId = ?1 and id.roleCode = ?2", organizationId, ROLE_CODE)
                .flatMap(ignored -> persistAssignments(organizationId, assigneeIds));
    }

    private Uni<Void> persistAssignments(Long organizationId, Set<String> assigneeIds) {
        Uni<Void> chain = Uni.createFrom().voidItem();
        for (String personId : assigneeIds) {
            chain = chain.flatMap(ignored -> new OrganizationRoleAssignment(
                    organizationId, ROLE_CODE, personId).persist().replaceWithVoid());
        }
        return chain;
    }

    private Uni<Void> reconcileProjection(
            OrganizationTarget target, boolean enabled, Set<String> assigneeIds) {
        Set<String> desired = enabled ? assigneeIds : Set.of();
        return groupProjector.reconcile(
                target.targetGroupId(), "Multimedia content auto approvers", desired);
    }

    private Uni<List<AlfrescoPerson>> listAllMembers(String groupId) {
        return listAllMembers(groupId, 0, new ArrayList<>());
    }

    private Uni<List<AlfrescoPerson>> listAllMembers(
            String groupId, int skipCount, List<AlfrescoPerson> collected) {
        return directoryClient.listGroupMembers(groupId, PAGE_SIZE, skipCount)
                .flatMap(page -> {
                    collected.addAll(page);
                    if (page.size() < PAGE_SIZE) {
                        return Uni.createFrom().item(List.copyOf(collected));
                    }
                    return listAllMembers(groupId, skipCount + PAGE_SIZE, collected);
                });
    }

    private Uni<Long> markProjection(
            Long organizationId, String status, String error, Instant projectedAt) {
        return Panache.withTransaction(() -> OrganizationPermissionSetting
                .findSetting(organizationId, PERMISSION_CODE)
                .flatMap(setting -> {
                    setting.projectionStatus = status;
                    setting.projectionError = error;
                    setting.projectedAt = projectedAt;
                    setting.updatedAt = Instant.now();
                    return setting.<OrganizationPermissionSetting>persist();
                })
                .replaceWith(organizationId));
    }

    private Uni<ContentReviewPermissionDto> loadDto(Long organizationId, String targetGroupId) {
        return OrganizationPermissionSetting.findSetting(organizationId, PERMISSION_CODE)
                .flatMap(setting -> OrganizationRoleAssignment
                        .findAssignments(organizationId, ROLE_CODE)
                        .map(assignments -> toDto(setting, assignments, targetGroupId)));
    }

    private ContentReviewPermissionDto toDto(
            OrganizationPermissionSetting setting,
            List<OrganizationRoleAssignment> assignments,
            String targetGroupId) {
        List<String> assigneeIds = assignments.stream()
                .map(assignment -> assignment.id.personId)
                .sorted()
                .toList();
        return new ContentReviewPermissionDto(
                setting != null && setting.enabled,
                PERMISSION_CODE,
                ROLE_CODE,
                targetGroupId,
                assigneeIds,
                setting == null ? "SYNCED" : setting.projectionStatus,
                setting == null ? null : setting.projectionError,
                setting == null ? null : setting.projectedAt);
    }

    private static Set<String> normalize(SetContentReviewPermissionRequest request) {
        if (request == null || request.assigneeIds() == null) {
            throw new BadRequestException("assigneeIds list is required (can be empty)");
        }
        Set<String> normalized = new HashSet<>();
        for (String personId : request.assigneeIds()) {
            if (personId != null && !personId.isBlank()) {
                normalized.add(personId.trim());
            }
        }
        return normalized;
    }

    private static String abbreviate(String message) {
        if (message == null || message.isBlank()) {
            return "Alfresco projection failed";
        }
        return message.length() <= 500 ? message : message.substring(0, 500);
    }

    private String targetGroupFor(Organization organization) {
        if (organization.taxId != null && !organization.taxId.isBlank()) {
            return targetGroupForTaxId(targetGroupPrefix, organization.taxId);
        }
        return targetGroupForSite(
                siteTargetGroupPrefix, organization.alfrescoGroupId);
    }

    static String targetGroupForTaxId(String groupPrefix, String taxId) {
        if (taxId == null || taxId.isBlank()) {
            throw new BadRequestException(
                    "Content-review permissions require an organization tax id");
        }
        String normalizedTaxId = taxId.toUpperCase(Locale.ROOT)
                .replaceAll("[^A-Z0-9]", "");
        return groupPrefix + normalizedTaxId;
    }

    static String targetGroupForSite(String groupPrefix, String alfrescoGroupId) {
        final String siteGroupPrefix = "GROUP_site_";
        if (alfrescoGroupId == null || !alfrescoGroupId.startsWith(siteGroupPrefix)) {
            throw new BadRequestException(
                    "Parent content-review permissions require an Alfresco site group binding");
        }
        String siteId = alfrescoGroupId.substring(siteGroupPrefix.length())
                .toUpperCase(Locale.ROOT)
                .replaceAll("[^A-Z0-9]", "");
        if (siteId.isEmpty()) {
            throw new BadRequestException(
                    "Parent content-review permissions require an Alfresco site id");
        }
        return groupPrefix + siteId;
    }

    private record OrganizationTarget(
            Long organizationId, String alfrescoGroupId, String targetGroupId) {
    }
}
