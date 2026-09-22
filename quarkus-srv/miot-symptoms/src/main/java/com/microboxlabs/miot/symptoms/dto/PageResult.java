package com.microboxlabs.miot.symptoms.dto;

import java.util.List;

/** Offset-paged list. {@code page} is 1-based. */
public record PageResult<T>(List<T> items, long total, int page, int pageSize) {

    public int totalPages() {
        return pageSize <= 0 ? 0 : (int) Math.ceil((double) total / pageSize);
    }
}
