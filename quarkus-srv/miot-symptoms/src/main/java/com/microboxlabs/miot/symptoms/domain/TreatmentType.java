package com.microboxlabs.miot.symptoms.domain;

/**
 * The form the operator opened the treatment from. An episode opened as a call
 * can still end in an ignore or invalidate action: the treatment screen lets
 * the operator switch forms without leaving the episode.
 */
public enum TreatmentType {
    CALL,
    IGNORE_CONDITION,
    INVALIDATE_SYMPTOM
}
