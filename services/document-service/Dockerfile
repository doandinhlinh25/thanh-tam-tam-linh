FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /build
COPY services/document-service/pom.xml ./
RUN mvn -B dependency:go-offline
COPY services/document-service/src ./src
RUN mvn -B -DskipTests package

FROM eclipse-temurin:21-jre-jammy
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/* \
    && useradd --system --create-home document
WORKDIR /app
COPY --from=build /build/target/document-service-1.0.0.jar ./document.jar
USER document
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/document.jar"]
