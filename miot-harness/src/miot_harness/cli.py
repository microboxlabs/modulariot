import argparse
import asyncio
import json
from pathlib import Path

from miot_harness.config import get_settings
from miot_harness.runtime.context import UserRequest
from miot_harness.runtime.factory import build_harness


async def _demo(message: str) -> int:
    settings = get_settings()
    harness = build_harness(Path(settings.workspace_dir))
    record = await harness.run(
        UserRequest(
            message=message,
            tenant_id=settings.default_tenant_id,
            user_id=settings.default_user_id,
        )
    )
    print(json.dumps(record.model_dump(mode="json"), indent=2))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(prog="miot-harness")
    subparsers = parser.add_subparsers(dest="command", required=True)

    demo = subparsers.add_parser("demo", help="Run the mock delivery-compliance story flow.")
    demo.add_argument("message", help="User message for ASK MIOT.")

    args = parser.parse_args()
    if args.command == "demo":
        return asyncio.run(_demo(args.message))
    raise ValueError(f"Unsupported command: {args.command}")


if __name__ == "__main__":
    raise SystemExit(main())
