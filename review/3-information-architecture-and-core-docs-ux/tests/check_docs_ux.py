#!/usr/bin/env python3

import argparse
import json
import re
import sys
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup, Tag


ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS_DIR = ROOT / "artifacts"
RESULTS_PATH = ARTIFACTS_DIR / "check-results.json"

DOCS_LANDING = "/docs"
DEEP_PAGE = "/docs/observability/get-started"
CONTRIBUTOR_PAGE = "/docs/api-and-data-platform/features/export-from-ui"

EXPECTED_MENU_SWITCHER = [
    ("Docs", "/docs"),
    ("Integrations", "/integrations"),
    ("Self Hosting", "/self-hosting"),
    ("Guides", "/guides"),
    ("AI Engineering Library", "/library"),
]

EXPECTED_SIDEBAR_SEQUENCE = [
    "Overview",
    "Example Project",
    "Ask AI",
    "Get Started",
    "Start Tracing",
    "Use Prompt Management",
    "Set up Evals",
    "Products",
    "Observability",
    "Prompt Management",
    "Evaluation",
    "Platform",
    "Metrics",
    "API & Data Platform",
    "Administration",
    "Security & Guardrails",
    "More",
    "Glossary",
    "Roadmap",
    "Faster Langfuse",
    "Docs MCP Server",
    "SDK & API References",
    "Security & Compliance ↗",
    "Support ↗",
]

EXPECTED_TOP_NAV = [
    "Product",
    "Resources",
    "Docs",
    "Changelog",
    "Pricing",
]

EXPECTED_BREADCRUMBS = ["Docs", "Start Tracing"]
EXPECTED_EDIT_LINK = (
    "https://github.com/langfuse/langfuse-docs/edit/main/"
    "content/docs/observability/get-started.mdx"
)
EXPECTED_CONTRIBUTOR = "tomaszantas Contributor"

INTERNAL_SECTIONS = {
    "header",
    "footer",
    "sidebar",
    "breadcrumbs",
    "toc",
}


@dataclass
class Check:
    name: str
    ok: bool
    details: str


@dataclass
class LinkCheck:
    page: str
    section: str
    text: str
    href: str
    status_code: int
    redirected: bool
    final_url: str
    ok: bool


def normalize_space(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def inner_text(node: Tag | None) -> str:
    if node is None:
        return ""
    return normalize_space(node.get_text(" ", strip=True))


def fetch_page(session: requests.Session, base_url: str, path: str) -> BeautifulSoup:
    response = session.get(urljoin(base_url, path), timeout=20)
    response.raise_for_status()
    return BeautifulSoup(response.text, "html.parser")


def extract_sidebar_texts(soup: BeautifulSoup) -> list[str]:
    aside = soup.select_one("aside#nd-sidebar")
    if aside is None:
        return []
    values: list[str] = []
    for node in aside.select("a,button,p"):
        text = inner_text(node)
        if text:
            values.append(text)
    return values


def extract_menu_switcher(soup: BeautifulSoup) -> list[tuple[str, str]]:
    aside = soup.select_one("aside#nd-sidebar")
    if aside is None:
        return []
    pairs: list[tuple[str, str]] = []
    for anchor in aside.select("a"):
        text = inner_text(anchor)
        href = anchor.get("href")
        if (text, href) in EXPECTED_MENU_SWITCHER:
            pairs.append((text, href))
    deduped: list[tuple[str, str]] = []
    seen = set()
    for pair in pairs:
        if pair not in seen:
            seen.add(pair)
            deduped.append(pair)
    return deduped


def is_subsequence(expected: Iterable[str], actual: list[str]) -> bool:
    expected_list = list(expected)
    cursor = 0
    actual_iter = iter(actual)
    for item in expected_list:
        for candidate in actual_iter:
            if candidate == item:
                cursor += 1
                break
        else:
            return False
    return cursor == len(expected_list)


def find_article(soup: BeautifulSoup) -> Tag | None:
    return soup.find("article")


def extract_breadcrumbs(soup: BeautifulSoup) -> list[str]:
    article = find_article(soup)
    if article is None:
        return []
    first_div = article.find("div", recursive=False)
    if first_div is None:
        return []
    values: list[str] = []
    for node in first_div.find_all(["a", "span", "div"], recursive=False):
        text = inner_text(node)
        if text:
            values.append(text)
    if not values:
        text = inner_text(first_div)
        if text:
            values = [part for part in text.split(" ") if part]
    return values


def slugify(text: str) -> str:
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s-]", "", text)
    text = re.sub(r"\s+", "-", text).strip("-")
    text = re.sub(r"-{2,}", "-", text)
    return text


