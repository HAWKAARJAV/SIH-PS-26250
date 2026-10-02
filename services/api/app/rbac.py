"""Role permissions. Enforcement is server-side; the UI only mirrors this."""

from __future__ import annotations

ROLES = (
    "commander",
    "planner",
    "fleet",
    "crew_officer",
    "analyst",
    "auditor",
    "admin",
)

ROLE_PERMS: dict[str, set[str]] = {
    "commander": {"read", "guidance", "approve", "publish", "select_coa", "clock", "export"},
    "planner": {"read", "missions", "optimise", "plans", "submit", "events", "export"},
    "fleet": {"read", "fleet_write", "stores_write"},
    "crew_officer": {"read", "crew_write"},
    "analyst": {"read", "intel_write"},
    "auditor": {"read", "audit", "export"},
    "admin": {"read", "admin", "connectors", "clock"},
}

MASKED_ROLES = {"fleet", "crew_officer"}


def allows(role: str, perm: str) -> bool:
    return perm in ROLE_PERMS.get(role, set())
