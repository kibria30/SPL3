import time

import numpy as np
import torch
import torch.nn as nn

from models.base import BaseForecaster
from utils.windows import build_windows


class TorchForecaster(BaseForecaster):
    """Shared fit()/predict() for every torch-based model in this project: sliding-window
    dataset construction, mini-batch training, and early stopping on a held-out validation
    split. Subclasses only need to implement `build_model(seq_len, pred_len, n_vars)` --
    see models/dlinear.py for the smallest example.
    """

    name = "TorchForecaster"

    def __init__(self, epochs=100, lr=1e-3, batch_size=64, patience=5, device=None, **model_kwargs):
        self.epochs = epochs
        self.lr = lr
        self.batch_size = batch_size
        self.patience = patience
        self.model_kwargs = model_kwargs
        self.device = device or torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = None

    def build_model(self, seq_len: int, pred_len: int, n_vars: int) -> nn.Module:
        raise NotImplementedError

    def fit(self, train_series: np.ndarray, val_series: np.ndarray,
            seq_len: int, pred_len: int, n_vars: int) -> None:
        torch.manual_seed(2023)
        self.model = self.build_model(seq_len, pred_len, n_vars).to(self.device)

        X_train, Y_train = build_windows(train_series, seq_len, pred_len)
        X_val, Y_val = build_windows(val_series, seq_len, pred_len)

        X_train_t = torch.from_numpy(X_train).float().to(self.device)
        Y_train_t = torch.from_numpy(Y_train).float().to(self.device)
        X_val_t = torch.from_numpy(X_val).float().to(self.device)
        Y_val_t = torch.from_numpy(Y_val).float().to(self.device)

        optimizer = torch.optim.Adam(self.model.parameters(), lr=self.lr)
        loss_fn = nn.MSELoss()

        n = X_train_t.shape[0]
        best_val, best_state, patience_ctr = float("inf"), None, 0

        # Optional hook for the app layer to observe live progress (epoch/total, timing, log
        # lines) without this module -- a reusable ML library, also used standalone outside the
        # web app -- knowing anything about DB models or web requests. Set post-construction,
        # e.g. `model.progress_callback = fn`, not threaded through __init__/model_kwargs.
        progress_cb = getattr(self, "progress_callback", None)
        fit_start = time.time()

        for epoch in range(1, self.epochs + 1):
            self.model.train()
            perm = torch.randperm(n)
            for start in range(0, n, self.batch_size):
                idx = perm[start:start + self.batch_size]
                optimizer.zero_grad()
                loss = loss_fn(self.model(X_train_t[idx]), Y_train_t[idx])
                loss.backward()
                optimizer.step()

            self.model.eval()
            with torch.no_grad():
                val_loss = loss_fn(self.model(X_val_t), Y_val_t).item()

            message = None
            if epoch == 1 or epoch % 10 == 0:
                message = f"[{self.name}] epoch {epoch:03d}/{self.epochs}  val MSE {val_loss:.4f}"
                print(f"  {message}")

            if progress_cb:
                progress_cb(
                    epoch=epoch, total_epochs=self.epochs, val_loss=val_loss,
                    message=message, elapsed_seconds=time.time() - fit_start,
                )

            if val_loss < best_val - 1e-5:
                best_val = val_loss
                best_state = {k: v.clone() for k, v in self.model.state_dict().items()}
                patience_ctr = 0
            else:
                patience_ctr += 1
                if patience_ctr >= self.patience:
                    message = f"[{self.name}] early stopping at epoch {epoch} (best val MSE {best_val:.4f})"
                    print(f"  {message}")
                    if progress_cb:
                        progress_cb(
                            epoch=epoch, total_epochs=self.epochs, val_loss=best_val,
                            message=message, elapsed_seconds=time.time() - fit_start,
                        )
                    break

        if best_state is not None:
            self.model.load_state_dict(best_state)
        self.model.eval()

    def predict(self, input_window: np.ndarray) -> np.ndarray:
        x = torch.from_numpy(input_window).float().unsqueeze(0).to(self.device)
        with torch.no_grad():
            out = self.model(x).squeeze(0).cpu().numpy()
        return out

    def num_parameters(self):
        if self.model is None:
            return None
        return sum(p.numel() for p in self.model.parameters())
