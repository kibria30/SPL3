"""TimeMixer (Wang et al., 2024), self-contained.

Core idea: decompose the input at multiple down-sampled scales (full resolution, half,
quarter, ...) via moving-average series_decomp. Seasonal parts are mixed bottom-up (fine scale
informs coarser scales), trend parts are mixed top-down (coarse scale informs finer scales) --
the opposite directions reflect that high-frequency seasonal detail is best captured at fine
resolution while trend is best captured at coarse resolution. Every scale gets its own small
predictor `Linear(L_i, pred_len)`, and the final forecast sums all scales' predictions.

Channel-independent: each variate is treated as its own batch item (matches DLinear's approach,
just repeated at several time resolutions instead of one).
"""
import torch
import torch.nn as nn
import torch.nn.functional as F

from services.trainer import TorchForecaster
from models.dlinear import _SeriesDecomp  # reuse the same moving-average decomposition


class _TimeMixerNet(nn.Module):
    def __init__(self, seq_len, pred_len, n_vars, moving_avg_kernel=7,
                 down_sampling_window=2, down_sampling_layers=2):
        super().__init__()
        assert seq_len % (down_sampling_window ** down_sampling_layers) == 0, \
            "seq_len must be evenly divisible by down_sampling_window ** down_sampling_layers"
        self.pred_len = pred_len
        self.down_sampling_window = down_sampling_window
        self.down_sampling_layers = down_sampling_layers
        self.decomp = _SeriesDecomp(moving_avg_kernel)

        self.scale_lens = [seq_len // (down_sampling_window ** i) for i in range(down_sampling_layers + 1)]

        # bottom-up season mixing: L_i -> L_{i+1}  (fine -> coarse)
        self.season_mix = nn.ModuleList([
            nn.Sequential(
                nn.Linear(self.scale_lens[i], self.scale_lens[i + 1]), nn.GELU(),
                nn.Linear(self.scale_lens[i + 1], self.scale_lens[i + 1]),
            ) for i in range(down_sampling_layers)
        ])
        # top-down trend mixing: L_{i+1} -> L_i  (coarse -> fine)
        self.trend_mix = nn.ModuleList([
            nn.Sequential(
                nn.Linear(self.scale_lens[i + 1], self.scale_lens[i]), nn.GELU(),
                nn.Linear(self.scale_lens[i], self.scale_lens[i]),
            ) for i in reversed(range(down_sampling_layers))
        ])
        # per-scale predictors, summed at the end
        self.predictors = nn.ModuleList([nn.Linear(L, pred_len) for L in self.scale_lens])

    def forward(self, x):  # x: [B, seq_len, N]
        B, L, N = x.shape
        x_ci = x.permute(0, 2, 1).reshape(B * N, L, 1)  # channel-independent

        scales = [x_ci]
        cur = x_ci
        for _ in range(self.down_sampling_layers):
            cur = F.avg_pool1d(cur.permute(0, 2, 1), kernel_size=self.down_sampling_window,
                                stride=self.down_sampling_window).permute(0, 2, 1)
            scales.append(cur)

        season_list, trend_list = [], []
        for s in scales:
            season, trend = self.decomp(s)               # each [B*N, L_i, 1]
            season_list.append(season.permute(0, 2, 1))  # [B*N, 1, L_i]
            trend_list.append(trend.permute(0, 2, 1))

        out_season = [season_list[0]]
        cur_season = season_list[0]
        for i in range(self.down_sampling_layers):
            cur_season = season_list[i + 1] + self.season_mix[i](cur_season)
            out_season.append(cur_season)

        trend_rev = list(reversed(trend_list))
        out_trend_rev = [trend_rev[0]]
        cur_trend = trend_rev[0]
        for i in range(self.down_sampling_layers):
            cur_trend = trend_rev[i + 1] + self.trend_mix[i](cur_trend)
            out_trend_rev.append(cur_trend)
        out_trend = list(reversed(out_trend_rev))

        preds = 0
        for i in range(len(self.scale_lens)):
            combined = out_season[i] + out_trend[i]        # [B*N, 1, L_i]
            preds = preds + self.predictors[i](combined)   # [B*N, 1, pred_len]

        preds = preds.squeeze(1)                            # [B*N, pred_len]
        preds = preds.reshape(B, N, self.pred_len).permute(0, 2, 1)  # [B, pred_len, N]
        return preds


class TimeMixerForecaster(TorchForecaster):
    name = "TimeMixer"

    def build_model(self, seq_len, pred_len, n_vars):
        kw = self.model_kwargs
        down_window = kw.get("down_sampling_window", 2)
        down_layers = kw.get("down_sampling_layers", 2)

        # shrink down_sampling_layers if seq_len doesn't divide evenly at the requested depth
        while down_layers > 0 and seq_len % (down_window ** down_layers) != 0:
            down_layers -= 1

        smallest_scale = seq_len // (down_window ** down_layers)
        kernel = kw.get("moving_avg_kernel", 7)
        if kernel >= smallest_scale:
            kernel = smallest_scale - 1 if (smallest_scale - 1) % 2 == 1 else smallest_scale - 2
            kernel = max(kernel, 3)

        return _TimeMixerNet(
            seq_len, pred_len, n_vars,
            moving_avg_kernel=kernel,
            down_sampling_window=down_window,
            down_sampling_layers=down_layers,
        )
