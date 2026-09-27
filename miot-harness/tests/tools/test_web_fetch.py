"""`web_fetch`: public pages only, fetched from the address that was checked."""

from __future__ import annotations

import httpx
import pytest

from miot_harness.config import HarnessSettings
from miot_harness.tools.registry import build_default_registry
from miot_harness.tools.web_fetch import WebFetcher, WebFetchError, html_to_text

_PAGE = """<html><head><title>Fleet  news</title><style>p{color:red}</style>
<script>steal()</script></head><body><h1>Trips up</h1><p>Trips rose
 <b>12%</b> in May.</p><ul><li>one</li><li>two</li></ul></body></html>"""


def _resolver(table: dict[str, list[str]]):
    async def resolve(host: str, port: int) -> list[str]:
        return table.get(host, [])

    return resolve


def _fetcher(handler, table: dict[str, list[str]]) -> WebFetcher:
    return WebFetcher(resolve=_resolver(table), transport=httpx.MockTransport(handler))


@pytest.mark.asyncio
async def test_a_public_page_comes_back_as_text_from_the_checked_address() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, html=_PAGE)

    out = await _fetcher(handler, {"news.example": ["93.184.216.34"]}).fetch(
        "https://news.example/fleet"
    )
    assert out.title == "Fleet news"
    assert out.text == "Trips up\nTrips rose 12% in May.\none\ntwo"
    assert seen[0].url.host == "93.184.216.34"
    assert seen[0].headers["host"] == "news.example"
    assert seen[0].extensions["sni_hostname"] == "news.example"


@pytest.mark.parametrize(
    "addresses",
    [["10.0.0.5"], ["127.0.0.1"], ["169.254.169.254"], ["93.184.216.34", "192.168.1.1"], ["::1"]],
)
@pytest.mark.asyncio
async def test_a_host_with_any_non_public_address_is_refused(addresses: list[str]) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise AssertionError("must not connect")

    with pytest.raises(WebFetchError, match="non-public"):
        await _fetcher(handler, {"inside.example": addresses}).fetch("http://inside.example/")


@pytest.mark.asyncio
async def test_a_redirect_to_an_internal_host_is_refused() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(302, headers={"location": "http://metadata.internal/latest"})

    table = {"public.example": ["93.184.216.34"], "metadata.internal": ["169.254.169.254"]}
    with pytest.raises(WebFetchError, match="non-public"):
        await _fetcher(handler, table).fetch("http://public.example/")


@pytest.mark.parametrize(
    "url",
    [
        "ftp://files.example/x",
        "file:///etc/passwd",
        "http://user:pw@a.example/",
        "http://a.example:8080/",
    ],
)
@pytest.mark.asyncio
async def test_other_schemes_ports_and_credentials_are_refused(url: str) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise AssertionError("must not connect")

    with pytest.raises(WebFetchError):
        await _fetcher(handler, {"a.example": ["93.184.216.34"]}).fetch(url)


@pytest.mark.asyncio
async def test_binary_content_is_refused_and_long_text_is_cut() -> None:
    def image(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=b"\x89PNG", headers={"content-type": "image/png"})

    table = {"a.example": ["93.184.216.34"]}
    with pytest.raises(WebFetchError, match="not a text page"):
        await _fetcher(image, table).fetch("https://a.example/logo.png")

    def text(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text="x" * 5_000, headers={"content-type": "text/plain"})

    out = await _fetcher(text, table).fetch("https://a.example/big.txt", max_chars=1_000)
    assert len(out.text) == 1_000 and out.truncated


def test_html_to_text_drops_scripts_and_styles() -> None:
    title, text = html_to_text(_PAGE)
    assert "steal" not in text and "color" not in text
    assert title == "Fleet news"


def test_web_fetch_is_registered_only_when_enabled() -> None:
    assert "web_fetch" not in build_default_registry().names()
    assert "web_fetch" in build_default_registry(HarnessSettings(web_fetch_enabled=True)).names()
