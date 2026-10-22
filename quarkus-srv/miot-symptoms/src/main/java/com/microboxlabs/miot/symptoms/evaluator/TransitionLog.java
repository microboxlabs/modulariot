package com.microboxlabs.miot.symptoms.evaluator;

import java.util.List;

/** Where the evaluator records the case changes it finds. Appending a change it already holds does nothing. */
public interface TransitionLog {

    void append(String tenantCode, List<Transition> transitions);
}
