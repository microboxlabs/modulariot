package com.microboxlabs.miot.core.permission;

import com.microboxlabs.miot.core.api.dto.PlatformRoleDto;
import com.microboxlabs.miot.core.api.dto.PlatformRoleMembershipDto;
import com.microboxlabs.miot.core.api.dto.SetPlatformRoleRequest;
import com.microboxlabs.miot.core.auth.PlatformAuthorizer;
import com.microboxlabs.miot.core.model.PlatformRoleAssignment;
import io.quarkus.hibernate.reactive.panache.Panache;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.BadRequestException;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** Reads and writes the platform-scope role assignments. */
@ApplicationScoped
public class PlatformRoleService {

    private final PlatformAuthorizer authorizer;

    @Inject
    public PlatformRoleService(PlatformAuthorizer authorizer) {
        this.authorizer = authorizer;
    }

    /**
     * Authorization comes before validation throughout, so that a caller who is
     * not an owner learns only that — never whether a role code exists or how
     * the bootstrap list is configured.
     */
    public Uni<PlatformRoleDto> get(String roleCode) {
        return authorizer.requirePlatformOwner()
                .flatMap(ignored -> loadDto(PlatformRoleDefinition.fromCode(roleCode)));
    }

    public Uni<PlatformRoleDto> replace(String roleCode, SetPlatformRoleRequest request) {
        return authorizer.requirePlatformOwner().flatMap(caller -> {
            PlatformRoleDefinition role = PlatformRoleDefinition.fromCode(roleCode);
            Set<String> assigneeIds = normalizeAssignees(request);
            requireAWayBackIn(assigneeIds, authorizer.bootstrapOwners());

            return Panache.withTransaction(() ->
                            replaceAssignments(role.roleCode(), assigneeIds, caller))
                    .flatMap(ignored -> loadDto(role));
        });
    }

    /** Answers for any authenticated caller; an empty list is the normal reply. */
    public Uni<PlatformRoleMembershipDto> rolesOfCaller() {
        String email = authorizer.requireCallerEmail();
        return authorizer.isPlatformOwner(email)
                .map(owner -> new PlatformRoleMembershipDto(Boolean.TRUE.equals(owner)
                        ? List.of(PlatformRoleDefinition.OWNER.roleCode())
                        : List.of()));
    }

    /**
     * Emptying the table is allowed only while configuration still grants
     * someone the role. Without that, the last write would leave nobody able to
     * make the next one, and recovering would mean editing the database by hand.
     */
    static void requireAWayBackIn(Set<String> assigneeIds, Set<String> bootstrapOwners) {
        if (assigneeIds.isEmpty() && bootstrapOwners.isEmpty()) {
            throw new BadRequestException(
                    "Removing every assignee would leave nobody able to administer the platform");
        }
    }

    @SuppressWarnings("java:S3252")
    private Uni<Void> replaceAssignments(
            String roleCode, Set<String> assigneeIds, String caller) {
        return PlatformRoleAssignment.delete("id.roleCode = ?1", roleCode)
                .flatMap(ignored -> persistAssignments(roleCode, assigneeIds, caller));
    }

    private Uni<Void> persistAssignments(
            String roleCode, Set<String> assigneeIds, String caller) {
        Uni<Void> chain = Uni.createFrom().voidItem();
        for (String personId : assigneeIds) {
            chain = chain.flatMap(ignored -> new PlatformRoleAssignment(
                    roleCode, personId, caller).persist().replaceWithVoid());
        }
        return chain;
    }

    private Uni<PlatformRoleDto> loadDto(PlatformRoleDefinition role) {
        return Panache.withSession(() -> PlatformRoleAssignment
                .findAssignments(role.roleCode())
                .map(assignments -> new PlatformRoleDto(
                        role.roleCode(),
                        assignments.stream().map(a -> a.id.personId).sorted().toList(),
                        authorizer.bootstrapOwners().stream().sorted().toList())));
    }

    /**
     * Lower-cased to match what {@code PlatformAuthorizer} compares against; a
     * grant that differed only in case would silently never apply.
     */
    static Set<String> normalizeAssignees(SetPlatformRoleRequest request) {
        if (request == null || request.assigneeIds() == null) {
            throw new BadRequestException("assigneeIds list is required");
        }
        Set<String> normalized = new HashSet<>();
        for (String personId : request.assigneeIds()) {
            if (personId != null && !personId.isBlank()) {
                normalized.add(PlatformAuthorizer.normalize(personId));
            }
        }
        return normalized;
    }
}
