from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field


class HarnessContext(BaseModel):
    run_id: str = Field(default_factory=lambda: f"run_{uuid4().hex}")
    thread_id: str
    tenant_id: str
    user_id: str
    route_context: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class UserRequest(BaseModel):
    message: str
    thread_id: str = "demo-thread"
    tenant_id: str = "demo-tenant"
    user_id: str = "demo-user"
    route_context: dict[str, Any] = Field(default_factory=dict)

    def to_context(self) -> HarnessContext:
        return HarnessContext(
            thread_id=self.thread_id,
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            route_context=self.route_context,
        )
