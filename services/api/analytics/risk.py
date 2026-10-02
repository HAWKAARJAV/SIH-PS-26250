"""Transparent mission risk. A weighted score, not a trained probability."""

from __future__ import annotations

from typing import Any


def mission_risk(snapshot: dict[str, Any], mission: dict[str, Any]) -> dict[str, Any]:
    threats = snapshot.get("threats") or []
    exposure = 0.0
    for zone in threats:
        exposure = max(exposure, float(zone.get("existence_p") or 0))
    weather = _weather_penalty(snapshot, mission)
    tails = [row for row in snapshot["aircraft"] if row["base_id"] == mission["launch_base"]]
    reliability = 1.0
    if tails:
        reliability = sum(float(row["p_mc"]["6h"]) for row in tails) / len(tails)
    crew = [row for row in snapshot["crew"] if row["base_id"] == mission["launch_base"] and row["status"] == "AVAILABLE"]
    fatigue = 0.0
    if crew:
        fatigue = sum(float(row["fatigue_index"]) for row in crew) / len(crew)
    support = 15.0 if mission.get("needs_aar") else 0.0
    score = round(
        min(100.0, exposure * 40 + weather * 25 + (1 - reliability) * 20 + fatigue * 15 + support),
        1,
    )
    return {
        "mission_id": mission["id"],
        "score": score,
        "drivers": {
            "threat_exposure": round(exposure, 3),
            "weather_penalty": round(weather, 3),
            "fleet_reliability_6h": round(reliability, 3),
            "crew_fatigue": round(fatigue, 3),
            "support_dependency": support > 0,
        },
        "model": "transparent-weighted-v1",
        "note": "Heuristic score from the seeded picture. Not a calibrated probability.",
    }


def _weather_penalty(snapshot: dict[str, Any], mission: dict[str, Any]) -> float:
    rows = [row for row in snapshot.get("weather") or [] if row.get("base_id") == mission["launch_base"]]
    if not rows:
        return 0.5
    row = rows[0]
    minima = mission.get("wx_minima") or {}
    ceiling = float(row.get("ceiling_ft") or 0)
    need = float(minima.get("ceiling_ft") or 1000)
    if ceiling <= 0:
        return 1.0
    return max(0.0, min(1.0, need / ceiling))
