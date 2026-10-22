package com.example.parserfix;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;

/** Repository of widgets used by the parser-fix equivalence fixture. */
public class Sample<T extends Comparable<T>> {
    private final List<T> items = new ArrayList<>();

    /** Creates an empty sample. */
    public Sample() {}

    /** Creates a sample seeded with one item. */
    public Sample(T first) { items.add(first); }

    /**
     * Adds an item and returns the new size.
     * @param item the item
     */
    @Deprecated
    public synchronized int add(T item) {
        items.add(item);
        return items.size();
    }

    public int add(T item, int times) {
        for (int i = 0; i < times; i++) add(item);
        return items.size();
    }

    // Finds the maximum item, or null.
    public T max() {
        T best = null;
        for (T t : items) if (best == null || t.compareTo(best) > 0) best = t;
        return best;
    }

    public <R> List<R> map(Function<T, R> fn) {
        List<R> out = new ArrayList<>();
        items.forEach(x -> out.add(fn.apply(x)));
        return out;
    }

    static class Inner {
        /** Inner helper. */
        int helper(int x) { return x * 2; }
    }

    interface Visitor<V> {
        V visit(Object o);
        default V visitAll(List<Object> os) { return os.isEmpty() ? null : visit(os.get(0)); }
    }

    enum Mode {
        FAST, SLOW;
        boolean isFast() { return this == FAST; }
    }
}
