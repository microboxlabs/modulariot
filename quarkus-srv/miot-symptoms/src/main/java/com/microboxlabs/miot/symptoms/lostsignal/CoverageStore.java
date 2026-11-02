package com.microboxlabs.miot.symptoms.lostsignal;

import com.microboxlabs.miot.symptoms.lostsignal.CoverageDay.CellDay;
import com.microboxlabs.miot.symptoms.lostsignal.CoverageDay.SenderDay;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;

/** The shadow map's day rows ({@code miot_symptoms.coverage_*}). */
public interface CoverageStore {

    /** The days from {@code from} on that the job finished. */
    Set<LocalDate> done(LocalDate from);

    /** Replaces the day's rows and marks it finished. */
    void replace(LocalDate day, List<CellDay> cells, List<SenderDay> senders, long frames);

    List<CellDay> cells(LocalDate from);

    List<SenderDay> senders(LocalDate from);

    /** Writes the {@code anomalous} flag of these sender-days. */
    void flag(List<SenderDay> senders);

    /** Deletes the days before {@code before}. */
    void purge(LocalDate before);
}
