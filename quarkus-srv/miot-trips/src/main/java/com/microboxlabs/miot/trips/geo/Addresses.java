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
            "\\s+(?:OF|OFIC|OFICINA|DEPTO|DPTO|DEP|LOCAL|BODEGA|PISO|LOTE)\\b.*$", Pattern.CASE_INSENSITIVE);
    private static final Pattern NUMBER_MARK = Pattern.compile(
            "\\s*(?:#|N[°º.]?|NRO\\.?|NUM\\.?|NUMERO)\\s*$", Pattern.CASE_INSENSITIVE);
    private static final Set<String> PREFIXES = Set.of("AV", "AVDA", "AVENIDA", "CALLE", "PASAJE", "PJE", "PSJE");

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
}
