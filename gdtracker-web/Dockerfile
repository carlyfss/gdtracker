# syntax=docker/dockerfile:1.7

# ---------- Stage 1: build the static SPA bundle ----------
FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies first for better layer caching.
COPY package.json package-lock.json ./
RUN npm ci

# VITE_API_BASE_URL is baked into the bundle at build time.
# Pass it via `--build-arg VITE_API_BASE_URL=...` (compose reads it from .env).
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

ARG VITE_AUTH_MODE="session"
ENV VITE_AUTH_MODE=$VITE_AUTH_MODE

ARG VITE_AUTH0_DOMAIN=""
ENV VITE_AUTH0_DOMAIN=$VITE_AUTH0_DOMAIN

ARG VITE_AUTH0_CLIENT_ID=""
ENV VITE_AUTH0_CLIENT_ID=$VITE_AUTH0_CLIENT_ID

ARG VITE_AUTH0_AUDIENCE=""
ENV VITE_AUTH0_AUDIENCE=$VITE_AUTH0_AUDIENCE

COPY . .
RUN if [ "$VITE_AUTH_MODE" = "auth0" ]; then \
      test -n "$VITE_AUTH0_DOMAIN" && test -n "$VITE_AUTH0_CLIENT_ID" && test -n "$VITE_AUTH0_AUDIENCE" \
        || (echo "ERROR: VITE_AUTH0_DOMAIN, VITE_AUTH0_CLIENT_ID, and VITE_AUTH0_AUDIENCE are required when VITE_AUTH_MODE=auth0" >&2; exit 1); \
    fi
RUN npm run build

# ---------- Stage 2: serve the bundle with nginx ----------
FROM nginx:alpine AS runtime

# SPA-friendly nginx config (try_files fallback for client-side routing).
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q -O - http://127.0.0.1/ >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
