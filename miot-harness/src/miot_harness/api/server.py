from pathlib import Path

from fastapi import FastAPI

from miot_harness.config import get_settings
from miot_harness.runtime.context import UserRequest
from miot_harness.runtime.factory import build_harness
from miot_harness.runtime.run_store import HarnessRunRecord


def create_app() -> FastAPI:
    settings = get_settings()
    harness = build_harness(Path(settings.workspace_dir))
    app = FastAPI(title="MIOT Harness", version="0.1.0")

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok", "env": settings.env}

    @app.post("/runs", response_model=HarnessRunRecord)
    async def create_run(request: UserRequest) -> HarnessRunRecord:
        return await harness.run(request)

    @app.get("/runs/{run_id}", response_model=HarnessRunRecord)
    async def get_run(run_id: str) -> HarnessRunRecord:
        return harness.run_store.load(run_id)

    return app

