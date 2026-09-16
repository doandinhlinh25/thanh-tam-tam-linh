FROM eclipse-temurin:21-jdk AS build

WORKDIR /workspace

ARG MODULE_PATH
ARG MODULE_ARTIFACT

COPY .mvn .mvn
COPY mvnw mvnw
COPY pom.xml pom.xml
COPY services services

RUN chmod +x mvnw && ./mvnw -pl ":${MODULE_ARTIFACT}" -am package -DskipTests

FROM eclipse-temurin:21-jre

WORKDIR /application

ARG MODULE_PATH

COPY --from=build /workspace/${MODULE_PATH}/target/*.jar application.jar

ENTRYPOINT ["java", "-jar", "application.jar"]
