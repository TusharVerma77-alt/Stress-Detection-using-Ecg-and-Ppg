"""
model_loader.py — Loads the joblib model artifact once at startup.

Resolves the model from (in order of preference):
  1. WESAD_MODEL_PATH env variable
  2. ../../final12.joblib  (sibling to the frontend folder)
  3. ../../final_project_model.joblib

Also builds a SHAP TreeExplainer if shap is installed.
"""
from __future__ import annotations

import os
import logging
from pathlib import Path

import joblib
import numpy as np

logger = logging.getLogger(__name__)

# ── label map (WESAD 1-indexed → human name) ────────────────────────────────
LABEL_MAP: dict[int, str] = {
    1: "Baseline",
    2: "Stress",
    3: "Amusement",
    4: "Meditation",
}

# Ordered feature names from final13.json / Final15.ipynb
FEATURE_NAMES: list[str] = [
    "heart_rate", "mean_hr", "mean_rr", "median_rr", "sdnn", "rmssd", "sdsd",
    "nn20", "nn50", "pnn20", "pnn50", "cvnn", "rr_variance", "rr_range",
    "lf_power", "hf_power", "total_power", "lf_hf_ratio", "lf_nu", "hf_nu",
    "peak_frequency", "spectral_entropy", "psd_mean", "psd_std",
    "ecg_wav_energy_L0", "ecg_wav_energy_L1", "ecg_wav_energy_L2",
    "ecg_wav_energy_L3", "ecg_wav_energy_L4",
    "ppg_wav_energy_L0", "ppg_wav_energy_L1", "ppg_wav_energy_L2",
    "ppg_wav_energy_L3", "ppg_wav_energy_L4",
    "ecg_app_entropy", "ecg_svd_entropy", "ecg_spectral_entropy",
    "ecg_higuchi_fd", "ecg_katz_fd", "ecg_detrended_fluctuation",
    "ecg_sampen", "ecg_perm_entropy", "ecg_hjorth_mobility", "ecg_hjorth_complexity",
    "ppg_sampen", "ppg_perm_entropy", "ppg_hjorth_mobility", "ppg_hjorth_complexity",
    "ecg_mean", "ecg_std", "ppg_mean", "ppg_std", "ppg_min", "ppg_max",
    "pulse_rate", "pulse_interval_mean", "pulse_interval_std",
    "pulse_amplitude", "pulse_amplitude_std", "ppg_variance", "ppg_rms",
    "ppg_skewness", "ppg_kurtosis", "ppg_iqr", "ppg_energy",
    "ppg_dominant_freq", "ppg_bandpower", "ppg_spectral_entropy",
    "ppg_app_entropy", "ppg_svd_entropy", "ppg_higuchi_fd", "ppg_katz_fd",
    "ppg_dfa", "ecg_hjorth_activity", "ppg_hjorth_activity", "baevsky_index",
    "ecg_sqi", "ppg_sqi", "resp_rate_mean", "resp_rate_std",
    "resp_interval_cv", "resp_interval_iqr", "resp_amplitude_std",
    "resp_amplitude_skew", "resp_amplitude_kurtosis",
]

_HERE = Path(__file__).parent          # backend/app/
_ROOT = _HERE.parent.parent            # project root (final project/)

# Ensure WESADXGBWrapper is registered in sys.modules so joblib deserialization succeeds
try:
    import sys
    sys.path.append(str(_ROOT))
    sys.path.append(str(_HERE.parent))
    from final14 import WESADXGBWrapper
    sys.modules["__main__"].WESADXGBWrapper = WESADXGBWrapper
    sys.modules["final14"] = sys.modules.get("final14") or sys.modules["__main__"]
except Exception as _exc:
    logger.debug("WESADXGBWrapper auto-registration note: %s", _exc)


def _resolve_model_path() -> Path:
    env = os.getenv("WESAD_MODEL_PATH")
    if env:
        p = Path(env)
        if p.exists():
            return p
        logger.warning("WESAD_MODEL_PATH set but not found: %s", p)

    candidates = [
        _ROOT / "final12.joblib",
        _HERE.parent / "final12.joblib",
        Path("final12.joblib"),
        Path("/app/final12.joblib"),
        _ROOT / "final_project_model.joblib",
        _HERE.parent / "model.joblib",
    ]
    for c in candidates:
        if c.exists():
            return c

    raise FileNotFoundError(
        "No model file found. Set WESAD_MODEL_PATH or place final12.joblib "
        f"in {_ROOT}"
    )


class ModelBundle:
    """Holds the loaded model, SHAP explainer, and metadata."""

    def __init__(self) -> None:
        path = _resolve_model_path()
        logger.info("Loading model from %s", path)
        self.model = joblib.load(path)
        self.model_class: str = type(self.model).__name__
        self.n_features: int = len(FEATURE_NAMES)
        self.classes: list[str] = [LABEL_MAP[i] for i in sorted(LABEL_MAP)]

        # SHAP TreeExplainer
        self.explainer = None
        self.shap_available = False
        try:
            import shap  # noqa: PLC0415
            # Use the inner XGBClassifier if wrapped
            inner = getattr(self.model, "model", self.model)
            self.explainer = shap.TreeExplainer(inner)
            self.shap_available = True
            logger.info("SHAP TreeExplainer ready")
        except Exception as exc:  # noqa: BLE001
            logger.warning("SHAP unavailable: %s", exc)

    # ── inference ────────────────────────────────────────────────────────────

    def predict(self, features: list[float]):
        """
        Returns (predicted_label_str, probabilities_dict, shap_values, base_value).
        shap_values may be None if SHAP is unavailable.
        """
        x = np.array(features, dtype=np.float64).reshape(1, -1)

        # Handle wrapper (WESADXGBWrapper) vs plain XGBClassifier
        if hasattr(self.model, "predict_proba"):
            proba = self.model.predict_proba(x)[0]
            raw_pred = self.model.predict(x)[0]
        else:
            proba = self.model.predict_proba(x)[0]
            raw_pred = int(np.argmax(proba))

        # Map integer prediction → label string
        if isinstance(raw_pred, (int, np.integer)):
            # 1-indexed wrapper: 1,2,3,4 → label map
            if int(raw_pred) in LABEL_MAP:
                label = LABEL_MAP[int(raw_pred)]
            else:
                # 0-indexed: 0,1,2,3
                label = self.classes[int(raw_pred)]
        else:
            label = str(raw_pred)

        prob_dict = {self.classes[i]: float(proba[i]) for i in range(len(self.classes))}

        # SHAP
        shap_vals = None
        base_value = 0.0
        if self.explainer is not None:
            try:
                sv = self.explainer.shap_values(x)
                # sv shape: (n_classes, 1, n_features) or (1, n_features, n_classes)
                class_idx = self.classes.index(label)
                if isinstance(sv, list):
                    shap_vals = sv[class_idx][0]
                elif sv.ndim == 3:
                    shap_vals = sv[0, :, class_idx]
                else:
                    shap_vals = sv[0]
                ev = self.explainer.expected_value
                base_value = float(ev[class_idx] if hasattr(ev, "__len__") else ev)
            except Exception as exc:  # noqa: BLE001
                logger.warning("SHAP inference failed: %s", exc)

        return label, prob_dict, shap_vals, base_value


# Singleton — loaded once on import
_bundle: ModelBundle | None = None


def get_bundle() -> ModelBundle:
    global _bundle  # noqa: PLW0603
    if _bundle is None:
        _bundle = ModelBundle()
    return _bundle
