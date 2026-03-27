package com.microboxlabs.miot.assignment.config;

import io.quarkus.arc.Arc;
import io.quarkus.arc.InstanceHandle;
import io.quarkus.reactive.datasource.ReactiveDataSource;
import io.vertx.mutiny.pgclient.PgPool;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.util.AnnotationLiteral;

@ApplicationScoped
public class AssignmentReactivePools {

    public PgPool coordinatorPool() {
        return resolvePool(AssignmentDataSourceNames.COORDINATOR);
    }

    public PgPool streamHubPool() {
        return resolvePool(AssignmentDataSourceNames.STREAMHUB);
    }

    private PgPool resolvePool(String datasourceName) {
        InstanceHandle<PgPool> handle = Arc.container().instance(PgPool.class, new ReactiveDataSourceLiteral(datasourceName));
        if (!handle.isAvailable()) {
            throw new IllegalStateException("Reactive datasource is not available: " + datasourceName);
        }
        return handle.get();
    }

    private static final class ReactiveDataSourceLiteral extends AnnotationLiteral<ReactiveDataSource>
            implements ReactiveDataSource {

        private final String value;

        private ReactiveDataSourceLiteral(String value) {
            this.value = value;
        }

        @Override
        public String value() {
            return value;
        }
    }
}
