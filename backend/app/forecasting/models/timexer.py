"""TimeXer (Wang et al., 2024), self-contained.

Core idea: each variate is patch-embedded (fixed-length patches, linearly projected) plus one
learned global token; self-attention runs over a variate's own patches + its global token. The
global token then cross-attends to inverted (whole-series) embeddings of *all* variates,
injecting cross-variate context without patching every variate against every other. A flatten
head maps `(patch_num + 1) * d_model -> pred_len`.
"""
import torch
import torch.nn as nn

from services.trainer import TorchForecaster


class _TimeXerNet(nn.Module):
    def __init__(self, seq_len, pred_len, n_vars, patch_len=16, d_model=64, n_heads=4,
                 e_layers=1, d_ff=128, dropout=0.1):
        super().__init__()
        assert seq_len % patch_len == 0, "seq_len must be divisible by patch_len"
        self.patch_len = patch_len
        self.patch_num = seq_len // patch_len
        self.n_vars = n_vars
        self.pred_len = pred_len
        self.d_model = d_model

        self.value_embedding = nn.Linear(patch_len, d_model)
        self.glb_token = nn.Parameter(torch.randn(1, n_vars, 1, d_model) * 0.02)
        self.pos_embedding = nn.Parameter(torch.randn(1, self.patch_num + 1, d_model) * 0.02)
        self.ex_embedding = nn.Linear(seq_len, d_model)  # inverted (whole-series) embedding

        self.self_attn = nn.ModuleList(
            [nn.MultiheadAttention(d_model, n_heads, dropout=dropout, batch_first=True) for _ in range(e_layers)])
        self.cross_attn = nn.ModuleList(
            [nn.MultiheadAttention(d_model, n_heads, dropout=dropout, batch_first=True) for _ in range(e_layers)])
        self.ffn = nn.ModuleList(
            [nn.Sequential(nn.Linear(d_model, d_ff), nn.GELU(), nn.Linear(d_ff, d_model)) for _ in range(e_layers)])
        self.norm1 = nn.ModuleList([nn.LayerNorm(d_model) for _ in range(e_layers)])
        self.norm2 = nn.ModuleList([nn.LayerNorm(d_model) for _ in range(e_layers)])
        self.norm3 = nn.ModuleList([nn.LayerNorm(d_model) for _ in range(e_layers)])
        self.e_layers = e_layers
        self.dropout = nn.Dropout(dropout)

        self.head = nn.Linear(d_model * (self.patch_num + 1), pred_len)

    def forward(self, x):  # x: [B, seq_len, N]
        B, L, N = x.shape
        means = x.mean(1, keepdim=True).detach()
        x = x - means
        stdev = torch.sqrt(x.var(dim=1, keepdim=True, unbiased=False) + 1e-5)
        x_norm = x / stdev

        # endogenous: patch-embed every variate independently
        xp = x_norm.permute(0, 2, 1)                        # [B, N, L]
        xp = xp.unfold(-1, self.patch_len, self.patch_len)  # [B, N, patch_num, patch_len]
        xp = xp.reshape(B * N, self.patch_num, self.patch_len)
        patch_embed = self.value_embedding(xp)                # [B*N, patch_num, d_model]
        glb = self.glb_token.repeat(B, 1, 1, 1).reshape(B * N, 1, self.d_model)
        en = torch.cat([patch_embed, glb], dim=1) + self.pos_embedding
        en = self.dropout(en)

        # exogenous: whole-series-as-token embedding for every variate (cross context)
        ex = self.ex_embedding(x_norm.permute(0, 2, 1))         # [B, N, d_model]
        ex_kv = ex.unsqueeze(1).repeat(1, N, 1, 1).reshape(B * N, N, self.d_model)

        for i in range(self.e_layers):
            attn_out, _ = self.self_attn[i](en, en, en)
            en = self.norm1[i](en + attn_out)

            glb_tok = en[:, -1:, :]
            cross_out, _ = self.cross_attn[i](glb_tok, ex_kv, ex_kv)
            glb_tok = self.norm2[i](glb_tok + cross_out)
            en = torch.cat([en[:, :-1, :], glb_tok], dim=1)

            en = self.norm3[i](en + self.ffn[i](en))

        out = self.head(en.reshape(B * N, -1))            # [B*N, pred_len]
        out = out.reshape(B, N, self.pred_len).permute(0, 2, 1)  # [B, pred_len, N]

        out = out * stdev.repeat(1, self.pred_len, 1)
        out = out + means.repeat(1, self.pred_len, 1)
        return out


class TimeXerForecaster(TorchForecaster):
    name = "TimeXer"

    def build_model(self, seq_len, pred_len, n_vars):
        kw = self.model_kwargs
        patch_len = kw.get("patch_len", 16)
        if seq_len % patch_len != 0:
            # fall back to a divisor of seq_len close to the requested patch length
            for candidate in range(patch_len, 0, -1):
                if seq_len % candidate == 0:
                    patch_len = candidate
                    break
        return _TimeXerNet(
            seq_len, pred_len, n_vars,
            patch_len=patch_len,
            d_model=kw.get("d_model", 64),
            n_heads=kw.get("n_heads", 4),
            e_layers=kw.get("e_layers", 1),
            d_ff=kw.get("d_ff", 128),
            dropout=kw.get("dropout", 0.1),
        )
