package com.microboxlabs.miot.teltonika.catalog;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

/** The models the platform receives. Reference data: read once, it changes only with a migration. */
public interface ModelCatalog {

    List<DeviceModel> all();

    default Optional<DeviceModel> find(String code) {
        if (code == null) {
            return Optional.empty();
        }
        String c = code.trim().toUpperCase(Locale.ROOT);
        return all().stream().filter(m -> m.code().equals(c)).findFirst();
    }

    /** The model for a registration; FMB920 when none is given. */
    default DeviceModel require(String code) {
        String c = code == null || code.isBlank() ? "FMB920" : code;
        return find(c).orElseThrow(() -> new IllegalArgumentException("model must be one of "
                + all().stream().map(DeviceModel::code).sorted().toList()));
    }

    /** Native unless the catalog says otherwise (an unknown model is treated as native). */
    default String via(String code) {
        return find(code).map(DeviceModel::via).orElse(DeviceModel.NATIVE);
    }

    /** A fixed list, for tests and as a fallback. */
    static ModelCatalog of(List<DeviceModel> models) {
        List<DeviceModel> sorted = models.stream()
                .sorted(Comparator.comparing(DeviceModel::brand).thenComparing(DeviceModel::code)).toList();
        Map<String, DeviceModel> byCode = sorted.stream()
                .collect(Collectors.toMap(DeviceModel::code, Function.identity()));
        return new ModelCatalog() {
            @Override
            public List<DeviceModel> all() {
                return sorted;
            }

            @Override
            public Optional<DeviceModel> find(String code) {
                return code == null ? Optional.empty()
                        : Optional.ofNullable(byCode.get(code.trim().toUpperCase(Locale.ROOT)));
            }
        };
    }
}
