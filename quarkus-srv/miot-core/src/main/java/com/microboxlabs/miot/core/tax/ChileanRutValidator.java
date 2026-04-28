package com.microboxlabs.miot.core.tax;

import jakarta.enterprise.context.ApplicationScoped;

/**
 * Chilean RUT validator. Accepts the common input forms:
 * <ul>
 *   <li>{@code "77856310-K"} — canonical</li>
 *   <li>{@code "77.856.310-K"} — with thousands separators</li>
 *   <li>{@code "778563108"}   — no separator, no dash (last char = verifier)</li>
 *   <li>{@code "77856310-k"}  — lowercase K</li>
 * </ul>
 * Normalizes to {@code "<digits>-<verifier>"} with an uppercase K.
 *
 * <p>Verifier is computed with the standard mod-11 algorithm:
 * multiplying each digit right-to-left by 2..7 cyclically, summing,
 * and taking {@code 11 - (sum mod 11)}. A result of 11 becomes
 * {@code '0'}, 10 becomes {@code 'K'}.
 */
@ApplicationScoped
public class ChileanRutValidator implements TaxIdValidator {

    public static final String VALIDATOR_CODE = "chilean_rut";

    @Override
    public String code() {
        return VALIDATOR_CODE;
    }

    @Override
    public String normalize(String raw) {
        if (raw == null) {
            throw new InvalidTaxIdException("Tax id is required");
        }
        String cleaned = raw.replaceAll("[\\s.]", "").toUpperCase();
        if (cleaned.isEmpty()) {
            throw new InvalidTaxIdException("Tax id is required");
        }

        RutParts rut = parseRutParts(cleaned);
        String digits = rut.digits();
        char verifier = rut.verifier();

        if (digits.length() < 7 || digits.length() > 8) {
            throw new InvalidTaxIdException("Chilean RUT body must be 7-8 digits");
        }
        validateDigits(digits);
        validateVerifier(verifier);

        char expected = computeVerifier(digits);
        if (expected != verifier) {
            throw new InvalidTaxIdException(
                    "Chilean RUT verifier mismatch (expected " + expected + ", got " + verifier + ")");
        }
        return digits + "-" + verifier;
    }

    private static RutParts parseRutParts(String cleaned) {
        int dashIdx = cleaned.indexOf('-');
        if (dashIdx >= 0) {
            if (dashIdx != cleaned.length() - 2) {
                throw new InvalidTaxIdException("Chilean RUT must end with '-<verifier>'");
            }
            return new RutParts(cleaned.substring(0, dashIdx), cleaned.charAt(cleaned.length() - 1));
        }
        if (cleaned.length() < 2) {
            throw new InvalidTaxIdException("Chilean RUT is too short");
        }
        return new RutParts(
                cleaned.substring(0, cleaned.length() - 1),
                cleaned.charAt(cleaned.length() - 1));
    }

    private static void validateDigits(String digits) {
        for (int i = 0; i < digits.length(); i++) {
            if (!Character.isDigit(digits.charAt(i))) {
                throw new InvalidTaxIdException("Chilean RUT body must be numeric");
            }
        }
    }

    private static void validateVerifier(char verifier) {
        if (!Character.isDigit(verifier) && verifier != 'K') {
            throw new InvalidTaxIdException("Chilean RUT verifier must be 0-9 or K");
        }
    }

    private static char computeVerifier(String digits) {
        int sum = 0;
        int multiplier = 2;
        for (int i = digits.length() - 1; i >= 0; i--) {
            sum += (digits.charAt(i) - '0') * multiplier;
            multiplier = multiplier == 7 ? 2 : multiplier + 1;
        }
        int mod = 11 - (sum % 11);
        if (mod == 11) return '0';
        if (mod == 10) return 'K';
        return (char) ('0' + mod);
    }

    private record RutParts(String digits, char verifier) {
    }
}
