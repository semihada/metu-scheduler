"""Fetch current METU SIS offerings into the JSON format consumed by the UI.

The SIS pages require a browser-like TLS client and a continuous session. This
script deliberately uses one curl_cffi Session for the initial page, dynamic
Semester Information route, and every AJAX program request.
"""

from __future__ import annotations

import argparse
import json
import os
import random
import re
import sys
import tempfile
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urljoin
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from bs4 import BeautifulSoup
from curl_cffi import requests

SIS_URL = "https://sis.metu.edu.tr"
ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "public" / "data"
CHANGELOG_PATH = ROOT / "CHANGELOG.md"
CHANGELOG_HEADER = (
    "# Course Offerings Changelog\n\n"
    "Every automated scrape that changes course data adds an entry here.\n\n"
)
DAY_INDEX = {
    "Monday": 0,
    "Tuesday": 1,
    "Wednesday": 2,
    "Thursday": 3,
    "Friday": 4,
    "Saturday": 5,
    "Sunday": 6,
}
ENGINEERING_PROGRAMS = frozenset({"AEE", "CE", "CENG", "EE", "IE", "ME", "ROB"})


def clean(value: str | None) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def istanbul_now() -> datetime:
    """Current local time in Istanbul (Europe/Istanbul; UTC+3 year-round since 2016)."""
    try:
        return datetime.now(ZoneInfo("Europe/Istanbul"))
    except ZoneInfoNotFoundError:
        # No IANA database available (bare Windows without the tzdata package).
        return datetime.now(timezone.utc).astimezone(timezone(timedelta(hours=3)))


class SISClient:
    """Small, polite SIS client with Chrome impersonation and retry backoff."""

    def __init__(self) -> None:
        self.session = requests.Session(impersonate="chrome")
        self.session.headers.update({"Accept-Language": "en-US,en;q=0.9"})
        # METU SIS may present a certificate chain that some local Windows
        # trust stores cannot validate. Allow opting back in with
        # METU_SIS_VERIFY_TLS=true when the chain validates locally.
        self.verify_tls = os.getenv("METU_SIS_VERIFY_TLS", "false").lower() in {"1", "true", "yes"}

    def request(self, method: str, url: str, **kwargs: Any) -> requests.Response:
        last_error: Exception | None = None
        for attempt in range(1, 5):
            time.sleep(random.uniform(0.6, 1.4))
            try:
                response = self.session.request(method, url, timeout=30, verify=self.verify_tls, **kwargs)
                if response.status_code in (429, 503):
                    time.sleep(min(30, 2**attempt * 2))
                    continue
                response.raise_for_status()
                return response
            except requests.errors.RequestsError as error:
                last_error = error
                if attempt < 4:
                    time.sleep(2**attempt)
        raise RuntimeError(f"METU SIS request failed after retries: {url}") from last_error

    def get(self, url: str) -> requests.Response:
        return self.request("GET", url)

    def post(self, url: str, **kwargs: Any) -> requests.Response:
        return self.request("POST", url, **kwargs)


def semester_page(client: SISClient) -> BeautifulSoup:
    home = BeautifulSoup(client.get(f"{SIS_URL}/").text, "html.parser")
    link = next(
        (
            anchor.get("href")
            for anchor in home.find_all("a", href=True)
            if "semester information" in clean(anchor.get_text()).lower()
        ),
        None,
    )
    if not link:
        raise RuntimeError("Could not find the Semester Information route in METU SIS")
    return BeautifulSoup(client.get(urljoin(f"{SIS_URL}/", link)).text, "html.parser")


def parse_semester(soup: BeautifulSoup) -> dict[str, str]:
    semesters = [
        {"code": option["value"], "name": clean(option.get_text())}
        for option in soup.select("select[name=selectSemester] option[value]")
        if option["value"].isdigit()
    ]
    if not semesters:
        raise RuntimeError("METU SIS did not provide a semester list")
    return max(semesters, key=lambda item: int(item["code"]))


def parse_programs(soup: BeautifulSoup) -> list[dict[str, str]]:
    programs = []
    for option in soup.select("select[name=selectProgram] option[value]"):
        parts = clean(option.get_text()).split("-", 2)
        if len(parts) != 3:
            continue
        programs.append({"code": option["value"], "short_name": parts[1].strip(), "name": parts[2].strip()})
    if not programs:
        raise RuntimeError("METU SIS did not provide a program list")
    return programs


def program_table(client: SISClient, semester: str, program: str, stamp: str) -> str:
    response = client.post(
        f"{SIS_URL}/main.php",
        data={
            "selectCourseCriteriaType": "",
            "selectSemester": semester,
            "selectProgram": program,
            "submitSearchForm": "Search",
            "stamp": stamp,
        },
        headers={
            "X-Requested-With": "XMLHttpRequest",
            "Accept": "application/json, text/javascript, */*; q=0.01",
        },
    )
    payload = response.json()
    if payload.get("error"):
        raise RuntimeError(f"METU SIS rejected program {program}: {payload['error']}")
    return payload.get("data", "")


