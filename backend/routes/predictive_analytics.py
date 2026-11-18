"""Experimental Decision Tree predictions for future LibSync return outcomes.

This module is intentionally separate from admin_risk.py. It does not alter or
reuse the existing rule-based return-performance scoring model.
"""

import logging
import math
from collections import defaultdict
from datetime import datetime

from flask import Blueprint, jsonify
from database import get_db_connection
from .auth import require_role

logger = logging.getLogger(__name__)
predictive_analytics_bp = Blueprint("predictive_analytics", __name__)

FEATURES = [
    "previous_completed_batches",
    "previous_late_rate",
    "previous_on_time_rate",
    "previous_average_days_late",
    "previous_total_late_days",
    "new_batch_book_count",
    "loan_duration_hours",
]


def _as_datetime(value):
    if value is None:
        return None
    if isinstance(value, str):
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    return value


def _batch_features(history, batch_book_count, loan_duration_hours):
    completed = len(history)
    late_count = sum(item["is_late"] for item in history)
    on_time_count = completed - late_count
    late_days = [item["late_days"] for item in history if item["is_late"]]
    return {
        "previous_completed_batches": completed,
        "previous_late_rate": late_count / completed if completed else 0.0,
        "previous_on_time_rate": on_time_count / completed if completed else 0.0,
        "previous_average_days_late": (sum(late_days) / len(late_days)) if late_days else 0.0,
        "previous_total_late_days": sum(late_days),
        "new_batch_book_count": batch_book_count,
        "loan_duration_hours": loan_duration_hours,
    }


def _group_batch_rows(rows):
    batches = {}
    for row in rows:
        batch_id = row["batch_id"]
        if batch_id not in batches:
            released_at = _as_datetime(row["released_at"])
            due_date = _as_datetime(row["due_date"])
            duration_hours = 24.0
            if released_at and due_date:
                duration_hours = max(0.0, (due_date - released_at).total_seconds() / 3600)
            batches[batch_id] = {
                "batch_id": batch_id,
                "user_id": row["user_id"],
                "student_name": row.get("student_name") or f"Student #{row['user_id']}",
                "released_at": released_at,
                "due_date": due_date,
                "loan_duration_hours": duration_hours,
                "book_count": 0,
                "returned_count": 0,
                "is_late": 0,
                "late_days": 0,
            }
        batch = batches[batch_id]
        batch["book_count"] += 1
        returned_at = _as_datetime(row.get("returned_at"))
        if returned_at is not None:
            batch["returned_count"] += 1
            due_date = batch["due_date"]
            if due_date and returned_at > due_date:
                batch["is_late"] = 1
                seconds_late = (returned_at - due_date).total_seconds()
                batch["late_days"] = max(
                    batch["late_days"], math.ceil(seconds_late / 86400)
                )
    return list(batches.values())


def _build_training_rows(batches):
    histories = defaultdict(list)
    training_rows = []
    completed_batches = [b for b in batches if b["returned_count"] == b["book_count"] and b["book_count"] > 0]
    completed_batches.sort(key=lambda b: (b["released_at"] or datetime.min, b["batch_id"]))

    for batch in completed_batches:
        history = histories[batch["user_id"]]
        # A transaction is predicted only from that student's earlier completed
        # transactions. The current batch outcome is never included in its inputs.
        if history:
            training_rows.append({
                "features": _batch_features(
                    history, batch["book_count"], batch["loan_duration_hours"]
                ),
                "target": int(batch["is_late"]),
                "user_id": batch["user_id"],
            })
        history.append(batch)

    return training_rows, completed_batches


