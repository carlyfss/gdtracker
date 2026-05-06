# syntax=docker/dockerfile:1.7

# ---------- Stage 1: build the Spring Boot fat jar ----------
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /workspace

# Prime the dependency cache first to make subsequent rebuilds faster.
COPY pom.xml ./
RUN mvn -B -q -e -DskipTests dependency:go-offline

# Copy the rest of the project and package.
# Tests are skipped here; run them locally or in CI before building the image.
COPY checkstyle.xml lombok.config ./
COPY src ./src
RUN mvn -B -q -e -DskipTests clean package

# ---------- Stage 2: minimal JRE runtime ----------
FROM eclipse-temurin:21-jre AS runtime
WORKDIR /app

# Run as a non-root user.
RUN groupadd --system --gid 1001 spring \
    && useradd --system --uid 1001 --gid 1001 --home-dir /app --shell /sbin/nologin spring

COPY --from=build /workspace/target/gdtracker-api-*.jar /app/app.jar
RUN chown -R spring:spring /app

USER spring
EXPOSE 8080

# DB_URL, DB_USERNAME, DB_PASSWORD, SERVER_PORT are read from the container env.
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
