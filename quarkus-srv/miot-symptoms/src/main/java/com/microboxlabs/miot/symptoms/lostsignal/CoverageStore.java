package com.microboxlabs.miot.symptoms.lostsignal;

import com.microboxlabs.miot.symptoms.lostsignal.CoverageDay.CellDay;
import com.microboxlabs.miot.symptoms.lostsignal.CoverageDay.SenderDay;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.function.Function;

/** The shadow map's day rows ({@code miot_symptoms.coverage_*}). */
public interface CoverageStore {

    /** The days from {@code from} on that the job finished. */
    Set<LocalDate> done(LocalDate from);

    /** Replaces the day's rows and marks it finished. */
    void replace(LocalDate day, List<CellDay> cells, List<SenderDay> senders, long frames);

    /** The plan made from the window's sender-days and the cell sums made with it. */
    record Window(ShadowMap.Plan plan, List<ShadowMap.CellSum> cells) {
    }

    /**
     * Reads the sender-days from {@code from}, makes the plan from them and sums the cell rows with it
     * ({@link ShadowMap#sum}), both from the same committed state.
     */
    Window window(LocalDate from, Function<List<SenderDay>, ShadowMap.Plan> plan);

    /** Every cell row from {@code from}; for tests, a window holds about 11 thousand per day. */
    List<CellDay> cells(LocalDate from);

    List<SenderDay> senders(LocalDate from);

    /** Writes the {@code anomalous} flag of these sender-days. */
    void flag(List<SenderDay> senders);

    /** Deletes the days before {@code before}. */
    void purge(LocalDate before);
}
