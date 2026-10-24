package com.microboxlabs.miot.core.db;

import java.util.function.Supplier;

/**
 * Runs a domain operation as one unit: every store call inside {@code work} commits together or
 * not at all, and the rows it reads stay locked until the end. A nested call joins the outer one.
 */
public interface Transactions {

    <T> T inTransaction(Supplier<T> work);

    default void inTransaction(Runnable work) {
        inTransaction(() -> {
            work.run();
            return null;
        });
    }

    /** No transaction: for stores without one, like an in-memory test world. */
    static Transactions none() {
        return new Transactions() {
            @Override
            public <T> T inTransaction(Supplier<T> work) {
                return work.get();
            }
        };
    }
}
