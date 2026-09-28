"""`propose_learned_fact`: a trainer teaches the agent a business fact in chat.

Offered only on a trainer's run. Every call pauses for the trainer's approval,
whatever the run's permission mode; on approval the fact is written as an
approved tenant-scoped card on the connection, and the next run reads it in
its "Learned facts" block.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, Field

from miot_harness.datasource.knowledge.learned import LearnedFacts, LearnedFactsSource
from miot_harness.datasource.knowledge.writer import (
    ConnectionCardWrite,
    _reject_if_secretish,
    slug_card_id,
    write_connection_card,
)
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.permissions import PermissionResult
from miot_harness.runtime.tool import HarnessTool, Progress

PROPOSE_LEARNED_FACT_TOOL = "propose_learned_fact"

FactKind = Literal["term", "stage", "metric", "entity", "recipe", "gotcha"]


class ProposeLearnedFactInput(BaseModel):
    connection: str = Field(
        min_length=1, max_length=80, description="Connection the fact is about."
    )
    term: str = Field(
        min_length=1,
        max_length=80,
        description="Short key for the fact. Proposing the same term again replaces that fact.",
    )
    title: str = Field(min_length=1, max_length=120, description="One-line summary.")
    kind: FactKind
    body: str = Field(
        min_length=1,
        max_length=2000,
        description="The fact in short markdown, phrased to apply to future questions.",
    )


class ProposeLearnedFactOutput(BaseModel):
    connection: str
    card_id: str
    title: str
    status: Literal["saved", "updated"]
    message: str


def _usable(learned: LearnedFacts | None, ctx: HarnessContext) -> dict[str, LearnedFactsSource]:
    """The connections this tenant may add facts to, by name."""
    return {s.connection: s for s in learned.usable(ctx.tenant_id)} if learned else {}


def _text(value: ProposeLearnedFactInput) -> str:
    return "\n".join((value.term, value.title, value.body))


def propose_learned_fact_tool(
    learned: Callable[[], LearnedFacts | None],
) -> HarnessTool[ProposeLearnedFactInput, ProposeLearnedFactOutput]:
    """`learned` gives the connections with a knowledge folder, read per call."""

    async def check(ctx: HarnessContext, value: ProposeLearnedFactInput) -> PermissionResult:
        if not ctx.trainer:
            return PermissionResult.deny("only a trainer can teach facts")
        usable = _usable(learned(), ctx)
        if value.connection not in usable:
            return PermissionResult.deny(
                f"connection {value.connection!r} does not take learned facts; "
                f"use one of: {', '.join(sorted(usable)) or 'none'}"
            )
        if not slug_card_id(value.term):
            return PermissionResult.deny("term needs at least one letter or digit")
        try:
            _reject_if_secretish(_text(value))
        except ValueError as exc:
            return PermissionResult.deny(str(exc))
        return PermissionResult.ask(f"Save a learned fact for {value.connection}: {value.title}")

    async def call(
        ctx: HarnessContext, value: ProposeLearnedFactInput, _: Progress
    ) -> ProposeLearnedFactOutput:
        source = _usable(learned(), ctx).get(value.connection)
        if source is None:
            raise PermissionError(f"connection {value.connection!r} does not take learned facts")
        card_id = slug_card_id(value.term)
        existed = (source.cards_dir / f"{card_id}.md").is_file()
        write_connection_card(
            source.cards_dir,
            ConnectionCardWrite(
                term=value.term,
                title=value.title,
                kind=value.kind,
                body=value.body,
                scope="tenant",
                status="approved",
                approved_by=ctx.user_id,
                provenance={
                    "source": "chat",
                    "run_id": ctx.run_id,
                    "conversation_id": ctx.conversation_id or ctx.thread_id,
                    "user": ctx.user_id,
                },
                last_confirmed=datetime.now(UTC).date().isoformat(),
            ),
        )
        return ProposeLearnedFactOutput(
            connection=value.connection,
            card_id=card_id,
            title=value.title,
            status="updated" if existed else "saved",
            message="The trainer approved the fact. It applies from the next question on.",
        )

    def available() -> bool:
        facts = learned()
        return bool(facts and facts.sources)

    return HarnessTool(
        name=PROPOSE_LEARNED_FACT_TOOL,
        description=(
            "Propose a business fact the trainer taught you, to keep for future "
            "questions on a connection. One fact per call. The trainer approves "
            "or declines it before it is saved."
        ),
        input_model=ProposeLearnedFactInput,
        output_model=ProposeLearnedFactOutput,
        read_only=False,
        destructive=True,
        always_ask=True,
        declined_message=(
            "The trainer declined this fact. Ask what to change before proposing it again."
        ),
        kind="trainer",
        check_permission=check,
        call=call,
        available=available,
    )