@predictive_analytics_bp.route("/api/admin/predictive-analytics", methods=["GET"])
@require_role("admin")
def get_predictive_analytics():
    """Train an experimental Decision Tree from completed batches and predict
    currently released, not-yet-completed batches. Read-only database access.
    """
    connection = None
    cursor = None
    try:
        connection = get_db_connection()
        if connection is None:
            return jsonify({"status": "error", "message": "Database connection failed."}), 500

        cursor = connection.cursor(dictionary=True)
        cursor.execute("""
            SELECT
                bb.id AS batch_id,
                bb.user_id,
                u.name AS student_name,
                bb.borrow_qr_used_at AS released_at,
                bb.due_date,
                bb.loan_days,
                br.id AS request_id,
                br.returned_at
            FROM borrow_batches bb
            INNER JOIN borrow_requests br ON br.batch_id = bb.id
            INNER JOIN users u ON u.id = bb.user_id
            WHERE u.role = 'student'
              AND bb.borrow_qr_used_at IS NOT NULL
              AND bb.due_date IS NOT NULL
              AND br.status = 'approved'
            ORDER BY bb.user_id ASC, bb.borrow_qr_used_at ASC, bb.id ASC, br.id ASC
        """)
        batches = _group_batch_rows(cursor.fetchall())
        training_rows, completed_batches = _build_training_rows(batches)

        if len(training_rows) < 6:
            return jsonify({
                "status": "success",
                "model": {"name": "Decision Tree Classifier", "algorithm": "DecisionTreeClassifier", "version": "prototype-1.0"},
                "training": {
                    "status": "insufficient_data",
                    "examples": len(training_rows),
                    "late_examples": sum(row["target"] == 1 for row in training_rows),
                    "on_time_examples": sum(row["target"] == 0 for row in training_rows),
                    "message": "At least 6 historical examples are required before fitting the prototype model.",
                },
                "feature_importance": [],
                "predictions": [],
                "notes": ["The existing return-performance scoring model is not modified or used by this predictive model."],
            }), 200

        late_examples = sum(row["target"] == 1 for row in training_rows)
        on_time_examples = len(training_rows) - late_examples
        if late_examples < 2 or on_time_examples < 2:
            return jsonify({
                "status": "success",
                "model": {"name": "Decision Tree Classifier", "algorithm": "DecisionTreeClassifier", "version": "prototype-1.0"},
                "training": {
                    "status": "insufficient_class_balance",
                    "examples": len(training_rows),
                    "late_examples": late_examples,
                    "on_time_examples": on_time_examples,
                    "message": "The model needs at least 2 examples in each outcome class. Collect more completed returns before training.",
                },
                "feature_importance": [],
                "predictions": [],
                "notes": ["No accuracy score is reported because the current outcome classes are too sparse for meaningful evaluation."],
            }), 200

        try:
            from sklearn.tree import DecisionTreeClassifier
        except ImportError:
            return jsonify({
                "status": "error",
                "message": "Predictive analytics dependency is missing. Install the backend requirements and restart Flask.",
            }), 503

        x_train = [[row["features"][feature] for feature in FEATURES] for row in training_rows]
        y_train = [row["target"] for row in training_rows]
        model = DecisionTreeClassifier(
            max_depth=3,
            min_samples_leaf=2,
            class_weight="balanced",
            random_state=42,
        )
        model.fit(x_train, y_train)

        importance = [
            {"feature": feature, "importance": round(float(value), 4)}
            for feature, value in zip(FEATURES, model.feature_importances_)
        ]
        importance.sort(key=lambda item: item["importance"], reverse=True)

        predictions = []
        histories = defaultdict(list)
        completed_by_user = defaultdict(list)
        for batch in completed_batches:
            completed_by_user[batch["user_id"]].append(batch)

        active_batches = [b for b in batches if b["returned_count"] < b["book_count"] and b["book_count"] > 0]
        active_batches.sort(key=lambda b: (b["released_at"] or datetime.min, b["batch_id"]))
        for batch in active_batches:
            prior_history = [
                item for item in completed_by_user.get(batch["user_id"], [])
                if item["released_at"] and batch["released_at"] and item["released_at"] < batch["released_at"]
            ]
            if not prior_history:
                predictions.append({
                    "batch_id": batch["batch_id"],
                    "user_id": batch["user_id"],
                    "student_name": batch["student_name"],
                    "prediction": None,
                    "message": "Not enough previous completed borrowing history for this student.",
                    "book_count": batch["book_count"],
                })
                continue

            features = _batch_features(
                prior_history, batch["book_count"], batch["loan_duration_hours"]
            )
            vector = [[features[feature] for feature in FEATURES]]
            predicted_class = int(model.predict(vector)[0])
            probabilities = model.predict_proba(vector)[0]
            class_probabilities = {
                int(label): float(probability)
                for label, probability in zip(model.classes_, probabilities)
            }
            predictions.append({
                "batch_id": batch["batch_id"],
                "user_id": batch["user_id"],
                "student_name": batch["student_name"],
                "prediction": "LATE" if predicted_class == 1 else "ON TIME",
                "predicted_class_probability": round(class_probabilities.get(predicted_class, 0.0) * 100, 1),
                "book_count": batch["book_count"],
                "previous_completed_batches": features["previous_completed_batches"],
                "previous_late_rate": round(features["previous_late_rate"] * 100, 1),
                "loan_duration_hours": round(features["loan_duration_hours"], 1),
            })

        return jsonify({
            "status": "success",
            "model": {
                "name": "Student Late-Return Prediction",
                "algorithm": "Decision Tree Classifier",
                "version": "prototype-1.0",
                "max_depth": 3,
                "min_samples_leaf": 2,
                "training_mode": "Retrained from current database history when this Admin page is loaded",
            },
            "training": {
                "status": "trained_prototype",
                "examples": len(training_rows),
                "late_examples": late_examples,
                "on_time_examples": on_time_examples,
                "students_represented": len({row["user_id"] for row in training_rows}),
                "completed_batches_available": len(completed_batches),
                "evaluation_status": "withheld_small_dataset",
                "evaluation_message": "No accuracy score is shown: the historical dataset is too small for a reliable holdout evaluation. Predictions are experimental.",
            },
            "feature_importance": importance,
            "predictions": predictions,
            "notes": [
                "The target is LATE when at least one book in a completed batch was returned after its due timestamp; otherwise it is ON TIME.",
                "Training features use only the student's earlier completed batches and the target batch's book count and loan duration.",
                "The current batch's return timestamps are never used as prediction inputs.",
                "The existing rule-based return-performance scoring model and its API are unchanged.",
                "The model is experimental because the current dataset is small and imbalanced; do not treat its output as a definitive judgment of a student.",
            ],
        }), 200

    except Exception:
        logger.exception("Failed to generate LibSync predictive analytics.")
        return jsonify({"status": "error", "message": "Unable to generate predictive analytics."}), 500
    finally:
        if cursor is not None:
            cursor.close()
        if connection is not None:
            connection.close()
