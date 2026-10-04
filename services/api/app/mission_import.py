"""Bulk mission import. JSON objects and CSV rows share one reject report."""

from __future__ import annotations

import csv
import io
import json
import re
from typing import Any, Literal

from optimiser.timeutil import parse_iso
from pydantic import BaseModel, ConfigDict

REQUIRED = ("id", "type", "priority", "value", "window_start", "window_end", "duration_min", "slots", "launch_base", "recover_base")
_INT_FIELDS = ("priority", "value", "duration_min")
_JSON_FIELDS = ("airspace_ids", "wx_minima", "dependencies", "route")
_TEXT_FIELDS = ("call_sign", "preferred_start", "status", "source", "freshness")

ImportRow = tuple[str, dict[str, Any] | None, str | None]


class MissionImport(BaseModel):
    model_config = ConfigDict(extra="ignore")

    missions: list[Any] | None = None
    format: Literal["json", "csv"] | None = None
    csv: str | None = None


def rejection_reason(mission: dict[str, Any]) -> str | None:
    missing = sorted(set(REQUIRED) - set(mission))
    if missing:
        return f"Missing {', '.join(missing)}"
    try:
        priority = int(mission["priority"])
    except (TypeError, ValueError):
        return "Priority must be 1–5."
    if priority < 1 or priority > 5:
        return "Priority must be 1–5."
    return None


def load_import_rows(body: MissionImport) -> tuple[list[ImportRow], str | None]:
    """Return (rows, fatal). A fatal message is a request error, not a row reject."""
    use_csv = body.format == "csv" or (body.format is None and body.csv is not None)
    if use_csv:
        if not body.csv:
            return [], "csv is required when importing CSV."
        return parse_csv(body.csv), None
    if body.missions is None:
        return [], "missions is required for JSON import."
    rows: list[ImportRow] = []
    for index, mission in enumerate(body.missions):
        if isinstance(mission, dict):
            rows.append((str(index), mission, None))
        else:
            rows.append((str(index), None, "Each mission must be an object."))
    return rows, None


def parse_csv(text: str) -> list[ImportRow]:
    raw = text.lstrip("\ufeff").strip()
    if not raw:
        return [("1", None, "CSV is empty.")]
    try:
        reader = csv.DictReader(io.StringIO(raw))
        fieldnames = reader.fieldnames
        parsed = list(reader)
    except csv.Error as exc:
        return [("1", None, f"CSV could not be read ({exc}).")]
    if not fieldnames:
        return [("1", None, "CSV header is missing.")]
    fields = {(name or "").strip() for name in fieldnames}
    missing_header = sorted((set(REQUIRED) - {"slots"}) - fields)
    if "slots" not in fields and "type_id" not in fields:
        missing_header.append("slots or type_id")
    if missing_header:
        return [("1", None, f"Header missing {', '.join(missing_header)}")]
    rows: list[ImportRow] = []
    for line_no, record in enumerate(parsed, start=2):
        if _blank(record):
            continue
        try:
            rows.append((str(line_no), mission_from_csv_row(record), None))
        except ValueError as exc:
            rows.append((str(line_no), None, str(exc)))
    return rows


def mission_from_csv_row(record: dict[str | None, str | None]) -> dict[str, Any]:
    cleaned = {(key or "").strip(): (value.strip() if isinstance(value, str) else "") for key, value in record.items()}
    mission: dict[str, Any] = {}
    missing = [key for key in REQUIRED if key != "slots" and not cleaned.get(key)]
    if missing:
        raise ValueError(f"Missing {', '.join(missing)}")
    for key in REQUIRED:
        if key != "slots":
            mission[key] = cleaned[key]
    for key in _INT_FIELDS:
        try:
            mission[key] = int(str(mission[key]))
        except (TypeError, ValueError) as exc:
            raise ValueError(f"{key} must be an integer.") from exc
    if mission["duration_min"] < 1:
        raise ValueError("duration_min must be at least 1.")
    mission["slots"] = _slots(cleaned)
    for key in _JSON_FIELDS:
        raw = cleaned.get(key) or ""
        if not raw:
            continue
        try:
            mission[key] = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ValueError(f"{key} is not valid JSON.") from exc
    if cleaned.get("needs_aar"):
        mission["needs_aar"] = cleaned["needs_aar"].lower() in {"1", "true", "yes", "y"}
    for key in _TEXT_FIELDS:
        if cleaned.get(key):
            mission[key] = cleaned[key]
    mission.setdefault("call_sign", str(mission["id"]))
    mission.setdefault("preferred_start", mission["window_start"])
    mission.setdefault("airspace_ids", [])
    mission.setdefault("wx_minima", {})
    mission.setdefault("needs_aar", False)
    mission.setdefault("dependencies", [])
    mission.setdefault("status", "REQUESTED")
    mission.setdefault("route", [])
    mission.setdefault("source", "CSV")
    mission.setdefault("freshness", "FRESH")
    for key in ("window_start", "window_end", "preferred_start"):
        try:
            parse_iso(str(mission[key]))
        except (TypeError, ValueError) as exc:
            raise ValueError(f"{key} is not a timestamp.") from exc
    return mission


def _slots(cleaned: dict[str, str]) -> list[Any]:
    raw = cleaned.get("slots") or ""
    if raw:
        try:
            slots = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ValueError("slots is not valid JSON.") from exc
        if not isinstance(slots, list):
            raise ValueError("slots must be a list.")
        return slots
    type_id = cleaned.get("type_id") or ""
    if not type_id:
        raise ValueError("Missing slots")
    quals_raw = cleaned.get("quals") or cleaned.get("slot_quals") or ""
    quals = [part.strip() for part in re.split(r"[|;]", quals_raw) if part.strip()]
    try:
        slot_index = int(cleaned["slot"]) if cleaned.get("slot") else 0
    except ValueError as exc:
        raise ValueError("slot must be an integer.") from exc
    return [
        {
            "slot": slot_index,
            "type_id": type_id,
            "load_out": cleaned.get("load_out") or cleaned.get("slot_load_out") or "",
            "quals": quals,
        }
    ]


def _blank(record: dict[str | None, str | None]) -> bool:
    return all(not (value or "").strip() for value in record.values())
