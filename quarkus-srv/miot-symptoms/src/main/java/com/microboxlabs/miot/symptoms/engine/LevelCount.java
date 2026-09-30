package com.microboxlabs.miot.symptoms.engine;

/** How many cases of a symptom reached an ICU level. */
public record LevelCount(String symptomName, int icu, long cases) {
}
