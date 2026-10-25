package com.microboxlabs.miot.symptoms.dto;

import java.util.List;

/** One page of the contact book. {@code next} asks for the following page; null on the last one. */
public record ContactPage(List<ContactView> items, String next) {
}
