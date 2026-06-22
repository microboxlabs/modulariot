"""Back-compat shim. The implementation moved to runtime/control.py when
the approve/deny registry was generalized into RunControlRegistry (Plan B).
`ApprovalRegistry` and `ApprovalDecision` remain importable so existing call
sites, the HarnessContext.approval_registry field, and the
/runs/{id}/approvals/{aid} endpoint keep working unchanged.
"""

from __future__ import annotations

from typing import Literal

from miot_harness.runtime.control import RunControlRegistry

ApprovalRegistry = RunControlRegistry
ApprovalDecision = Literal["approve", "deny"]

# New code should import RunControlRegistry from runtime.control directly;
# this shim only re-exports the legacy names for back-compat.
__all__ = ["ApprovalRegistry", "ApprovalDecision"]
