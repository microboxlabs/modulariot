from enum import StrEnum

from pydantic import BaseModel


class HarnessRoute(StrEnum):
    DIRECT = "direct"
    STORYTELLING_RUN = "storytelling_run"


class RouteResult(BaseModel):
    route: HarnessRoute
    reason: str


class IntentRouter:
    def route(self, message: str) -> RouteResult:
        normalized = message.lower()
        if "story" in normalized or "dashboard widget" in normalized:
            return RouteResult(
                route=HarnessRoute.STORYTELLING_RUN,
                reason="Request asks for a narrative artifact or dashboard draft.",
            )
        return RouteResult(route=HarnessRoute.DIRECT, reason="Simple direct response candidate.")

