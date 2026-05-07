package com.example.api.util;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import org.springframework.core.io.ClassPathResource;
import org.springframework.util.StreamUtils;

/**
 * Loads SQL statements from classpath {@code .sql} resources, caching content per path so each file
 * is read at most once per JVM. Use to keep SQL out of Java string literals (see code-reviewer Rule 1).
 */
public final class SqlResources {

    private static final ConcurrentMap<String, String> CACHE = new ConcurrentHashMap<>();

    private SqlResources() {}

    /**
     * Reads the SQL text at {@code classpath:<path>} and returns it verbatim, cached after first load.
     *
     * @param path classpath-relative resource path (e.g. {@code sql/tasks/aggregate.sql}).
     * @return UTF-8 contents of the resource.
     * @throws UncheckedIOException if the resource cannot be read.
     */
    public static String read(String path) {
        return CACHE.computeIfAbsent(path, SqlResources::loadFromClasspath);
    }

    private static String loadFromClasspath(String path) {
        ClassPathResource resource = new ClassPathResource(path);
        try (var in = resource.getInputStream()) {
            return StreamUtils.copyToString(in, StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to load SQL resource: " + path, e);
        }
    }
}
