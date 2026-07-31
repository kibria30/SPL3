"""DLinear (Zeng et al., 2023 -- "Are Transformers Effective for Time Series Forecasting?").

Decomposes the input into trend (moving-average) and seasonal (residual) components, applies
one linear layer per component, sums the two predictions. Channels share weights
(the paper's `individual=False` default).
"""
import torch
import torch.nn as nn

from services.trainer import TorchForecaster


class _MovingAvg(nn.Module):
    def __init__(self, kernel_size, stride=1):
        super().__init__()
        self.kernel_size = kernel_size
        self.avg = nn.AvgPool1d(kernel_size=kernel_size, stride=stride, padding=0)

    def forward(self, x):  # x: [B, L, C]
        front = x[:, 0:1, :].repeat(1, (self.kernel_size - 1) // 2, 1)
        end = x[:, -1:, :].repeat(1, (self.kernel_size - 1) // 2, 1)
        x = torch.cat([front, x, end], dim=1)
        x = self.avg(x.permute(0, 2, 1))
        return x.permute(0, 2, 1)


class _SeriesDecomp(nn.Module):
    def __init__(self, kernel_size):
        super().__init__()
        self.moving_avg = _MovingAvg(kernel_size, stride=1)

    def forward(self, x):
        trend = self.moving_avg(x)
        seasonal = x - trend
        return seasonal, trend


class _DLinearNet(nn.Module):
    def __init__(self, seq_len, pred_len, channels, moving_avg_kernel=25):
        super().__init__()
        self.decompsition = _SeriesDecomp(moving_avg_kernel)
        self.Linear_Seasonal = nn.Linear(seq_len, pred_len)
        self.Linear_Trend = nn.Linear(seq_len, pred_len)
        with torch.no_grad():
            self.Linear_Seasonal.weight.copy_((1 / seq_len) * torch.ones(pred_len, seq_len))
            self.Linear_Trend.weight.copy_((1 / seq_len) * torch.ones(pred_len, seq_len))

    def forward(self, x):  # x: [B, seq_len, C]
        seasonal_init, trend_init = self.decompsition(x)
        seasonal_init, trend_init = seasonal_init.permute(0, 2, 1), trend_init.permute(0, 2, 1)
        seasonal_output = self.Linear_Seasonal(seasonal_init)
        trend_output = self.Linear_Trend(trend_init)
        out = seasonal_output + trend_output
        return out.permute(0, 2, 1)  # [B, pred_len, C]


class DLinearForecaster(TorchForecaster):
    name = "DLinear"

    def build_model(self, seq_len, pred_len, n_vars):
        kernel = self.model_kwargs.get("moving_avg_kernel", 25)
        if kernel >= seq_len:  # keep kernel odd and strictly < seq_len
            kernel = seq_len - 1 if (seq_len - 1) % 2 == 1 else seq_len - 2
        return _DLinearNet(seq_len, pred_len, n_vars, kernel)
