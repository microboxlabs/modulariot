package com.microboxlabs.miot.integrations.vehicleimages;

/** Where a CAR_IMAGES connection keeps its values. */
public final class CarImagesKeys {

    /** Connection metadata: the account key ({@code ci_...}). It is not secret: signed URLs carry it. */
    public static final String API_KEY = "apiKey";
    /** API_KEY_HEADER credential: the header name in public config, the secret under {@code value}. */
    public static final String SECRET = "value";
    public static final String SECRET_HEADER = "X-Api-Secret";

    private CarImagesKeys() {
    }
}
