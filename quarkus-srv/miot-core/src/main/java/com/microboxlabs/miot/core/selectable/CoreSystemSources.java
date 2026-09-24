package com.microboxlabs.miot.core.selectable;

import jakarta.enterprise.context.ApplicationScoped;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.Currency;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** Dynamic lists core can serve with no other component: time zones and currencies. */
final class CoreSystemSources {

    private CoreSystemSources() {
    }

    /** Every region-based time zone, labelled with its current UTC offset. */
    @ApplicationScoped
    static class TimeZones extends ListedSystemSource {

        static final String ID = "core.timezones";

        TimeZones() {
            super(ID, Localized.of("Zonas horarias", "Time zones"),
                    Localized.of("Todas las zonas horarias IANA, con su desfase actual.",
                            "Every IANA time zone, with its current offset."));
        }

        @Override
        protected List<SelectableOption> all(String tenantCode) {
            Instant now = Instant.now();
            return ZoneId.getAvailableZoneIds().stream()
                    .filter(id -> id.contains("/") && !id.startsWith("Etc/") && !id.startsWith("SystemV/"))
                    .sorted()
                    .map(id -> {
                        ZoneOffset offset = ZoneId.of(id).getRules().getOffset(now);
                        String text = id.replace('_', ' ') + " (UTC" + (offset.getTotalSeconds() == 0 ? "" : offset) + ")";
                        return new SelectableOption(id, Map.of("es", text, "en", text), Map.of(), null, null, null,
                                null, false);
                    })
                    .toList();
        }
    }

    /** ISO 4217 currencies, named in Spanish and English. */
    @ApplicationScoped
    static class Currencies extends ListedSystemSource {

        static final String ID = "core.currencies";
        private static final Locale SPANISH = Locale.forLanguageTag("es");

        Currencies() {
            super(ID, Localized.of("Monedas", "Currencies"),
                    Localized.of("Monedas ISO 4217.", "ISO 4217 currencies."));
        }

        @Override
        protected List<SelectableOption> all(String tenantCode) {
            return Currency.getAvailableCurrencies().stream()
                    .sorted(Comparator.comparing(Currency::getCurrencyCode))
                    .map(c -> SelectableOption.of(c.getCurrencyCode(),
                            c.getCurrencyCode() + " — " + c.getDisplayName(SPANISH),
                            c.getCurrencyCode() + " — " + c.getDisplayName(Locale.ENGLISH)))
                    .toList();
        }
    }
}