def slot_index(day: str, start: str, end: str) -> range:
    if day not in DAY_INDEX:
        return range(0)
    try:
        start_hour, start_minute = map(int, start.split(":"))
        end_hour, end_minute = map(int, end.split(":"))
    except ValueError:
        return range(0)
    start_minutes, end_minutes = start_hour * 60 + start_minute, end_hour * 60 + end_minute
    if end_minutes <= start_minutes:
        return range(0)
    first = max(0, (start_minutes - 510) // 60)
    last = min(13, -(-(end_minutes - 510) // 60) - 1)
    return range(first * 7 + DAY_INDEX[day], (last + 1) * 7 + DAY_INDEX[day], 7)


def course_label(program: str, raw_code: str) -> str:
    digits = re.sub(r"\D", "", raw_code)
    number = str(int(digits[-4:])) if digits else raw_code
    return f"{program} {number}"


def parse_courses(html: str, program: str) -> dict[str, Any]:
    soup = BeautifulSoup(html, "html.parser")
    headers = [clean(header.get_text()) for header in soup.select("#SearchResults thead th")]
    courses: dict[str, Any] = {}
    for row in soup.select("#SearchResults tbody tr"):
        cells = [clean(cell.get_text()) for cell in row.find_all("td")]
        values = dict(zip(headers, cells))
        raw_code, section = values.get("Course Code", ""), values.get("Course Section", "")
        if not raw_code or not section:
            continue
        code = course_label(program, raw_code)
        try:
            section_key = str(int(float(section.replace(",", "."))))
        except ValueError:
            continue
        course_name = clean(values.get("Course Name") or values.get("Course Title") or code)
        course = courses.setdefault(code, {"name": course_name, "sections": {}})
        item = course["sections"].setdefault(
            section_key,
            {"instructor": values.get("Instructor Name") or "STAFF", "schedule": {}},
        )
        instructor = values.get("Instructor Name")
        if instructor and instructor not in item["instructor"].split(" / "):
            item["instructor"] = f"{item['instructor']} / {instructor}"
        for index in range(1, 6):
            room = values.get(f"Classroom {index}") or values.get(f"Classroom Building {index}") or "TBA"
            for slot in slot_index(values.get(f"Day{index}", ""), values.get(f"Start Hour{index}", ""), values.get(f"End Hour{index}", "")):
                item["schedule"][str(slot)] = room
    return courses


def natural_key(value: str) -> tuple:
    """Sort key that orders digit runs numerically: "1" < "2" < "10"."""
    return tuple(int(part) if part.isdigit() else part for part in re.split(r"(\d+)", value))


def ordered(value: Any) -> Any:
    """Recursively rebuild dicts with naturally sorted keys for stable, readable diffs."""
    if isinstance(value, dict):
        return {key: ordered(value[key]) for key in sorted(value, key=natural_key)}
    if isinstance(value, list):
        return [ordered(item) for item in value]
    return value


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as temp:
        json.dump(ordered(value), temp, ensure_ascii=False, indent=2)
        temp.write("\n")
        temp_path = Path(temp.name)
    temp_path.replace(path)


def read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    with path.open(encoding="utf-8") as source:
        return json.load(source)


def summarize_changes(previous: dict[str, Any], current: dict[str, Any]) -> tuple[list[str], dict[str, int], list[str]]:
    """Compare two offerings snapshots.

    Returns (per-department markdown blocks, totals, changed department codes).
    """
    blocks: list[str] = []
    totals = {"added": 0, "removed": 0, "changed": 0}
    departments: list[str] = []
    for code in sorted(set(previous) | set(current), key=natural_key):
        old_courses, new_courses = previous.get(code, {}), current.get(code, {})
        added = sorted(set(new_courses) - set(old_courses), key=natural_key)
        removed = sorted(set(old_courses) - set(new_courses), key=natural_key)
        changed = sorted(
            (course for course in set(old_courses) & set(new_courses) if old_courses[course] != new_courses[course]),
            key=natural_key,
        )
        if not (added or removed or changed):
            continue
        totals["added"] += len(added)
        totals["removed"] += len(removed)
        totals["changed"] += len(changed)
        departments.append(code)
        lines = [f"### {code}"]
        if added:
            lines.append(f"- Added ({len(added)}): {', '.join(added)}")
        if removed:
            lines.append(f"- Removed ({len(removed)}): {', '.join(removed)}")
        if changed:
            lines.append(f"- Changed ({len(changed)}): {', '.join(changed)}")
        blocks.append("\n".join(lines))
    return blocks, totals, departments


def changelog_entry(previous: dict[str, Any], current: dict[str, Any], semester: dict[str, str]) -> str:
    blocks, totals, departments = summarize_changes(previous, current)
    stamp = istanbul_now().strftime("%Y-%m-%d %H:%M %z")
    if not previous:
        return "\n".join(
            [
                f"## {stamp} - {semester['name']} ({semester['code']})",
                "",
                f"Initial snapshot: {len(current)} departments, "
                f"{sum(len(courses) for courses in current.values())} courses.",
            ]
        )
    return "\n".join(
        [
            f"## {stamp} - {semester['name']} ({semester['code']})",
            "",
            f"{len(departments)} departments: +{totals['added']} added, -{totals['removed']} removed, "
            f"{totals['changed']} changed",
            "",
            *blocks,
        ]
    )


def commit_summary(previous: dict[str, Any], current: dict[str, Any], semester: dict[str, str]) -> str:
    """Build the bot's commit message: summary title on the first line, details as the body."""
    blocks, totals, departments = summarize_changes(previous, current)
    if not previous:
        return "\n".join(
            [
                f"Auto-update course offerings (new semester: {semester['name']})",
                "",
                f"Initial snapshot: {len(current)} departments, "
                f"{sum(len(courses) for courses in current.values())} courses.",
            ]
        ) + "\n"
    names = ", ".join(departments[:3])
    if len(departments) > 3:
        names += f" and {len(departments) - 3} more"
    return "\n".join(
        [
            f"Auto-update course offerings ({names})",
            "",
            f"{len(departments)} departments: +{totals['added']} added, -{totals['removed']} removed, "
            f"{totals['changed']} changed",
            "",
            *blocks,
        ]
    ) + "\n"


def update_changelog(entry: str) -> None:
    """Insert a new entry just below the changelog header, newest first."""
    if CHANGELOG_PATH.exists():
        content = CHANGELOG_PATH.read_text(encoding="utf-8")
        if content.startswith(CHANGELOG_HEADER):
            content = CHANGELOG_HEADER + entry + "\n\n" + content[len(CHANGELOG_HEADER) :]
        else:
            # Header was edited by hand: fall back to inserting below the title line.
            title_end = content.find("\n")
            rest = content[title_end + 1 :].lstrip("\n") if title_end != -1 else content
            content = f"{content[: title_end + 1]}\n{entry}\n\n{rest}"
    else:
        content = f"{CHANGELOG_HEADER}{entry}\n"
    CHANGELOG_PATH.write_text(content, encoding="utf-8")


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Refresh METU SIS course offerings.")
    refresh = parser.add_mutually_exclusive_group(required=True)
    refresh.add_argument("--all", action="store_true", help="refresh every SIS program")
    refresh.add_argument(
        "--engineering",
        action="store_true",
        help="refresh AEE, CE, CENG, EE, IE, ME, and ROB only",
    )
    parser.add_argument(
        "--summary-file",
        type=Path,
        help="write a commit-ready summary (title line + details) to this file",
    )
    return parser.parse_args()


def main() -> None:
    args = arguments()
    client = SISClient()
    soup = semester_page(client)
    stamp = soup.select_one("input[name=stamp]")
    if not stamp or not stamp.get("value"):
        raise RuntimeError("METU SIS security stamp was not found")
    semester, all_programs = parse_semester(soup), parse_programs(soup)
    programs = all_programs if args.all else [p for p in all_programs if p["short_name"] in ENGINEERING_PROGRAMS]
    missing = ENGINEERING_PROGRAMS - {program["short_name"] for program in programs}
    if missing:
        print(f"Warning: SIS did not list {', '.join(sorted(missing))}.", file=sys.stderr)
    if not programs:
        raise RuntimeError("No requested METU SIS programs were found")

    offering_path = DATA_DIR / "offerings" / f"{semester['code']}.json"
    previous = read_json(offering_path, {})
    offerings: dict[str, Any] = {} if args.all else read_json(offering_path, {})
    departments = {} if args.all else {
        department["code"]: department
        for department in read_json(DATA_DIR / "departments.json", [])
        if "code" in department
    }
    for code in {program["short_name"] for program in programs}:
        offerings.pop(code, None)
    for position, program in enumerate(programs, start=1):
        print(f"[{position}/{len(programs)}] {program['short_name']}", flush=True)
        parsed = parse_courses(program_table(client, semester["code"], program["code"], stamp["value"]), program["short_name"])
        offerings.setdefault(program["short_name"], {}).update(parsed)
        departments[program["short_name"]] = {"code": program["short_name"], "name": program["name"]}
    if not any(offerings.values()):
        raise RuntimeError("METU SIS returned no courses; refusing to replace existing data")
    year_start = int(semester["code"][:4])
    write_json(
        DATA_DIR / "departments.json",
        sorted(departments.values(), key=lambda item: natural_key(item["code"])),
    )
    write_json(DATA_DIR / "semesters.json", [{**semester, "year": f"{year_start}-{year_start + 1}"}])
    write_json(offering_path, offerings)
    print(f"Wrote {sum(len(courses) for courses in offerings.values())} courses for {semester['name']}.")

    blocks, _, _ = summarize_changes(previous, offerings)
    if blocks:
        entry = changelog_entry(previous, offerings, semester)
        update_changelog(entry)
        if args.summary_file:
            args.summary_file.write_text(commit_summary(previous, offerings, semester), encoding="utf-8")
        print(entry)
    else:
        print("No offering changes detected.")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Scrape failed: {error}", file=sys.stderr)
        raise SystemExit(1)
