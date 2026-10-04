"""Test defaults: COA generation uses threads so pytest stays reliable on macOS."""

from __future__ import annotations

import os

os.environ.setdefault("VYUHA_COA_POOL", "thread")
