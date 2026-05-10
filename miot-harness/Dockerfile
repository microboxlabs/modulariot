# syntax=docker/dockerfile:1.7
# =============================================================================
# miot-harness — ASK MIOT multi-agent backend
# -----------------------------------------------------------------------------
# Multi-stage uv build per plan 13-server-deployment/02-image-build.md.
# - Reproducible from uv.lock (--frozen).
# - Builder is the only stage with build tools; runtime is python:3.12-slim
#   with /app/.venv copied in.
# - Runs as numeric UID 65534 (`nobody`) so K8s pod-security policies pass
#   without an explicit `runAsNonRoot`.
# =============================================================================

ARG PYTHON_IMAGE=python:3.12-slim

# ---------------------------------------------------------------------------
# Builder — install deps + project into /app/.venv
# ---------------------------------------------------------------------------
FROM ${PYTHON_IMAGE} AS builder

# uv is published as a slim OCI image; we copy the static binary in.
# Pinning to a version (rather than :latest) keeps builds reproducible.
COPY --from=ghcr.io/astral-sh/uv:0.5 /uv /usr/local/bin/uv

ENV UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    UV_PROJECT_ENVIRONMENT=/app/.venv

WORKDIR /app

# Layer 1: deps only. Cached unless pyproject.toml or uv.lock change.
COPY pyproject.toml uv.lock README.md ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project

# Layer 2: project source + final venv linkage.
# `--no-editable` is critical: without it uv installs miot-harness as an
# editable link to /app/src, which breaks at runtime (the runtime stage
# only copies /app/.venv, not the src tree).
COPY src ./src
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-editable

# ---------------------------------------------------------------------------
# Runtime — slim, no build tools, non-root
# ---------------------------------------------------------------------------
FROM ${PYTHON_IMAGE} AS runtime

ARG HARNESS_VERSION=0.0.0-dev

LABEL org.opencontainers.image.title="miot-harness" \
      org.opencontainers.image.description="ASK MIOT multi-agent backend harness" \
      org.opencontainers.image.vendor="MicroboxLabs" \
      org.opencontainers.image.licenses="Apache-2.0" \
      org.opencontainers.image.version="${HARNESS_VERSION}" \
      org.opencontainers.image.source="https://github.com/microboxlabs/modulariot"

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    MIOT_HARNESS_WORKSPACE_DIR=/app/.miot-workspace

WORKDIR /app

# Bring only the built venv. The package itself was installed into
# /app/.venv/lib/.../site-packages/miot_harness/ during builder's
# `uv sync`, so no separate src/ copy is needed at runtime.
COPY --from=builder /app/.venv /app/.venv

# Pre-create the workspace dir owned by 65534 so the container can run
# under a read-only root filesystem in production (only this dir is
# writable; mount as emptyDir/PVC).
RUN install -d -o 65534 -g 65534 /app/.miot-workspace

USER 65534:65534

EXPOSE 8000

CMD ["uvicorn", "miot_harness.api.server:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000"]
