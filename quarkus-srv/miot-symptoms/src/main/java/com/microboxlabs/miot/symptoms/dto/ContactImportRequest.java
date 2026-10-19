package com.microboxlabs.miot.symptoms.dto;

import java.util.List;

/** Body of {@code POST /contacts/import}: the contacts to create, in file order. */
public record ContactImportRequest(List<ContactRequest> contacts) {
}
