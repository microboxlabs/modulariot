"""`web_fetch`: public pages only, fetched from the address that was checked."""

from __future__ import annotations

import httpx
import pytest

from miot_harness.config import HarnessSettings
from miot_harness.runtime.context import HarnessContext
from miot_harness.tools.registry import build_default_registry
from miot_harness.tools.web_fetch import WebFetcher, WebFetchError, html_to_text, web_fetch_tool

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


@pytest.mark.asyncio
async def test_a_proxy_in_the_environment_is_ignored(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("HTTP_PROXY", "http://proxy.invalid:3128")
    monkeypatch.setenv("HTTPS_PROXY", "http://proxy.invalid:3128")
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, text="ok", headers={"content-type": "text/plain"})

    out = await _fetcher(handler, {"a.example": ["93.184.216.34"]}).fetch("https://a.example/")
    assert out.text == "ok"
    assert seen[0].url.host == "93.184.216.34"


@pytest.mark.asyncio
async def test_each_redirect_hop_gets_its_own_client() -> None:
    clients: set[int] = set()

    def handler(request: httpx.Request) -> httpx.Response:
        if request.headers["host"] == "one.example":
            return httpx.Response(302, headers={"location": "https://two.example/"})
        return httpx.Response(200, text="two", headers={"content-type": "text/plain"})

    fetcher = _fetcher(
        handler, {"one.example": ["93.184.216.34"], "two.example": ["93.184.216.34"]}
    )
    original = httpx.AsyncClient.send

    async def send(self: httpx.AsyncClient, request: httpx.Request, **kwargs: object):
        clients.add(id(self))
        return await original(self, request, **kwargs)  # type: ignore[arg-type]

    with pytest.MonkeyPatch.context() as patch:
        patch.setattr(httpx.AsyncClient, "send", send)
        out = await fetcher.fetch("https://one.example/")
    assert out.text == "two"
    assert len(clients) == 2


def test_html_to_text_drops_scripts_and_styles() -> None:
    title, text = html_to_text(_PAGE)
    assert "steal" not in text and "color" not in text
    assert title == "Fleet news"


def test_web_fetch_is_registered_by_default_and_can_be_turned_off() -> None:
    assert "web_fetch" in build_default_registry().names()
    assert (
        "web_fetch" not in build_default_registry(HarnessSettings(web_fetch_enabled=False)).names()
    )


@pytest.mark.parametrize("address", ["64:ff9b::7f00:1", "64:ff9b::a9fe:a9fe", "::ffff:10.0.0.1"])
@pytest.mark.asyncio
async def test_ipv6_forms_of_internal_ipv4_addresses_are_refused(address: str) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise AssertionError("must not connect")

    with pytest.raises(WebFetchError, match="non-public"):
        await _fetcher(handler, {"six.example": [address]}).fetch("http://six.example/")


@pytest.mark.asyncio
async def test_a_body_past_the_byte_cap_is_cut() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text="y" * 3_000_000, headers={"content-type": "text/plain"})

    out = await _fetcher(handler, {"a.example": ["93.184.216.34"]}).fetch(
        "https://a.example/huge", max_chars=50_000
    )
    assert out.truncated and len(out.text) == 50_000


@pytest.mark.asyncio
async def test_a_run_may_fetch_only_so_many_pages() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text="ok", headers={"content-type": "text/plain"})

    tool = web_fetch_tool(_fetcher(handler, {"a.example": ["93.184.216.34"]}), max_per_run=2)
    ctx = HarnessContext(thread_id="t", tenant_id="acme", user_id="u1", run_id="r1")
    for _ in range(2):
        await tool.invoke(ctx, {"url": "https://a.example/"}, lambda _: None)
    with pytest.raises(WebFetchError, match="fetch limit"):
        await tool.invoke(ctx, {"url": "https://a.example/"}, lambda _: None)
    other = HarnessContext(thread_id="t", tenant_id="acme", user_id="u1", run_id="r2")
    out = await tool.invoke(other, {"url": "https://a.example/"}, lambda _: None)
    assert out.text == "ok"
