package com.microboxlabs.miot.fleet.directory;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/** {@link ActivityStore} in memory, for dev mode and tests. */
public class InMemoryActivityStore implements ActivityStore {

    private final Map<String, ActivityHour> hours = new ConcurrentHashMap<>();
    private final Map<String, ActivityDay> days = new ConcurrentHashMap<>();
    private final Map<String, String> dayAsset = new ConcurrentHashMap<>();
    private final Map<String, Instant> cursors = new ConcurrentHashMap<>();

    @Override
    public synchronized void saveHours(Instant from, Instant to, List<ActivityHour> saved, ZoneId zone) {
        hours.values().removeIf(h -> !h.hour().isBefore(from) && h.hour().isBefore(to));
        Set<LocalDate> touched = new HashSet<>();
        for (ActivityHour h : saved) {
            hours.put(h.assetId() + "@" + h.hour(), h);
            touched.add(h.hour().atZone(zone).toLocalDate());
        }
        touched.add(from.atZone(zone).toLocalDate());
        touched.add(to.minusSeconds(1).atZone(zone).toLocalDate());
        Map<String, List<ActivityHour>> byDay = new HashMap<>();
        for (ActivityHour h : hours.values()) {
            LocalDate day = h.hour().atZone(zone).toLocalDate();
            if (touched.contains(day)) {
                byDay.computeIfAbsent(h.assetId() + "@" + day, k -> new ArrayList<>()).add(h);
            }
        }
        byDay.forEach((key, list) -> {
            LocalDate day = list.get(0).hour().atZone(zone).toLocalDate();
            days.put(key, new ActivityDay(day, list.stream().mapToInt(ActivityHour::signals).sum(),
                    list.stream().mapToInt(ActivityHour::engineSeconds).sum(),
                    list.stream().mapToInt(ActivityHour::idleSeconds).sum(),
                    list.stream().mapToInt(ActivityHour::movingSeconds).sum(),
                    list.stream().mapToDouble(ActivityHour::km).sum()));
            dayAsset.put(key, list.get(0).assetId());
        });
    }

    @Override
    public List<ActivityDay> days(String assetId, LocalDate from, LocalDate to) {
        List<ActivityDay> found = new ArrayList<>();
        days.forEach((key, day) -> {
            if (assetId.equals(dayAsset.get(key)) && !day.day().isBefore(from) && !day.day().isAfter(to)) {
                found.add(day);
            }
        });
        found.sort(Comparator.comparing(ActivityDay::day));
        return found;
    }

    @Override
    public Map<String, ActivityTotals> totals(Collection<String> assetIds, LocalDate from, LocalDate to) {
        Map<String, ActivityTotals> found = new HashMap<>();
        for (String id : assetIds) {
            List<ActivityDay> list = days(id, from, to);
            if (!list.isEmpty()) {
                found.put(id, new ActivityTotals(list.stream().mapToDouble(ActivityDay::km).sum(),
                        list.stream().mapToLong(ActivityDay::engineSeconds).sum(),
                        list.stream().mapToLong(ActivityDay::idleSeconds).sum(),
                        list.stream().mapToLong(ActivityDay::movingSeconds).sum(),
                        (int) list.stream().filter(d -> d.movingSeconds() > 0).count()));
            }
        }
        return found;
    }

    @Override
    public Optional<Instant> cursor(String name) {
        return Optional.ofNullable(cursors.get(name));
    }

    @Override
    public void cursor(String name, Instant value) {
        cursors.put(name, value);
    }

    @Override
    public synchronized void prune(Instant hoursBefore, LocalDate daysBefore) {
        hours.values().removeIf(h -> h.hour().isBefore(hoursBefore));
        days.entrySet().removeIf(e -> e.getValue().day().isBefore(daysBefore));
    }
}
