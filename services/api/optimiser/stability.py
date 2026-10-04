"""Stability metrics when comparing a new plan to a published baseline."""

from __future__ import annotations

from typing import Any

from optimiser.timeutil import minutes_between, parse_iso


def stability_metrics(
    previous: list[dict[str, Any]],
    current: list[dict[str, Any]],
    *,
    freeze_window_min: int = 60,
    epoch_iso: str,
    sim_now_iso: str,
) -> dict[str, Any]:
    epoch = parse_iso(epoch_iso)
    now_min = minutes_between(epoch, parse_iso(sim_now_iso))
    prior = {(row["mission_id"], row["slot"]): row for row in previous}
    current_keys = {(row["mission_id"], row["slot"]) for row in current}
    preserved = 0
    changed = 0
    aircraft_swaps = 0
    crew_swaps = 0
    base_changes = 0
    time_shifts: list[int] = []

    for key, old in prior.items():
        new = next((row for row in current if (row["mission_id"], row["slot"]) == key), None)
        if new is None:
            changed += 1
            continue
        same = (
            old["tail"] == new["tail"]
            and old["crew_ids"] == new["crew_ids"]
            and old["base_launch"] == new["base_launch"]
            and old["start"] == new["start"]
        )
        if same:
            preserved += 1
        else:
            changed += 1
            if old["tail"] != new["tail"]:
                aircraft_swaps += 1
            if old["crew_ids"] != new["crew_ids"]:
                crew_swaps += 1
            if old["base_launch"] != new["base_launch"]:
                base_changes += 1
            time_shifts.append(
                abs(minutes_between(epoch, parse_iso(old["start"])) - minutes_between(epoch, parse_iso(new["start"])))
            )

    dropped = len(prior) - len(prior.keys() & current_keys)
    added = len(current_keys - prior.keys())
    total_slots = max(len(prior), 1)
    stability_score = round(preserved / total_slots, 4)
    mean_shift = round(sum(time_shifts) / len(time_shifts), 1) if time_shifts else 0.0

    weighted_penalty = 0.0
    for key, old in prior.items():
        new = next((row for row in current if (row["mission_id"], row["slot"]) == key), None)
        if new is None or (
            old["tail"] == new["tail"]
            and old["crew_ids"] == new["crew_ids"]
            and old["start"] == new["start"]
        ):
            continue
        launch_min = minutes_between(epoch, parse_iso(old["start"]))
        proximity = max(1.0, (launch_min - now_min) / max(1, freeze_window_min))
        weighted_penalty += 1.0 / proximity

    return {
        "missions_preserved": preserved,
        "missions_changed": changed + dropped + added,
        "slots_preserved": preserved,
        "slots_changed": changed + dropped + added,
        "aircraft_swaps": aircraft_swaps,
        "crew_swaps": crew_swaps,
        "base_changes": base_changes,
        "mean_time_shift_minutes": mean_shift,
        "stability_score": stability_score,
        "proximity_weighted_changes": round(weighted_penalty, 3),
    }
