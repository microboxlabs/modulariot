package com.microboxlabs.miot.integrations.auth.basic;

public record BasicAuthConfig(
        String username,
        String password) {

    @Override
    public String toString() {
        return "BasicAuthConfig[username=" + username + ", password=<redacted>]";
    }
}
