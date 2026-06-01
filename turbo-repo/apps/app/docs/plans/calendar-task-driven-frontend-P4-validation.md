# P4 — Verification record (manual test plan)

> Rung P4 of `calendar-task-driven-frontend-GOAL-LADDER.md`. Records
> the plan/assign/unplan/unassign checks for a **flag-on** origin and a
> **flag-off** origin against the dev environment.
>
> **Mode**: **manual test plan**. End-to-end execution against the live
> `dev-mintral.cl` stack requires (i) a browser session signed in to
> dev with `GROUP_PLANNING` + `GROUP_ASSIGNMENT`, (ii) `ecm-coordinator`
> trunk (including PR #259 / #265 for issues #257 + #262) deployed on
> dev ECM, (iii) at least one origin added to the dev
> `NEXT_PUBLIC_TASK_DRIVEN_ORIGINS` and a fresh deploy of `apps/app` to
> dev, and (iv) at least one in-progress service in that origin. None
> of (i)–(iv) can be set up from inside this goal-loop subprocess, so
> the deliverable here is the **recipe** for a human to run on dev with
> step-by-step expected observations. Per the rung's contract this
> alone satisfies acceptance criterion (b).
>
> Base SHA: `dbac5a6c437d23c8c987d8f374d29ec991717de1`.

---

## 1. Pre-flight (do once before the runs)

1. **ECM trunk includes #257 + #262.** Confirm on dev:
   - `gh pr view 259 --repo microboxlabs/ecm-coordinator --json state` → `MERGED`.
   - `gh pr view 265 --repo microboxlabs/ecm-coordinator --json state` → `MERGED`.
   - The dev ECM has been redeployed since both merged.
2. **Pick the flag-on origin code.** Open the dev kanban and read
   `mintral_originDelegateCode` for a representative service whose
   origin you want to migrate first — e.g. `ANTOFAGASTA`.
3. **Confirm ECM is configured for that origin.** SSH into dev ECM and
   `grep mintral.calendar.<origin>.defaultId` in the Alfresco
   global properties — the value must be a non-empty calendar UUID.
4. **Enable the origin in `apps/app` dev.** Set, in dev's env source
   (Vercel project / k8s ConfigMap / etc.):
   `NEXT_PUBLIC_TASK_DRIVEN_ORIGINS=<flag-on origin code>`. Rebuild +
   redeploy `apps/app` (NEXT_PUBLIC is baked at build time).
5. **Pick a flag-off origin.** Any active origin **not** in
   `NEXT_PUBLIC_TASK_DRIVEN_ORIGINS` — e.g. `CALAMA` when only
   `ANTOFAGASTA` was migrated above.
6. **Set up two services** on the dev kanban, one per origin, both at
   stage `planService` (not yet in a calendar).
7. **Tools open in the browser** for every step below:
   - DevTools **Network** tab, filtered to `XHR/Fetch`, recording
     persistent.
   - DevTools **Console** tab.
   - A second window with dev's Alfresco JavaScript Console (or a
     `ssh dev-ecm tail -f /opt/alfresco/tomcat/logs/alfresco.log`) for
     ECM-side checks.

---

## 2. Flag-on origin — full lifecycle

Service `S_on`, origin `ANTOFAGASTA` (or whichever code you added in
pre-flight step 4). Stage at start: `planService`.

### 2.1 PLAN — flag-on

| # | Action                                                                                  | Frontend expected observation                                                                                                                                                                                                                                                                                          | ECM-side expected observation                                                                                                                                                                                          |
|---|------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1 | Drag `S_on` to a slot in the planner and confirm.                                       | Network shows `POST /app/api/calendar/bookings` (201) and **NO** `POST /app/api/calendar/binding` (the binding endpoint is not called). The bookings request body contains `taskAdvance: {taskId, transitionId:"Asignar Conductor/Transporte"}` with **no** `processVariables` field.                                | `alfresco.log` shows `OnCreateAssignDriverBinding` firing for `S_on` and the binding row in `act_ru_variable` updated to `stage=unassigned` for the calendar. **No** `POST /mintral/calendar/binding` log entry.       |
| 2 | Reload the planner.                                                                     | `S_on` appears in the slot; sidebar shows it as "Planificado" (not assigned). The kanban column for `S_on` moves to `assignDriver`.                                                                                                                                                                                    | `act_ru_task` shows one open task on the workflow at `assignDriver`.                                                                                                                                                   |

### 2.2 ASSIGN — flag-on

