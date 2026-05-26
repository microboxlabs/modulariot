package com.microboxlabs.miot.core.auth;

import java.math.BigInteger;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPublicKey;
import java.time.Instant;
import java.util.UUID;
import org.jose4j.jws.AlgorithmIdentifiers;
import org.jose4j.jws.JsonWebSignature;
import org.jose4j.jwt.JwtClaims;
import org.jose4j.jwt.NumericDate;
import org.jose4j.keys.HmacKey;

/**
 * Test-only helper that forges Auth0-shaped JWTs against an in-process keypair.
 * The matching JWKS is published by {@link MockOidcResource}; both share the
 * single static {@link #RS256_KEYPAIR} so verification round-trips work.
 *
 * <p>Web tokens are signed RS256 (matches {@code miot.auth.rs256-*} config);
 * M2M tokens are signed HS256 with {@link #HS256_SECRET} (matches
 * {@code miot.auth.hs256-*}). Claim shape mirrors what
 * {@code DualJwtAuthMechanism} and {@code OrganizationRequestFilter} consume.
 */
public final class TestTokenFactory {

    public static final String KID = "test-rs256-kid";
    public static final String ISSUER = "https://mock-oidc.test/";
    public static final String WEB_AUDIENCE = "https://api.miot.test/web";
    public static final String M2M_AUDIENCE = "https://api.miot.test/m2m";
    public static final String HS256_SECRET = "test-hs256-secret-please-rotate-32-bytes-min!";

    static final KeyPair RS256_KEYPAIR = generateRsa();

    private TestTokenFactory() {}

    public static RSAPublicKey publicKey() {
        return (RSAPublicKey) RS256_KEYPAIR.getPublic();
    }

    public static String signWebToken(String email) {
        return signWebToken(email, Instant.now().plusSeconds(300));
    }

    public static String signExpiredWebToken(String email) {
        return signWebToken(email, Instant.now().minusSeconds(60));
    }

    public static String signWebToken(String email, Instant expiration) {
        JwtClaims claims = baseClaims(WEB_AUDIENCE, expiration);
        claims.setSubject("auth0|" + email);
        claims.setStringClaim("email", email);
        claims.setStringClaim("azp", "web-client-id");
        return signRs256(claims);
    }

    public static String signM2mToken(String clientId) {
        return signM2mToken(clientId, Instant.now().plusSeconds(300));
    }

    public static String signM2mToken(String clientId, Instant expiration) {
        JwtClaims claims = baseClaims(M2M_AUDIENCE, expiration);
        claims.setSubject(clientId + "@clients");
        claims.setStringClaim("azp", clientId);
        return signHs256(claims);
    }

    private static JwtClaims baseClaims(String audience, Instant expiration) {
        JwtClaims claims = new JwtClaims();
        claims.setIssuer(ISSUER);
        claims.setAudience(audience);
        claims.setIssuedAt(NumericDate.fromSeconds(Instant.now().getEpochSecond()));
        claims.setExpirationTime(NumericDate.fromSeconds(expiration.getEpochSecond()));
        claims.setJwtId(UUID.randomUUID().toString());
        return claims;
    }

    private static String signRs256(JwtClaims claims) {
        JsonWebSignature jws = new JsonWebSignature();
        jws.setPayload(claims.toJson());
        jws.setKey(RS256_KEYPAIR.getPrivate());
        jws.setAlgorithmHeaderValue(AlgorithmIdentifiers.RSA_USING_SHA256);
        jws.setKeyIdHeaderValue(KID);
        try {
            return jws.getCompactSerialization();
        } catch (Exception e) {
            throw new IllegalStateException("RS256 sign failed", e);
        }
    }

    private static String signHs256(JwtClaims claims) {
        JsonWebSignature jws = new JsonWebSignature();
        jws.setPayload(claims.toJson());
        jws.setKey(new HmacKey(HS256_SECRET.getBytes()));
        jws.setAlgorithmHeaderValue(AlgorithmIdentifiers.HMAC_SHA256);
        try {
            return jws.getCompactSerialization();
        } catch (Exception e) {
            throw new IllegalStateException("HS256 sign failed", e);
        }
    }

    private static KeyPair generateRsa() {
        try {
            KeyPairGenerator kpg = KeyPairGenerator.getInstance("RSA");
            kpg.initialize(2048);
            return kpg.generateKeyPair();
        } catch (Exception e) {
            throw new IllegalStateException("Failed to generate test RSA keypair", e);
        }
    }

    /** Public exponent / modulus accessor used by {@link MockOidcResource#jwks()}. */
    static BigInteger modulus() { return publicKey().getModulus(); }

    /** Public exponent accessor used by {@link MockOidcResource#jwks()}. */
    static BigInteger exponent() { return publicKey().getPublicExponent(); }
}
