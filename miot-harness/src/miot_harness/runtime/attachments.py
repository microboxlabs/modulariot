"""Files a user attaches to a chat message.

They reach the model as LangChain standard content blocks, which both
ChatAnthropic and ChatOpenAI translate to their own wire format (image and
document blocks; image_url and file parts). Conversation memory keeps only a
text marker per file, never the bytes.
"""

import base64
import binascii
from typing import Any

from pydantic import BaseModel, Field, field_validator, model_validator

MAX_ATTACHMENTS = 5
MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024
# Base64 of MAX_ATTACHMENT_BYTES, so an oversized body fails before decoding.
_MAX_BASE64_CHARS = (MAX_ATTACHMENT_BYTES + 2) // 3 * 4
IMAGE_TYPES = frozenset({"image/png", "image/jpeg", "image/webp", "image/gif"})
PDF_TYPE = "application/pdf"
# Read as text, like `text/*`.
JSON_TYPE = "application/json"


class Attachment(BaseModel):
    mime: str = Field(max_length=100)
    name: str = Field(default="attachment", max_length=255)
    data: str = Field(max_length=_MAX_BASE64_CHARS, repr=False)

    @field_validator("mime")
    @classmethod
    def _allowed_type(cls, value: str) -> str:
        mime = value.split(";", 1)[0].strip().lower()
        if mime in IMAGE_TYPES or mime in (PDF_TYPE, JSON_TYPE) or mime.startswith("text/"):
            return mime
        raise ValueError(f"unsupported attachment type {value!r}")

    @model_validator(mode="after")
    def _decodes_within_cap(self) -> "Attachment":
        try:
            raw = base64.b64decode(self.data, validate=True)
        except binascii.Error as exc:
            raise ValueError(f"attachment {self.name!r} is not valid base64") from exc
        if len(raw) > MAX_ATTACHMENT_BYTES:
            raise ValueError(f"attachment {self.name!r} is larger than 5 MB")
        return self

    @property
    def kind(self) -> str:
        if self.mime in IMAGE_TYPES:
            return "image"
        if self.mime == PDF_TYPE:
            return "pdf"
        return "file"


def attachment_marker(attachment: Attachment) -> str:
    return f"[{attachment.kind}: {attachment.name}]"


def with_markers(message: str, attachments: list[Attachment]) -> str:
    """The message as memory stores it: one marker line per attachment."""
    if not attachments:
        return message
    markers = "\n".join(attachment_marker(a) for a in attachments)
    return f"{markers}\n{message}" if message else markers


def content_block(attachment: Attachment) -> dict[str, Any]:
    if attachment.kind == "image":
        return {"type": "image", "base64": attachment.data, "mime_type": attachment.mime}
    if attachment.kind == "pdf":
        return {
            "type": "file",
            "base64": attachment.data,
            "mime_type": attachment.mime,
            "filename": attachment.name,
        }
    text = base64.b64decode(attachment.data).decode("utf-8", errors="replace")
    return {
        "type": "text",
        "text": f'<attachment name="{attachment.name}">\n{text}\n</attachment>',
    }
