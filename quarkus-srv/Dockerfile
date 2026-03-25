FROM eclipse-temurin:21-jre-alpine

WORKDIR /app
COPY miot-cli/target/quarkus-app/ /app/

ENTRYPOINT ["java", "-jar", "quarkus-run.jar"]
CMD ["miot", "all"]