| # | Action                                                                                  | Frontend expected observation                                                                                                                                                                                                                                                                                                                                       | ECM-side expected observation                                                                                                                                                                                                                                                            |
|---|------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1 | Open `S_on`'s sidebar, fill `carrier`, `driver`, `truck` (and optionally `driver2`, `trailer`), then click **Asignar**. | Network shows `PUT /app/api/calendar/bookings/<id>` (200) followed by `POST /app/api/calendar/bookings` (201) **OR** `POST /app/api/task/end` directly with body `{taskId, transitionId:"Presentar Conductor", processVariables:{...}}`. **NO** `POST /app/api/calendar/binding`. The `processVariables` object contains `carrier_id`, `driver_id`, `driver2_id`, `truck_id`, `trailer_id`, `carrier_external_id`, `tipo_servicio` (uppercased). | `alfresco.log` shows `EndTaskWebscript` received POST with `processVariables` body, sets them on the **PROCESS** scope (NOT task-local), then `OnCreatePresentDriverBinding` fires, reads the tuple from process scope, pushes to Alerce (`POST /alerce/...` 2xx), and updates the binding row to `stage=assigned`. |
| 2 | Verify process scope: in Alfresco JS Console run `workflow.getInstance("<workflowId>").properties.bpm_packageProperties` (or query `act_hi_varinst`). | n/a                                                                                                                                                                                                                                                                                                                                                                 | The PROCESS variables `carrier_id`, `driver_id`, `truck_id`, `tipo_servicio` (etc.) appear on `act_hi_varinst` with the same values from the POST body, scope = `process` (not `task`).                                                                                                  |
| 3 | Reload the planner.                                                                     | `S_on` shows as "Asignado" in the sidebar; the kanban moves to `presentDriver`.                                                                                                                                                                                                                                                                                     | `act_ru_task` shows one open task at `presentDriver`.                                                                                                                                                                                                                                    |

### 2.3 UNASSIGN — flag-on

| # | Action                                                                                  | Frontend expected observation                                                                                                                                                                                                                                                                              | ECM-side expected observation                                                                                                                                                                                  |
|---|------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1 | In `S_on`'s sidebar, click **Quitar asignación** (or equivalent unassign control).      | Network shows `POST /app/api/task/end` with body `{taskId, transitionId:"Asignar Conductor/Transporte"}` (no `processVariables`), followed by `PUT /app/api/calendar/bookings/<id>` to clear the tuple from `resource_data`. **NO** `POST /app/api/calendar/binding` (`stage=unassigned`) call.            | `alfresco.log` shows the task move + `OnCreateAssignDriverBinding` firing, updating the binding row to `stage=unassigned`. **No** `POST /mintral/calendar/binding` log entry from the frontend.               |
| 2 | Reload the planner.                                                                     | `S_on` is back to "Planificado" in the sidebar; the kanban moves back to `assignDriver`; the slot is still occupied.                                                                                                                                                                                       | `act_ru_task` shows one open task at `assignDriver`.                                                                                                                                                           |

### 2.4 UNPLAN — flag-on

| # | Action                                                                                  | Frontend expected observation                                                                                                                                                                                                                                                                | ECM-side expected observation                                                                                                                                                                          |
|---|------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1 | Drag `S_on` out of the slot (or click **Quitar del calendario**).                       | Network shows `POST /app/api/task/end` with `transitionId:"Planificar Servicio"` (no `processVariables`), then `DELETE /app/api/calendar/bookings/<id>`. **NO** `POST /app/api/calendar/binding` (`stage=none`) call.                                                                       | `alfresco.log` shows the task move + `OnCreateUnplannedBinding` firing, updating the binding row to `stage=none`. **No** `POST /mintral/calendar/binding` log entry.                                  |
| 2 | Reload the planner.                                                                     | `S_on` is back in the unplanned list; the kanban shows it at `planService` again.                                                                                                                                                                                                            | `act_ru_task` shows one open task at `planService`.                                                                                                                                                    |

---

## 3. Flag-off origin — full lifecycle (byte-for-byte unchanged)

Service `S_off`, origin **not** in `NEXT_PUBLIC_TASK_DRIVEN_ORIGINS`
(e.g. `CALAMA`). Goal of this section is to prove the legacy path is
**unchanged** — every call the planner made before #517 still fires
on this origin, and ECM still sees a `POST /mintral/calendar/binding`
for each state change.

### 3.1 PLAN — flag-off

| # | Action                                                                                  | Frontend expected observation                                                                                                                                                                                                                                                                                                | ECM-side expected observation                                                                                                                                                                          |
|---|------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1 | Drag `S_off` to a slot and confirm.                                                     | Network shows `POST /app/api/calendar/bookings` (201). Internally the bookings BFF makes a `POST /mintral/calendar/binding` call with `{stage:"planned", numero_servicio:<code>, calendar_id:<uuid>}` (visible in dev ECM logs but not in browser DevTools — the FE → ECM hop is server-side). The bookings response is 201. | `alfresco.log` shows `POST /mintral/calendar/binding stage=planned` for `S_off`, `act_ru_variable` updated, then the `EndTaskWebscript` advances `planService → assignDriver` via GET (no body).      |
| 2 | Reload the planner.                                                                     | Same UI outcome as flag-on §2.1.2 — "Planificado", kanban at `assignDriver`.                                                                                                                                                                                                                                                 | Same as flag-on §2.1.2 + a binding-call log entry was present.                                                                                                                                         |

