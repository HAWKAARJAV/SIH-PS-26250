"""The initial Alembic revision matches Base.metadata.create_all."""

from __future__ import annotations

from pathlib import Path

from alembic import command
from alembic.config import Config
from app.tables import Base
from sqlalchemy import create_engine, inspect


def test_upgrade_matches_create_all_and_downgrades(tmp_path, monkeypatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    url = f"sqlite:///{tmp_path / 'migrated.db'}"
    cfg = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    cfg.set_main_option("sqlalchemy.url", url)
    command.upgrade(cfg, "head")
    command.downgrade(cfg, "base")
    command.upgrade(cfg, "head")

    migrated = create_engine(url)
    created = create_engine(f"sqlite:///{tmp_path / 'created.db'}")
    Base.metadata.create_all(created)
    left = inspect(migrated)
    right = inspect(created)
    tables = set(right.get_table_names())
    assert tables
    assert tables == set(left.get_table_names()) - {"alembic_version"}
    for table in sorted(tables):
        assert [column["name"] for column in left.get_columns(table)] == [column["name"] for column in right.get_columns(table)]
        assert left.get_pk_constraint(table)["constrained_columns"] == right.get_pk_constraint(table)["constrained_columns"]
        assert _pairs(left.get_unique_constraints(table)) == _pairs(right.get_unique_constraints(table))
        assert _fk_pairs(left.get_foreign_keys(table)) == _fk_pairs(right.get_foreign_keys(table))


def _pairs(constraints: list[dict]) -> list[tuple[str, ...]]:
    return sorted(tuple(item["column_names"]) for item in constraints)


def _fk_pairs(constraints: list[dict]) -> list[tuple[tuple[str, ...], str, tuple[str, ...]]]:
    return sorted((tuple(item["constrained_columns"]), item["referred_table"], tuple(item["referred_columns"])) for item in constraints)
