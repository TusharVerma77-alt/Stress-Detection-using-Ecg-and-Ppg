import numpy as np
import xgboost as xgb
from sklearn.base import BaseEstimator, ClassifierMixin

class WESADXGBWrapper(BaseEstimator, ClassifierMixin):
    """
    Wrapper for XGBClassifier to map WESAD 1-indexed labels (1, 2, 3, 4) 
    to XGBoost 0-indexed targets (0, 1, 2, 3) seamlessly.
    """
    def __init__(self, n_estimators=100, max_depth=6, learning_rate=0.1, subsample=0.8, colsample_bytree=0.8, random_state=42):
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.learning_rate = learning_rate
        self.subsample = subsample
        self.colsample_bytree = colsample_bytree
        self.random_state = random_state
        self.classes_ = np.array([1, 2, 3, 4])
        self.label_offset = 1
        
        self.model = xgb.XGBClassifier(
            n_estimators=self.n_estimators,
            max_depth=self.max_depth,
            learning_rate=self.learning_rate,
            subsample=self.subsample,
            colsample_bytree=self.colsample_bytree,
            random_state=self.random_state,
            eval_metric="mlogloss",
            tree_method="hist"
        )

    def fit(self, X, y):
        # Map 1, 2, 3, 4 -> 0, 1, 2, 3 for XGBoost
        y_xgb = y - self.label_offset
        self.model.fit(X, y_xgb)
        self.classes_ = np.array([1, 2, 3, 4])
        return self

    def predict(self, X):
        y_pred = self.model.predict(X)
        return y_pred + self.label_offset

    def predict_proba(self, X):
        return self.model.predict_proba(X)

    @property
    def feature_importances_(self):
        return self.model.feature_importances_
