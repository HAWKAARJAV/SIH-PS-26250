from __future__ import annotations

from fusion.snapshot import fuse
from scenarios.generate import small_world


def test_fuse_is_idempotent() -> None:
    world = small_world(26250)
    once = fuse(world)
    twice = fuse(once)
    assert once["_fused_v"] == twice["_fused_v"]
    assert once["fusion"]["feeds_total"] == twice["fusion"]["feeds_total"]


def test_fuse_attaches_provenance() -> None:
    world = small_world(1)
    fused = fuse(world)
    assert fused["aircraft"][0].get("provenance", "").startswith("FUSED")
