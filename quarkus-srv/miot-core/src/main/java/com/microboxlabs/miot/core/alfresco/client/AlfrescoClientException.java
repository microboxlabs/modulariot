package com.microboxlabs.miot.core.alfresco.client;

/**
 * Unchecked wrapper for non-2xx responses from Alfresco REST calls.
 * Keeps one exception type on purpose — callers that care about a
 * specific status branch on {@link #getHttpStatus()} rather than
 * catching a taxonomy.
 */
public class AlfrescoClientException extends RuntimeException {

    private final int httpStatus;
    private final String alfrescoErrorKey;

    public AlfrescoClientException(int httpStatus, String alfrescoErrorKey, String briefSummary) {
        super("Alfresco " + httpStatus
                + (alfrescoErrorKey != null ? " [" + alfrescoErrorKey + "]" : "")
                + (briefSummary != null ? ": " + briefSummary : ""));
        this.httpStatus = httpStatus;
        this.alfrescoErrorKey = alfrescoErrorKey;
    }

    public int getHttpStatus() {
        return httpStatus;
    }

    public String getAlfrescoErrorKey() {
        return alfrescoErrorKey;
    }

    public boolean isNotFound() {
        return httpStatus == 404;
    }

    public boolean isConflict() {
        return httpStatus == 409;
    }

    public boolean isForbidden() {
        return httpStatus == 403;
    }
}
