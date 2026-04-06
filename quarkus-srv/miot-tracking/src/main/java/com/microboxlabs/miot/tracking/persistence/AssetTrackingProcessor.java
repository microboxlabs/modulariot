package com.microboxlabs.miot.tracking.persistence;

import cl.streamhub.gps.model.EnvelopedMessage;
import io.quarkus.arc.lookup.LookupIfProperty;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;
import org.jboss.logging.Logger;

/**
 * Three-step processing pipeline for asset tracking data persistence.
 *
 * <ol>
 *   <li>Insert raw position data into {@code asset_data}</li>
 *   <li>Cross-reference via {@code asset_client_map} and insert into {@code asset_data_client}</li>
 *   <li>Persist metrics (core / extension / DTC) with idempotency check</li>
 * </ol>
 */
@ApplicationScoped
@LookupIfProperty(name = "miot.component.tracking.enabled", stringValue = "true")
public class AssetTrackingProcessor {

    private static final Logger logger = Logger.getLogger(AssetTrackingProcessor.class);

    private final AssetDataRepository assetDataRepository;
    private final AssetDataClientRepository assetDataClientRepository;
    private final MetricsRepository metricsRepository;

    AssetTrackingProcessor(AssetDataRepository assetDataRepository,
            AssetDataClientRepository assetDataClientRepository,
            MetricsRepository metricsRepository) {
        this.assetDataRepository = assetDataRepository;
        this.assetDataClientRepository = assetDataClientRepository;
        this.metricsRepository = metricsRepository;
    }

    public Uni<Void> process(EnvelopedMessage message) {
        String assetId = message.getPayload().getAssetId();
        long processStart = System.currentTimeMillis();

        // Step 1: Insert into asset_data
        return assetDataRepository.save(message)
                .chain(assetDataId -> {
                    long assetDataTime = System.currentTimeMillis();
                    logger.infof("asset_data insert: %d ms - assetId: %s",
                            assetDataTime - processStart, assetId);

                    // Step 2: Cross-reference and save to asset_data_client
                    return assetDataClientRepository.crossReferenceAndSave(message, assetDataId)
                            .chain(crossRefResult -> {
                                long clientDataTime = System.currentTimeMillis();
                                logger.infof("client_data insert: %d ms - assetId: %s",
                                        clientDataTime - assetDataTime, assetId);

                                // Step 3: Metrics persistence
                                List<String> sharedClientIds = crossRefResult.getSharedClientIds();
                                if (!metricsRepository.hasMetrics(message)) {
                                    logger.infof("no metrics to process: assetId: %s", assetId);
                                    return Uni.createFrom().voidItem();
                                }
                                if (sharedClientIds.isEmpty()) {
                                    logger.infof("no shared clients found: assetId: %s", assetId);
                                    return Uni.createFrom().voidItem();
                                }

                                return metricsRepository
                                        .saveMetrics(
                                                message.getPayload().getMetrics(),
                                                sharedClientIds,
                                                assetDataId,
                                                message)
                                        .replaceWithVoid()
                                        .invoke(() -> {
                                            long metricsTime = System.currentTimeMillis();
                                            logger.infof("metrics insert: %d ms - assetId: %s",
                                                    metricsTime - clientDataTime, assetId);
                                        });
                            });
                });
    }
}
