"""Authoritative fused snapshot — single source for planner, validator, retask, glance."""

from __future__ import annotations

from copy import deepcopy
from datetime import UTC, datetime
from typing import Any

from fusion import apply_feed_policy

FUSION_VERSION = 1


def fuse(world: dict[str, Any]) -> dict[str, Any]:
    if world.get("_fused_v") == FUSION_VERSION:
        return world
    raw = deepcopy(world)
    sources = {row["id"]: row for row in raw.get("sources", [])}
    lineage: list[dict[str, Any]] = []

    for craft in raw["aircraft"]:
        maint = sources.get(craft.get("source_id") or "MSS", {})
        reliability = float(maint.get("reliability_prior", 0.9))
        freshness = craft.get("freshness", "FRESH")
        decay = {"FRESH": 1.0, "AGING": 0.85, "STALE": 0.6, "CRITICAL": 0.4}.get(freshness, 0.7)
        craft["fusion_confidence"] = round(reliability * decay, 3)
        craft["provenance"] = f"FUSED · {freshness}"
        lineage.append({"entity": craft["tail"], "field": "effective_status", "method": "maintenance_authoritative"})

    for person in raw["crew"]:
        freshness = person.get("freshness", "FRESH")
        person["fusion_confidence"] = 0.95 if freshness == "FRESH" else 0.7
        person["provenance"] = f"FUSED · {freshness}"

    for row in raw["weather"]:
        row["provenance"] = f"FUSED · {row.get('freshness', 'FRESH')}"

    for row in raw["threats"]:
        row["provenance"] = f"FUSED · {row.get('freshness', 'FRESH')}"

    fused = apply_feed_policy(raw)
    live = sum(1 for row in fused.get("sources", []) if not row.get("degraded"))
    fused["fusion"] = {
        "version": FUSION_VERSION,
        "published_at": datetime.now(UTC).isoformat(),
        "feeds_live": live,
        "feeds_total": len(fused.get("sources", [])),
        "lineage_sample": lineage[:12],
    }
    fused["_fused_v"] = FUSION_VERSION
    return fused
