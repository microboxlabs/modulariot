package com.microboxlabs.miot.symptoms.metrics;

import com.microboxlabs.miot.symptoms.process.ProcessOutcome;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Tags;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import org.eclipse.microprofile.config.inject.ConfigProperty;

@ApplicationScoped
public class SymptomMetrics {

    private final Instance<MeterRegistry> registry;
    private final String subscription;

    SymptomMetrics(
            Instance<MeterRegistry> registry,
            @ConfigProperty(name = "miot.symptoms.pulsar.subscription", defaultValue = "miot-symptoms-dispatcher")
                    String subscription) {
        this.registry = registry;
        this.subscription = subscription;
    }

    public void record(ProcessOutcome outcome) {
        if (!registry.isResolvable()) {
            return;
        }
        MeterRegistry meters = registry.get();
        if (outcome.kind() == ProcessOutcome.Kind.SKIPPED) {
            Counter.builder("symptom.messages.skipped")
                    .tags(Tags.of("subscription", subscription, "reason", outcome.reason()))
                    .register(meters)
                    .increment();
            return;
        }
        String symptom = outcome.symptom() == null ? "unknown" : outcome.symptom();
        Counter.builder("symptom.messages.processed")
                .tags(Tags.of("subscription", subscription, "symptom", symptom))
                .register(meters)
                .increment();
    }

    public void recordError(String symptom) {
        if (!registry.isResolvable()) {
            return;
        }
        Counter.builder("symptom.processing.errors")
                .tags(Tags.of(
                        "subscription",
                        subscription,
                        "symptom",
                        symptom == null ? "unknown" : symptom))
                .register(meters())
                .increment();
    }

    private MeterRegistry meters() {
        return registry.get();
    }
}
