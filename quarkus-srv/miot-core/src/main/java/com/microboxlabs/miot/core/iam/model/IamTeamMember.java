package com.microboxlabs.miot.core.iam.model;

import io.quarkus.hibernate.reactive.panache.PanacheEntityBase;
import io.smallrye.mutiny.Uni;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/** A member of a team. */
@Entity
@Table(name = "iam_team_member", schema = "miot_iam")
public class IamTeamMember extends PanacheEntityBase {

    @EmbeddedId
    public Key id;

    public IamTeamMember() {
    }

    public IamTeamMember(UUID teamId, UUID userId) {
        this.id = new Key(teamId, userId);
    }

    public static Uni<List<IamTeamMember>> findByTeams(List<UUID> teamIds) {
        return teamIds.isEmpty() ? Uni.createFrom().item(List.of()) : find("id.teamId in ?1", teamIds).list();
    }

    public static Uni<List<IamTeamMember>> findByUser(UUID userId) {
        return find("id.userId = ?1", userId).list();
    }

    @Embeddable
    public static class Key implements Serializable {

        @Column(name = "team_id")
        public UUID teamId;

        @Column(name = "user_id")
        public UUID userId;

        public Key() {
        }

        public Key(UUID teamId, UUID userId) {
            this.teamId = teamId;
            this.userId = userId;
        }

        @Override
        public boolean equals(Object other) {
            return other instanceof Key k && Objects.equals(teamId, k.teamId) && Objects.equals(userId, k.userId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(teamId, userId);
        }
    }
}
