package com.microboxlabs.miot.core.iam.model;

import io.quarkus.hibernate.reactive.panache.PanacheEntityBase;
import io.smallrye.mutiny.Uni;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/** A person. Matched by email until their first sign-in records the token subject. */
@Entity
@Table(name = "iam_user", schema = "miot_iam")
public class IamUser extends PanacheEntityBase {

    @Id
    public UUID id;

    public String subject;

    @Column(nullable = false)
    public String email;

    public String name;

    @Column(nullable = false)
    public String status = "ACTIVE";

    @Column(name = "created_at", nullable = false)
    public Instant createdAt = Instant.now();

    @Column(name = "last_seen_at")
    public Instant lastSeenAt;

    public IamUser() {
    }

    public static IamUser forEmail(String email) {
        IamUser user = new IamUser();
        user.id = UUID.randomUUID();
        user.email = normalize(email);
        return user;
    }

    public static String normalize(String email) {
        return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
    }

    public static Uni<IamUser> findByEmail(String email) {
        return find("lower(email) = ?1", normalize(email)).firstResult();
    }

    public static Uni<List<IamUser>> findByIds(List<UUID> ids) {
        return ids.isEmpty() ? Uni.createFrom().item(List.of()) : find("id in ?1", ids).list();
    }

    /** The user with this email, created when there is none. */
    @SuppressWarnings("java:S1612") // PanacheEntityBase::persist is ambiguous with Reactive Panache overloads.
    public static Uni<IamUser> findOrCreate(String email) {
        return findByEmail(email).flatMap(found -> found != null
                ? Uni.createFrom().item(found)
                : forEmail(email).<IamUser>persist());
    }
}
