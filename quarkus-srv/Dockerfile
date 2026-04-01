FROM registry.access.redhat.com/ubi9/openjdk-21:1.23

ENV LANGUAGE='en_US:en'

WORKDIR /deployments

# Four distinct layers for optimal cache reuse:
# lib/ and quarkus/ change rarely; app/ changes on each build
COPY --chown=185 miot-cli/target/quarkus-app/lib/     /deployments/lib/
COPY --chown=185 miot-cli/target/quarkus-app/*.jar    /deployments/
COPY --chown=185 miot-cli/target/quarkus-app/app/     /deployments/app/
COPY --chown=185 miot-cli/target/quarkus-app/quarkus/ /deployments/quarkus/

EXPOSE 8180
USER 185

ENV JAVA_OPTS_APPEND="-Dquarkus.http.host=0.0.0.0 -Djava.util.logging.manager=org.jboss.logmanager.LogManager"
ENV JAVA_APP_JAR="/deployments/quarkus-run.jar"

ENTRYPOINT ["/opt/jboss/container/java/run/run-java.sh"]

# Default: start all components. Override to select specific ones:
#   docker run <image> miot fleet
#   docker run <image> miot driver
#   docker run <image> miot fleet driver
CMD ["miot", "all"]
