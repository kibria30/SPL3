"""iTransformer (Liu et al., 2024 -- https://arxiv.org/abs/2310.06625), self-contained.

Core idea: invert what a "token" is. Each variate's *entire* series becomes one token (via a
Linear(seq_len, d_model) "inverted" embedding); self-attention then runs across the N
variate-tokens instead of across time steps, learning cross-variate correlations directly.
Per-instance mean/std normalization (Non-stationary Transformer trick) wraps the whole thing.
"""
import torch
import torch.nn as nn

from services.trainer import TorchForecaster


class _DataEmbeddingInverted(nn.Module):
    def __init__(self, seq_len, d_model, dropout=0.1):
        super().__init__()
        self.value_embedding = nn.Linear(seq_len, d_model)
        self.dropout = nn.Dropout(dropout)

    def forward(self, x):  # x: [B, L, N]
        x = x.permute(0, 2, 1)  # [B, N, L]
        return self.dropout(self.value_embedding(x))  # [B, N, d_model]


class _ITransformerNet(nn.Module):
    def __init__(self, seq_len, pred_len, n_vars, d_model=64, n_heads=4, e_layers=2, d_ff=128, dropout=0.1):
        super().__init__()
        self.pred_len = pred_len
        self.enc_embedding = _DataEmbeddingInverted(seq_len, d_model, dropout)
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model, nhead=n_heads, dim_feedforward=d_ff,
            dropout=dropout, activation="gelu", batch_first=True,
        )
        self.encoder = nn.TransformerEncoder(encoder_layer, num_layers=e_layers)
        self.projection = nn.Linear(d_model, pred_len)

    def forward(self, x):  # x: [B, seq_len, N]
        means = x.mean(1, keepdim=True).detach()
        x = x - means
        stdev = torch.sqrt(x.var(dim=1, keepdim=True, unbiased=False) + 1e-5)
        x = x / stdev

        enc_out = self.enc_embedding(x)      # [B, N, d_model] -- N tokens, one per variate
        enc_out = self.encoder(enc_out)      # attention runs ACROSS variates
        dec_out = self.projection(enc_out)   # [B, N, pred_len]
        dec_out = dec_out.permute(0, 2, 1)   # [B, pred_len, N]

        dec_out = dec_out * stdev.repeat(1, self.pred_len, 1)
        dec_out = dec_out + means.repeat(1, self.pred_len, 1)
        return dec_out


class ITransformerForecaster(TorchForecaster):
    name = "iTransformer"

    def build_model(self, seq_len, pred_len, n_vars):
        kw = self.model_kwargs
        return _ITransformerNet(
            seq_len, pred_len, n_vars,
            d_model=kw.get("d_model", 64),
            n_heads=kw.get("n_heads", 4),
            e_layers=kw.get("e_layers", 2),
            d_ff=kw.get("d_ff", 128),
            dropout=kw.get("dropout", 0.1),
        )