### 3.2 ASSIGN — flag-off

| # | Action                                                                                  | Frontend expected observation                                                                                                                                                                                                                                                                                                                          | ECM-side expected observation                                                                                                                                                                                |
|---|------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1 | Fill the tuple in `S_off`'s sidebar and click **Asignar**.                              | Network shows `PUT /app/api/calendar/bookings/<id>` (200) or `POST /app/api/calendar/bookings` (201), `POST /app/api/task/end` with body `{taskId, transitionId:"Presentar Conductor"}` **WITHOUT** `processVariables`. The bookings BFF internally calls `POST /mintral/calendar/binding` with `stage="assigned"` and the full snake_case tuple.       | `alfresco.log` shows `POST /mintral/calendar/binding stage=assigned …` from the FE webscript, Alerce push from inside that webscript, then `EndTaskWebscript` GET advance. **No** `processVariables` body. |
| 2 | Reload the planner.                                                                     | Same UI outcome as flag-on §2.2.3 — "Asignado", kanban at `presentDriver`.                                                                                                                                                                                                                                                                             | One open task at `presentDriver`; binding row at `stage=assigned`.                                                                                                                                           |

### 3.3 UNASSIGN — flag-off

| # | Action                                                                                  | Frontend expected observation                                                                                                                                                                                                                                                | ECM-side expected observation                                                                                                                                       |
|---|------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1 | Click **Quitar asignación** on `S_off`.                                                 | Network shows `POST /app/api/task/end` with `transitionId:"Asignar Conductor/Transporte"`, `PUT /app/api/calendar/bookings/<id>` to clear the tuple, then `POST /app/api/calendar/binding` with `{stage:"unassigned", numero_servicio:<code>, calendar_id:<uuid>}`.        | `alfresco.log` shows the binding-call webscript log entry with `stage=unassigned`, in addition to the task-move log.                                                |
| 2 | Reload the planner.                                                                     | Same as flag-on §2.3.2.                                                                                                                                                                                                                                                      | Same.                                                                                                                                                                |

### 3.4 UNPLAN — flag-off

| # | Action                                                                                  | Frontend expected observation                                                                                                                                                                                                                                  | ECM-side expected observation                                                                                                                |
|---|------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------|
| 1 | Drag `S_off` out of the slot.                                                           | Network shows `POST /app/api/task/end` with `transitionId:"Planificar Servicio"`, `DELETE /app/api/calendar/bookings/<id>`, then `POST /app/api/calendar/binding` with `{stage:"none", numero_servicio:<code>, calendar_id:<uuid>}`.                          | `alfresco.log` shows the binding-call webscript log entry with `stage=none`, in addition to the task-move log.                              |
| 2 | Reload the planner.                                                                     | Same as flag-on §2.4.2.                                                                                                                                                                                                                                        | Same.                                                                                                                                        |

---

## 4. ECM-side spot-checks (shared)

Two checks that prove the two halves of #262's contract regardless of
which origin you ran:

### 4.1 Process scope, not task scope

After an ASSIGN on a flag-on origin (§2.2), in dev's Alfresco JS
Console:

```js
var w = workflow.getInstance("<workflowId>");
// processVariables on the process scope:
for (var k in w.properties) print(k + "=" + w.properties[k]);
// task-local on the still-open task:
print(JSON.stringify(w.activeTasks[0].properties));
```

The seven `*_id`/`tipo_servicio` keys must appear in the **process**
properties output. They must **not** appear in the task-local
properties output (that would be the bug §2.3 of the P0 spike doc
rejected — task-local variables die when the task completes).

### 4.2 Alerce push happened from `OnCreatePresentDriverBinding`

In `alfresco.log`, in the same request scope as the
`OnCreatePresentDriverBinding` invocation from §2.2.1, look for the
`POST /alerce/...` log entry and confirm a 2xx response. The Alerce
service body must contain the driver+truck+carrier the planner sent
— if it's empty / missing fields the process-scope copy in §2.2.2
silently failed and #262 needs another look.

---

## 5. Outcome record

When this recipe is run, fill in:

- **Run date:** `____-__-__`
- **Run by:** `_______`
- **Dev `apps/app` SHA:** `_______`
- **Dev `ecm-coordinator` SHA:** `_______`
- **`NEXT_PUBLIC_TASK_DRIVEN_ORIGINS` value at run time:** `_______`
- **Flag-on origin tested:** `_______`
- **Flag-off origin tested:** `_______`
- **Pass / fail per step (§2.1–§3.4):** `_______`
- **§4.1 process-scope spot-check passed:** yes / no
- **§4.2 Alerce push spot-check passed:** yes / no
- **Notes / deviations:** `_______`

A "pass" run, recorded here, retroactively closes the dev-env
acceptance arm of P4(b). Until then, the existence and clarity of
this recipe is the artifact P4(b) requires.
