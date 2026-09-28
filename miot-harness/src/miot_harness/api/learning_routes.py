"""HTTP API over before/after evaluations of knowledge changes
(`knowledge.evaluation`). The backend proxy decides who may call it
(trainers); the tenant comes from the verified header, else `tenant_id`."""

from __future__ import annotations

from collections.abc import Awaitable, Callable, Mapping
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Query, Request

from miot_harness.knowledge.evaluation import (
    EvaluationEngine,
    EvaluationNotFound,
    EvaluationRequest,
)
from miot_harness.knowledge.formats import safe_segment

Auth = Callable[..., Awaitable[Mapping[str, Any]]]


def install_learning_routes(
    app: FastAPI,
    *,
    require_auth: Auth,
    engine: Callable[[], EvaluationEngine],
    caller: Callable[[Request], dict[str, str | None]],
    check_model: Callable[[str | None], None],
) -> None:
    def _tenant(auth: Mapping[str, Any], tenant_id: str | None) -> str:
        tenant = safe_segment(str(auth.get("tenant_id") or tenant_id or ""))
        if tenant is None:
            raise HTTPException(status_code=400, detail="a tenant is required")
        return tenant

    @app.post(
        "/learning/evaluations",
        status_code=202,
        responses={400: {"description": "No tenant, or a model that is not offered"}},
    )
    async def start_evaluation(
        body: EvaluationRequest,
        http_request: Request,
        auth: Mapping[str, Any] = Depends(require_auth),
    ) -> dict[str, str]:
        tenant = _tenant(auth, body.tenant_id)
        check_model(body.model)
        claims = auth.get("claims") or {}
        evaluation_id = engine().start(
            tenant,
            body,
            started_by=str(auth.get("user_id") or claims.get("sub") or ""),
            **caller(http_request),
        )
        return {"evaluation_id": evaluation_id}

    @app.get("/learning/evaluations")
    async def list_evaluations(
        tenant_id: str | None = Query(None),
        limit: int = Query(50, ge=1, le=200),
        auth: Mapping[str, Any] = Depends(require_auth),
    ) -> dict[str, Any]:
        tenant = _tenant(auth, tenant_id)
        return {"evaluations": engine().recent(tenant, limit)}

    @app.get(
        "/learning/evaluations/{evaluation_id}",
        responses={404: {"description": "No such evaluation for this tenant"}},
    )
    async def get_evaluation(
        evaluation_id: str,
        tenant_id: str | None = Query(None),
        auth: Mapping[str, Any] = Depends(require_auth),
    ) -> dict[str, Any]:
        tenant = _tenant(auth, tenant_id)
        try:
            return engine().get(tenant, evaluation_id)
        except EvaluationNotFound as exc:
            raise HTTPException(status_code=404, detail="unknown evaluation") from exc