def extract_toc_links(soup: BeautifulSoup) -> list[tuple[str, str]]:
    toc_heading = next(
        (tag for tag in soup.find_all(["h2", "h3"]) if inner_text(tag) == "On this page"),
        None,
    )
    if toc_heading is None:
        return []

    toc_container = toc_heading.parent
    if toc_container is None:
        return []

    anchors: list[tuple[str, str]] = []
    for anchor in toc_container.find_all("a"):
        text = inner_text(anchor)
        href = anchor.get("href", "")
        if text and href.startswith("#"):
            anchors.append((text, href))
    return anchors


def extract_heading_ids(soup: BeautifulSoup) -> set[str]:
    ids: set[str] = set()
    for heading in soup.find_all(re.compile(r"^h[1-6]$")):
        if heading.get("id"):
            ids.add(heading["id"])
        for anchor in heading.find_all("a"):
            href = anchor.get("href", "")
            if href.startswith("#"):
                ids.add(href[1:])
    return ids


def find_edit_link(soup: BeautifulSoup) -> str | None:
    anchor = next(
        (a for a in soup.find_all("a") if inner_text(a) == "Edit this page on GitHub"),
        None,
    )
    return anchor.get("href") if anchor else None


def find_contributor_block(soup: BeautifulSoup) -> tuple[bool, list[str]]:
    heading = next((tag for tag in soup.find_all() if inner_text(tag) == "Contributors"), None)
    if heading is None:
        return False, []

    container = heading.parent
    if container is None:
        return True, []

    contributors: list[str] = []
    for anchor in container.find_all("a"):
        text = inner_text(anchor)
        if text and text not in {"Edit this page on GitHub", "Question? Give us feedback →"}:
            contributors.append(text)
    return True, contributors


def classify_link(anchor: Tag) -> str | None:
    href = anchor.get("href", "")
    text = inner_text(anchor)
    parent = anchor.find_parent("aside", id="nd-sidebar")
    if parent is not None:
        return "sidebar"

    article = anchor.find_parent("article")
    if article is not None:
        first_div = article.find("div", recursive=False)
        if first_div is not None and anchor in first_div.find_all("a"):
            return "breadcrumbs"

    if href.startswith("#"):
        toc_heading = next(
            (tag for tag in anchor.find_parents() if tag.name in {"div", "section", "aside"}),
            None,
        )
        if toc_heading and "On this page" in toc_heading.get_text(" ", strip=True):
            return "toc"

    if anchor.find_parent("footer") is not None:
        return "footer"

    nav = anchor.find_parent("nav")
    if nav is not None:
        return "header"

    if text in {"Docs", "Changelog", "Pricing"}:
        return "header"

    return None


def should_check_href(href: str, base_url: str) -> bool:
    if not href:
        return False
    if href.startswith("#"):
        return False
    parsed = urlparse(urljoin(base_url, href))
    base = urlparse(base_url)
    return parsed.scheme in {"http", "https"} and parsed.netloc == base.netloc


