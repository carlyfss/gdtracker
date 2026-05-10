# syntax=docker/dockerfile:1.7
# Multi-arch (arm64/arm) via golang:alpine; minimal scratch runtime for Raspberry Pi and small servers.

FROM golang:1.23-alpine AS build
WORKDIR /src

RUN apk add --no-cache ca-certificates

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/gdtracker-go-api ./cmd/gdtracker-go-api

FROM scratch

COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=build /out/gdtracker-go-api /gdtracker-go-api

USER 65532:65532
EXPOSE 8080
ENTRYPOINT ["/gdtracker-go-api"]
