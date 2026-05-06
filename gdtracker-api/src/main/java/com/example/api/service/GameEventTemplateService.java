package com.example.api.service;

import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class GameEventTemplateService {

    private static final int MAX_TEMPLATE_LENGTH = 100;
    private static final int MAX_OUTPUT_LENGTH = 100;
    private static final Pattern PLACEHOLDER = Pattern.compile("<([A-Z0-9_]+)>");

    public String render(String messageTemplate, Map<String, String> parameters) {
        if (messageTemplate == null || messageTemplate.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "message template is required");
        }
        if (messageTemplate.length() > MAX_TEMPLATE_LENGTH) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "message template exceeds " + MAX_TEMPLATE_LENGTH + " characters");
        }

        Map<String, String> normalized = normalizeKeys(parameters);

        Matcher matcher = PLACEHOLDER.matcher(messageTemplate);
        StringBuffer out = new StringBuffer();
        while (matcher.find()) {
            String token = matcher.group(1);
            if (!normalized.containsKey(token)) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "missing parameter for placeholder <" + token + "> in template");
            }
            String value = normalized.get(token);
            matcher.appendReplacement(out, Matcher.quoteReplacement(value != null ? value : ""));
        }
        matcher.appendTail(out);

        String rendered = out.toString();
        if (rendered.length() > MAX_OUTPUT_LENGTH) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "rendered message exceeds " + MAX_OUTPUT_LENGTH + " characters");
        }
        return rendered;
    }

    /**
     * Keys are normalized to uppercase so {@code player_id} matches placeholder {@code <PLAYER_ID>}.
     */
    public Map<String, String> normalizeKeys(Map<String, String> raw) {
        if (raw == null || raw.isEmpty()) {
            return Map.of();
        }
        Map<String, String> normalized = new HashMap<>();
        for (Map.Entry<String, String> e : raw.entrySet()) {
            if (e.getKey() == null || e.getKey().isBlank()) {
                continue;
            }
            String k = e.getKey().trim().toUpperCase().replace('-', '_');
            normalized.put(k, e.getValue() != null ? e.getValue() : "");
        }
        return normalized;
    }
}
