package com.example.api.service;

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Base64;
import java.util.regex.Pattern;
import javax.imageio.ImageIO;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class GameEventImageService {

    private static final int MAX_ICON_SIZE = 16;
    private static final int MAX_IMAGE_BYTES = 48 * 1024;
    private static final Pattern DATA_URL = Pattern.compile("^data:image/[^;]+;base64,(.+)$", Pattern.CASE_INSENSITIVE);

    /**
     * Validates optional image payload: must decode to a raster image with width and height at most 16.
     * Accepts a data URL ({@code data:image/png;base64,...}) or raw base64 without prefix.
     */
    public void validateOptionalImageData(String imageData) {
        if (imageData == null || imageData.isBlank()) {
            return;
        }
        String trimmed = imageData.trim();
        if (trimmed.length() > MAX_IMAGE_BYTES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "image data is too large");
        }

        String base64Part = trimmed;
        var m = DATA_URL.matcher(trimmed);
        if (m.matches()) {
            base64Part = m.group(1).replaceAll("\\s", "");
        }

        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(base64Part);
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "image data is not valid base64");
        }
        if (bytes.length > MAX_IMAGE_BYTES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "image data is too large");
        }

        BufferedImage image;
        try (ByteArrayInputStream in = new ByteArrayInputStream(bytes)) {
            image = ImageIO.read(in);
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "could not read image");
        }
        if (image == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "unsupported or empty image format");
        }
        if (image.getWidth() > MAX_ICON_SIZE || image.getHeight() > MAX_ICON_SIZE) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "image must be at most " + MAX_ICON_SIZE + "x" + MAX_ICON_SIZE + " pixels");
        }
    }
}
