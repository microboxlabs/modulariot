"""HTTP API over the editable knowledge layers (`knowledge.store`).

The tenant comes from the verified header, else the `tenant_id` query. The
backend proxy decides who may call these (trainers); here a tenant only
reaches connections it owns or shares, like the card endpoints.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable, Mapping
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Query, Response
from pydantic import BaseModel, Field

from miot_harness.knowledge.changes import MAX_CHANGE_CHARS
from miot_harness.knowledge.store import KnowledgeError, KnowledgeStore

Auth = Callable[..., Awaitable[Mapping[str, Any]]]


class KnowledgeItemWrite(BaseModel):
    title: str = Field(default="", max_length=500)
    content: str = Field(max_length=MAX_CHANGE_CHARS)
    reason: str = Field(default="", max_length=2000)
    author: str = Field(default="", max_length=200)
    provenance: dict[str, Any] = Field(default_factory=dict)
    # Extra fields an eval case keeps (checks, expected skills).
    meta: dict[str, Any] = Field(default_factory=dict)
    expect_skill: str | list[str] | None = None
    expect_no_skill: str | list[str] | None = None


class KnowledgeRevert(BaseModel):
    version: int = Field(ge=1)
    author: str = Field(default="", max_length=200)
    reason: str = Field(default="", max_length=2000)


_ERRORS: dict[int | str, dict[str, Any]] = {
    400: {"description": "Invalid id, path, target or content"},
    403: {"description": "The connection belongs to another tenant"},
    404: {"description": "No such layer, item, version or connection"},
    405: {"description": "The layer is read-only for this operation"},
}


def install_knowledge_routes(
    app: FastAPI,
    *,
    require_auth: Auth,
    store_for: Callable[[str], KnowledgeStore],
) -> None:
    def _store(auth: Mapping[str, Any], tenant_id: str | None) -> KnowledgeStore:
        tenant = auth.get("tenant_id") or tenant_id
        if not tenant:
            raise HTTPException(status_code=400, detail="a tenant is required")
        try:
            return store_for(str(tenant))
        except KnowledgeError as exc:
            raise HTTPException(status_code=exc.status, detail=exc.detail) from exc

    def _call(fn: Callable[[], Any]) -> Any:
        try:
            return fn()
        except KnowledgeError as exc:
            raise HTTPException(status_code=exc.status, detail=exc.detail) from exc

    @app.get("/knowledge/layers", responses=_ERRORS)
    async def knowledge_layers(
        tenant_id: str | None = Query(None),
        auth: Mapping[str, Any] = Depends(require_auth),
    ) -> dict[str, Any]:
        store = _store(auth, tenant_id)
        return {"layers": _call(store.layers)}

    @app.get("/knowledge/items/{layer}/{item_id}", responses=_ERRORS)
    async def knowledge_item(
        layer: str,
        item_id: str,
        target: str | None = Query(None),
        tenant_id: str | None = Query(None),
        auth: Mapping[str, Any] = Depends(require_auth),
    ) -> dict[str, Any]:
        store = _store(auth, tenant_id)
        return dict(_call(lambda: store.read(layer, item_id, target)))

    @app.get("/knowledge/items/{layer}/{item_id}/versions/{version}", responses=_ERRORS)
    async def knowledge_item_version(
        layer: str,
        item_id: str,
        version: int,
        target: str | None = Query(None),
        tenant_id: str | None = Query(None),
        auth: Mapping[str, Any] = Depends(require_auth),
    ) -> dict[str, Any]:
        store = _store(auth, tenant_id)
        return dict(_call(lambda: store.read_version(layer, item_id, version, target)))

    @app.put("/knowledge/items/{layer}/{item_id}", responses=_ERRORS)
    async def put_knowledge_item(
        layer: str,
        item_id: str,
        body: KnowledgeItemWrite,
        target: str | None = Query(None),
        tenant_id: str | None = Query(None),
        auth: Mapping[str, Any] = Depends(require_auth),
    ) -> dict[str, Any]:
        store = _store(auth, tenant_id)
        meta = dict(body.meta)
        for key in ("expect_skill", "expect_no_skill"):
            if getattr(body, key) is not None:
                meta[key] = getattr(body, key)
        return dict(
            _call(
                lambda: store.put(
                    layer,
                    item_id,
                    target=target,
                    title=body.title,
                    content=body.content,
                    reason=body.reason,
                    author=body.author or _user(auth),
                    provenance=body.provenance,
                    meta=meta,
                )
            )
        )

    @app.delete("/knowledge/items/{layer}/{item_id}", status_code=204, responses=_ERRORS)
    async def delete_knowledge_item(
        layer: str,
        item_id: str,
        target: str | None = Query(None),
        tenant_id: str | None = Query(None),
        reason: str = Query("", max_length=2000),
        author: str = Query("", max_length=200),
        auth: Mapping[str, Any] = Depends(require_auth),
    ) -> Response:
        store = _store(auth, tenant_id)
        _call(
            lambda: store.delete(
                layer, item_id, target=target, reason=reason, author=author or _user(auth)
            )
        )
        return Response(status_code=204)

    @app.post("/knowledge/items/{layer}/{item_id}/revert", responses=_ERRORS)
    async def revert_knowledge_item(
        layer: str,
        item_id: str,
        body: KnowledgeRevert,
        target: str | None = Query(None),
        tenant_id: str | None = Query(None),
        auth: Mapping[str, Any] = Depends(require_auth),
    ) -> dict[str, Any]:
        store = _store(auth, tenant_id)
        return dict(
            _call(
                lambda: store.revert(
                    layer,
                    item_id,
                    body.version,
                    target=target,
                    reason=body.reason,
                    author=body.author or _user(auth),
                )
            )
        )


def _user(auth: Mapping[str, Any]) -> str:
    claims = auth.get("claims") or {}
    return str(auth.get("user_id") or claims.get("sub") or "")
