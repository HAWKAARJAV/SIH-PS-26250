"""UTC, IST and DTG helpers. All stored times are timezone-aware UTC."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
IST = ZoneInfo("Asia/Kolkata")


def parse_iso(value: str) -> datetime:
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def to_iso(dt: datetime) -> str:
    return dt.astimezone(UTC).replace(microsecond=0).isoformat()


def to_dtg(dt: datetime) -> str:
    z = dt.astimezone(UTC)
    return f"{z.day:02d}{z.hour:02d}{z.minute:02d}Z {MONTHS[z.month - 1]} {z.year % 100:02d}"


def to_ist(dt: datetime) -> datetime:
    return dt.astimezone(IST)


def add_minutes(dt: datetime, minutes: int) -> datetime:
    return dt + timedelta(minutes=minutes)


def minutes_between(epoch: datetime, moment: datetime) -> int:
    return int((moment - epoch).total_seconds() // 60)


def snap5(minutes: int) -> int:
    return (minutes // 5) * 5
