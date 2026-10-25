package com.microboxlabs.miot.trips.store;

import com.microboxlabs.miot.trips.domain.Stage;
import com.microboxlabs.miot.trips.domain.StageActivity;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Stages (the state machine of a subject) and their activities. Every call is tenant-scoped. */
public interface StageStore {

    /** Inserts with the next seq of the subject. */
    Stage insert(Stage stage);

    Optional<Stage> find(String tenantCode, UUID id);

    List<Stage> listBySubject(String tenantCode, String subjectType, UUID subjectId);

    /** Patches the planning window and location. */
    Optional<Stage> update(Stage stage);

    /** pending → in_progress; empty when the stage is not pending. The partial unique index rejects a second running stage. */
    Optional<Stage> start(String tenantCode, UUID id, OffsetDateTime at, String actor);

    /** in_progress → completed; empty when the stage is not in_progress. */
    Optional<Stage> close(String tenantCode, UUID id, OffsetDateTime at, String actor);

    /** Inserts with the next seq of the stage. */
    StageActivity insertActivity(StageActivity activity);

    Optional<StageActivity> findActivity(String tenantCode, UUID id);

    List<StageActivity> listActivities(String tenantCode, UUID stageId);

    Optional<StageActivity> updateActivity(StageActivity activity);
}