def run_link_checks(
    session: requests.Session,
    base_url: str,
    page_path: str,
    soup: BeautifulSoup,
) -> list[LinkCheck]:
    checks: list[LinkCheck] = []
    seen: set[tuple[str, str, str]] = set()
    for anchor in soup.find_all("a"):
        section = classify_link(anchor)
        href = anchor.get("href", "")
        text = inner_text(anchor)
        if section not in INTERNAL_SECTIONS:
            continue
        if not should_check_href(href, base_url):
            continue
        key = (section, text, href)
        if key in seen:
            continue
        seen.add(key)
        response = session.get(urljoin(base_url, href), allow_redirects=False, timeout=20)
        redirected = response.is_redirect
        final_url = response.headers.get("Location", response.url)
        checks.append(
            LinkCheck(
                page=page_path,
                section=section,
                text=text,
                href=href,
                status_code=response.status_code,
                redirected=redirected,
                final_url=final_url,
                ok=response.status_code in {200, 301, 302, 307, 308},
            )
        )
    return checks


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:3333")
    args = parser.parse_args()

    session = requests.Session()
    session.headers.update({"User-Agent": "chapter-3-review-checker/1.0"})

    landing = fetch_page(session, args.base_url, DOCS_LANDING)
    print(f"Fetched {DOCS_LANDING}", flush=True)
    deep = fetch_page(session, args.base_url, DEEP_PAGE)
    print(f"Fetched {DEEP_PAGE}", flush=True)
    contributor = fetch_page(session, args.base_url, CONTRIBUTOR_PAGE)
    print(f"Fetched {CONTRIBUTOR_PAGE}", flush=True)

    checks: list[Check] = []

    header_text = landing.get_text(" ", strip=True)
    missing_top_nav = [item for item in EXPECTED_TOP_NAV if item not in header_text]
    checks.append(
        Check(
            name="top-nav-key-sections",
            ok=not missing_top_nav,
            details="missing: none" if not missing_top_nav else f"missing: {', '.join(missing_top_nav)}",
        )
    )

    menu_switcher = extract_menu_switcher(deep)
    checks.append(
        Check(
            name="sidebar-menu-switcher",
            ok=menu_switcher == EXPECTED_MENU_SWITCHER,
            details=f"found: {menu_switcher}",
        )
    )

    sidebar_texts = extract_sidebar_texts(deep)
    checks.append(
        Check(
            name="docs-sidebar-sequence",
            ok=is_subsequence(EXPECTED_SIDEBAR_SEQUENCE, sidebar_texts),
            details=f"sidebar sequence sample: {sidebar_texts[:30]}",
        )
    )

    breadcrumbs = extract_breadcrumbs(deep)
    checks.append(
        Check(
            name="breadcrumbs-present",
            ok=breadcrumbs[:2] == EXPECTED_BREADCRUMBS,
            details=f"found: {breadcrumbs[:4]}",
        )
    )

    toc_links = extract_toc_links(deep)
    heading_ids = extract_heading_ids(deep)
    missing_toc_targets = [
        f"{text} -> {href}"
        for text, href in toc_links
        if href[1:] not in heading_ids
    ]
    checks.append(
        Check(
            name="toc-anchor-targets",
            ok=bool(toc_links) and not missing_toc_targets,
            details=(
                f"toc entries: {len(toc_links)}"
                if not missing_toc_targets
                else f"missing targets: {missing_toc_targets}"
            ),
        )
    )

    edit_link = find_edit_link(deep)
    checks.append(
        Check(
            name="edit-link",
            ok=edit_link == EXPECTED_EDIT_LINK,
            details=f"found: {edit_link}",
        )
    )

    contributor_heading_present, contributors = find_contributor_block(contributor)
    checks.append(
        Check(
            name="contributors-block",
            ok=contributor_heading_present and EXPECTED_CONTRIBUTOR in contributors,
            details=f"contributors: {contributors}",
        )
    )

    banner_link = next(
        (
            a
            for a in deep.find_all("a")
            if inner_text(a) == "Langfuse joins ClickHouse! Learn more →"
        ),
        None,
    )
    checks.append(
        Check(
            name="announcement-banner-present",
            ok=banner_link is not None and banner_link.get("href") == "/blog/joining-clickhouse",
            details=f"href: {banner_link.get('href') if banner_link else None}",
        )
    )

    link_checks = (
        run_link_checks(session, args.base_url, DOCS_LANDING, landing)
        + run_link_checks(session, args.base_url, DEEP_PAGE, deep)
        + run_link_checks(session, args.base_url, CONTRIBUTOR_PAGE, contributor)
    )
    print(f"Checked {len(link_checks)} chrome links", flush=True)
    broken_links = [asdict(check) for check in link_checks if not check.ok]
    redirected_links = [asdict(check) for check in link_checks if check.redirected]
    checks.append(
        Check(
            name="internal-docs-chrome-links",
            ok=not broken_links,
            details=(
                f"{len(link_checks)} checked, {len(redirected_links)} redirected"
                if not broken_links
                else f"broken links: {broken_links}"
            ),
        )
    )

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    result = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "base_url": args.base_url,
        "pages": {
            "docs_landing": DOCS_LANDING,
            "deep_page": DEEP_PAGE,
            "contributor_page": CONTRIBUTOR_PAGE,
        },
        "checks": [asdict(check) for check in checks],
        "link_checks": [asdict(check) for check in link_checks],
        "summary": {
            "passed": sum(1 for check in checks if check.ok),
            "failed": sum(1 for check in checks if not check.ok),
            "broken_link_count": len(broken_links),
            "redirected_link_count": len(redirected_links),
        },
    }
    RESULTS_PATH.write_text(json.dumps(result, indent=2) + "\n")

    for check in checks:
        marker = "PASS" if check.ok else "FAIL"
        print(f"[{marker}] {check.name}: {check.details}")
    print(f"Results written to {RESULTS_PATH}")

    return 1 if any(not check.ok for check in checks) else 0


if __name__ == "__main__":
    sys.exit(main())
