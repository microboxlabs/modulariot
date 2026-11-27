package com.microboxlabs.miot.teltonika.server;

import io.vertx.core.Context;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.function.Consumer;

/**
 * Global bound on records being published at once, granted in arrival order. When thousands of
 * devices reconnect and flush their buffers, sessions wait in line (their sockets stay paused, TCP
 * pushes back) instead of flooding the publisher; a large packet is not starved by small ones, and a
 * session that waits past its deadline gives up ({@link #cancel}) so the device resends instead of
 * getting a late acknowledgment.
 */
public final class PublishGate {

    /** A place in line. */
    public static final class Ticket {
        private final int permits;
        private final Context context;
        private final Consumer<Boolean> callback;
        private boolean done;

        private Ticket(int permits, Context context, Consumer<Boolean> callback) {
            this.permits = permits;
            this.context = context;
            this.callback = callback;
        }
    }

    private final int capacity;
    private final Deque<Ticket> waiting = new ArrayDeque<>();
    private int available;

    public PublishGate(int capacity) {
        if (capacity < 1) {
            throw new IllegalArgumentException("capacity must be positive");
        }
        this.capacity = capacity;
        this.available = capacity;
    }

    /**
     * Asks for room for {@code records}. {@code callback} runs on {@code context} with {@code true}
     * when granted, or {@code false} when cancelled. Granted immediately if nobody waits ahead.
     */
    public Ticket acquire(int records, Context context, Consumer<Boolean> callback) {
        Ticket t = new Ticket(permitsFor(records), context, callback);
        boolean now;
        synchronized (this) {
            now = waiting.isEmpty() && available >= t.permits;
            if (now) {
                available -= t.permits;
                t.done = true;
            } else {
                waiting.addLast(t);
            }
        }
        if (now) {
            callback.accept(true);
        }
        return t;
    }

    /** Gives up a place still waiting; false if it was already granted or cancelled. */
    public boolean cancel(Ticket t) {
        synchronized (this) {
            if (t.done || !waiting.remove(t)) {
                return false;
            }
            t.done = true;
        }
        t.context.runOnContext(v -> t.callback.accept(false));
        return true;
    }

    public void release(int records) {
        Deque<Ticket> granted = new ArrayDeque<>();
        synchronized (this) {
            available = Math.min(capacity, available + permitsFor(records));
            while (!waiting.isEmpty() && waiting.peekFirst().permits <= available) {
                Ticket next = waiting.pollFirst();
                available -= next.permits;
                next.done = true;
                granted.add(next);
            }
        }
        granted.forEach(t -> t.context.runOnContext(v -> t.callback.accept(true)));
    }

    public synchronized int inFlight() {
        return capacity - available;
    }

    public synchronized int waiting() {
        return waiting.size();
    }

    private int permitsFor(int records) {
        return Math.max(1, Math.min(records, capacity));
    }
}
