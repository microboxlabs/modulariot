#!/usr/bin/env bash
set -euo pipefail

# ModularIoT — Dev mode launcher
#
# Usage:
#   ./start.sh                  # no components (bare server)
#   ./start.sh all              # all components
#   ./start.sh fleet            # fleet only
#   ./start.sh driver           # driver only
#   ./start.sh fleet driver     # fleet + driver
#
# Extra Maven/Quarkus args can be appended after --:
#   ./start.sh fleet -- -Dquarkus.http.port=9090

KNOWN_COMPONENTS=(fleet driver)
COMPONENTS=()
EXTRA_ARGS=()

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --)
            shift
            EXTRA_ARGS=("$@")
            break
            ;;
        all)
            COMPONENTS=("${KNOWN_COMPONENTS[@]}")
            shift
            ;;
        *)
            COMPONENTS+=("$1")
            shift
            ;;
    esac
done

# Build -D flags
PROPS=()
if [[ ${#COMPONENTS[@]} -eq 0 ]]; then
    echo "Starting with no components enabled"
elif printf '%s\n' "${COMPONENTS[@]}" | grep -qx "all" 2>/dev/null; then
    PROPS+=("-Dmiot.component.all.enabled=true")
    echo "Starting with all components"
else
    for comp in "${COMPONENTS[@]}"; do
        if printf '%s\n' "${KNOWN_COMPONENTS[@]}" | grep -qx "$comp"; then
            PROPS+=("-Dmiot.component.${comp}.enabled=true")
        else
            echo "Unknown component: $comp (known: ${KNOWN_COMPONENTS[*]})"
            exit 1
        fi
    done
    echo "Starting with: ${COMPONENTS[*]}"
fi

exec ./mvnw quarkus:dev -pl miot-cli ${PROPS[@]+"${PROPS[@]}"} ${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}
