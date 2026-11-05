package com.microboxlabs.miot.trips.geo;

import java.text.Normalizer;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Address text as the cache and the internal source compare it. */
public final class Addresses {

    /** A street and its house number, from the part of the address before the first comma. */
    public record Street(String name, String number) {
    }

    private static final Pattern MARKS = Pattern.compile("\\p{M}+");
    private static final Pattern NOT_ALNUM = Pattern.compile("[^A-Z0-9Ñ]+");
    /** The last number of the street part is the house number. */
    private static final Pattern NUMBERED = Pattern.compile("^(.*\\D)(\\d{1,5})(?:\\D.*)?$");
    private static final Pattern UNIT = Pattern.compile(
            "\\s+(?:OF|OFIC|OFICINA|DEPTO|DPTO|DEP|LOCAL|BODEGA|PISO|LOTE)\\b.*$", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    private static final Pattern NUMBER_MARK = Pattern.compile(
            "\\s*(?:#|N[°º.]?|NRO\\.?|NUM\\.?|NUMERO)\\s*$", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    private static final Set<String> PREFIXES = Set.of("AV", "AVDA", "AVENIDA", "CALLE", "PASAJE", "PJE", "PSJE");
    /** Titles the official street names carry and people often leave out, or abbreviate. */
    private static final Set<String> TITLES = Set.of("PRESIDENTE", "PDTE", "PTE", "GENERAL", "GRAL", "CAPITAN",
            "CAP", "TENIENTE", "TTE", "CORONEL", "CNEL", "COMANDANTE", "CMDTE", "SARGENTO", "SGTO", "ALMIRANTE", "ALM",
            "DOCTOR", "DR", "PROFESOR", "PROF", "MONSEÑOR", "MONS", "INGENIERO", "ING", "OBISPO");
    private static final Set<String> CONNECTORS = Set.of("DE", "DEL", "LA", "LAS", "LOS", "EL", "Y");

    private Addresses() {
    }

    /** Upper case, without accents (Ñ kept), punctuation folded to single spaces. */
    public static String fold(String s) {
        if (s == null) {
            return "";
        }
        String upper = s.strip().toUpperCase(Locale.ROOT).replace('Ñ', '\u0001');
        String bare = MARKS.matcher(Normalizer.normalize(upper, Normalizer.Form.NFD)).replaceAll("")
                .replace('\u0001', 'Ñ');
        return NOT_ALNUM.matcher(bare).replaceAll(" ").strip();
    }

    /** The cache key: the folded address, then the district when the address does not name it. */
    public static String key(String address, String district) {
        String a = fold(address);
        String d = fold(district);
        return d.isEmpty() || (" " + a + " ").contains(" " + d + " ") ? a : a + " " + d;
    }

    public static Optional<Street> street(String address) {
        if (address == null) {
            return Optional.empty();
        }
        String first = UNIT.matcher(address.split(",", 2)[0].strip()).replaceFirst("");
        Matcher m = NUMBERED.matcher(first);
        if (!m.matches()) {
            return Optional.empty();
        }
        String name = NUMBER_MARK.matcher(m.group(1).strip()).replaceFirst("").strip();
        String number = m.group(2).replaceFirst("^0+(?=\\d)", "");
        return name.isEmpty() ? Optional.empty() : Optional.of(new Street(name, number));
    }

    /** The spellings to look a name up by: as written in upper case, folded, and folded without a prefix. */
    public static List<String> spellings(String name, boolean dropPrefix) {
        Set<String> out = new LinkedHashSet<>();
        out.add(name.strip().toUpperCase(Locale.ROOT));
        String folded = fold(name);
        out.add(folded);
        if (dropPrefix) {
            String[] words = folded.split(" ", 2);
            if (words.length == 2 && PREFIXES.contains(words[0])) {
                out.add(words[1]);
            }
        }
        out.remove("");
        return List.copyOf(out);
    }

    /** The text after the house number: the rest of the first part and every part after the first comma. */
    public static String afterNumber(String address) {
        if (address == null) {
            return "";
        }
        String[] parts = address.split(",", 2);
        String first = parts[0].strip();
        Matcher m = NUMBERED.matcher(UNIT.matcher(first).replaceFirst(""));
        String tail = m.matches() ? first.substring(m.end(2)).strip() : "";
        if (parts.length == 1) {
            return tail;
        }
        String rest = parts[1].strip();
        return tail.isEmpty() ? rest : tail + ", " + rest;
    }

    /** The words that identify a street: folded, without its type, titles or connecting words. */
    public static List<String> streetTokens(String name) {
        return java.util.Arrays.stream(fold(name).split(" "))
                .filter(w -> !w.isEmpty() && !PREFIXES.contains(w) && !TITLES.contains(w) && !CONNECTORS.contains(w))
                .toList();
    }

    /**
     * How well a street name matches a candidate's, from 0 to 1. Every word of the shorter one must match a different
     * word of the other, equal or as its initial; the score is the matched words over the longer one's. 0 when not.
     */
    public static double streetScore(List<String> name, List<String> candidate) {
        if (name.isEmpty() || candidate.isEmpty()) {
            return 0;
        }
        List<String> shorter = name.size() <= candidate.size() ? name : candidate;
        List<String> longer = new java.util.ArrayList<>(shorter == name ? candidate : name);
        List<String> ordered = shorter.stream()
                .sorted(java.util.Comparator.comparingInt(String::length).reversed()).toList();
        for (String word : ordered) {
            int i = indexOfMatch(longer, word);
            if (i < 0) {
                return 0;
            }
            longer.set(i, null);
        }
        return (double) shorter.size() / Math.max(name.size(), candidate.size());
    }

    private static int indexOfMatch(List<String> words, String word) {
        int initial = -1;
        for (int i = 0; i < words.size(); i++) {
            String w = words.get(i);
            if (w == null) continue;
            if (w.equals(word)) return i;
            if (initial < 0 && (isInitial(w) && word.startsWith(w) || isInitial(word) && w.startsWith(word))) {
                initial = i;
            }
        }
        return initial;
    }

    private static boolean isInitial(String word) {
        return word.length() == 1 && Character.isLetter(word.charAt(0));
    }
}
