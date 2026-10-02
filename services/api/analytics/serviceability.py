"""Train a small serviceability model on the synthetic fleet and report holdout scores."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from scenarios.generate import generate_world
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, roc_auc_score
from sklearn.model_selection import train_test_split

OUT = Path(__file__).resolve().parents[3] / "docs" / "benchmarks" / "serviceability.json"


def train(seed: int = 26250) -> dict[str, object]:
    world = generate_world(seed, "S1", "M")
    features = []
    labels = []
    for craft in world["aircraft"]:
        features.append(
            [
                float(craft["hours_to_inspection"]),
                float(len(craft["defects"])),
                float(craft["sorties_72h"]),
            ]
        )
        labels.append(1 if craft["status"] == "FMC" else 0)
    matrix = np.array(features)
    target = np.array(labels)
    if len(set(target.tolist())) < 2:
        payload = {"simulated": True, "trained": False, "reason": "The seed has only one class."}
    else:
        train_x, test_x, train_y, test_y = train_test_split(matrix, target, test_size=0.3, random_state=seed, stratify=target)
        model = LogisticRegression(max_iter=200)
        model.fit(train_x, train_y)
        probs = model.predict_proba(test_x)[:, 1]
        payload = {
            "simulated": True,
            "trained": True,
            "model": "logistic-regression-v1",
            "seed": seed,
            "holdout_rows": int(len(test_y)),
            "auc": round(float(roc_auc_score(test_y, probs)), 3),
            "brier": round(float(brier_score_loss(test_y, probs)), 3),
            "features": ["hours_to_inspection", "defect_count", "sorties_72h"],
            "note": "Holdout score on the seeded fleet. The planner still uses the seeded chance of staying usable.",
        }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=2))
    return payload
