from __future__ import annotations

from typing import Any, Sequence
import numpy as np

from .tensor_utils import as_float_tensor, matricization, norm
from ..algorithms.matrix.svd import svd

def shift_hyperslice(
    tensor: np.ndarray,
    mode: int,
    slice_idx: int,
    target_axis: int,
    shift: int,
) -> np.ndarray:
    """Circularly shifts a (D - 1)-dimensional hyperslice of a tensor along a target axis.

    Args:
        tensor: Input tensor as a NumPy array (ndim >= 2).
        mode: The axis of the hyperslice (mode index, 0 <= mode < ndim).
        slice_idx: The slice index along the specified mode (0 <= slice_idx < shape[mode]).
        target_axis: The axis along which the hyperslice is shifted (target_axis != mode).
        shift: Integer shift amount (positive or negative).

    Returns:
        A copy of the tensor with the specified hyperslice circularly shifted.
    """
    if shift == 0 or mode == target_axis or tensor.ndim < 2:
        return tensor

    transformed = tensor.copy()
    slice_spec = [slice(None)] * tensor.ndim
    slice_spec[mode] = slice_idx

    # In the (D - 1)-dimensional sub-tensor, determine the target axis index
    sub_axis = target_axis if target_axis < mode else target_axis - 1
    transformed[tuple(slice_spec)] = np.roll(
        transformed[tuple(slice_spec)],
        shift=shift,
        axis=sub_axis,
    )
    return transformed


def tensor_nuclear_norm_loss(tensor: np.ndarray) -> float:
    """Computes the multilinear nuclear norm loss proxy from the PuzzleTensor paper:
    
        L(Z) = sum_{k=1}^D (1 / sqrt(I_k)) * ||Z_(k)||_*

    Minimizing this objective induces sparsity in the HOSVD core tensor,
    lowering effective multilinear rank and enabling more compact factorization.

    Args:
        tensor: Input tensor.

    Returns:
        Aggregated normalized nuclear norm across all mode unfoldings.
    """
    if tensor.ndim < 2:
        return float(norm(tensor))

    total_loss = 0.0
    for mode in range(tensor.ndim):
        unfolding = matricization(tensor, mode)
        singular_values = svd(unfolding)["singular_values"]
        total_loss += float(np.sum(singular_values) / np.sqrt(tensor.shape[mode]))
    return total_loss


def puzzle_tensor(
    tensor: np.ndarray | Sequence[Any],
    max_iter: int = 2,
    max_shift: int = 2,
    return_shifts: bool = False,
) -> np.ndarray | tuple[np.ndarray, list[dict[str, int]]]:
    """Applies hyperslice shifting to align tensor patterns and reduce effective rank.

    Inspired by PuzzleTensor (Park et al., KDD 2025: "PuzzleTensor: A Method-Agnostic
    Data Transformation for Compact Tensor Factorization").

    This lightweight implementation uses coordinate-wise greedy alignment to search
    for hyperslice shifts that minimize the tensor nuclear norm objective across modes.

    Args:
        tensor: Input tensor (2D, 3D, 4D, or N-D array).
        max_iter: Maximum optimization passes over all modes and hyperslices (default: 2).
        max_shift: Maximum search shift radius along each axis (default: 2).
        return_shifts: If True, returns a tuple of (shifted_tensor, shifts_list).
            If False, returns just the shifted_tensor.

    Returns:
        Shifted tensor with lower effective rank, optionally accompanied by the
        list of applied shift operations for exact reconstruction.
    """
    arr = as_float_tensor(np.asarray(tensor))
    if arr.ndim < 2:
        return (arr, []) if return_shifts else arr

    current = arr.copy()
    shifts_applied: list[dict[str, int]] = []
    ndim = current.ndim
    current_loss = tensor_nuclear_norm_loss(current)

    for _ in range(max_iter):
        improved = False
        for mode in range(ndim):
            dim_size = current.shape[mode]
            for slice_idx in range(dim_size):
                for target_axis in range(ndim):
                    if target_axis == mode:
                        continue

                    target_dim_size = current.shape[target_axis]
                    shift_bound = min(max_shift, target_dim_size // 2)
                    if shift_bound < 1:
                        continue

                    best_shift = 0
                    best_loss = current_loss

                    for candidate_shift in range(-shift_bound, shift_bound + 1):
                        if candidate_shift == 0:
                            continue

                        candidate_tensor = shift_hyperslice(
                            current,
                            mode=mode,
                            slice_idx=slice_idx,
                            target_axis=target_axis,
                            shift=candidate_shift,
                        )
                        candidate_loss = tensor_nuclear_norm_loss(candidate_tensor)

                        if candidate_loss < best_loss - 1e-5:
                            best_loss = candidate_loss
                            best_shift = candidate_shift

                    if best_shift != 0:
                        current = shift_hyperslice(
                            current,
                            mode=mode,
                            slice_idx=slice_idx,
                            target_axis=target_axis,
                            shift=best_shift,
                        )
                        current_loss = best_loss
                        shifts_applied.append(
                            {
                                "mode": mode,
                                "slice_idx": slice_idx,
                                "target_axis": target_axis,
                                "shift": best_shift,
                            }
                        )
                        improved = True

        if not improved:
            break

    if return_shifts:
        return current, shifts_applied
    return current


def invert_puzzle_tensor(
    shifted_tensor: np.ndarray,
    shifts: list[dict[str, int]],
) -> np.ndarray:
    """Exact inverse transformation of puzzle_tensor.

    Reverses applied hyperslice shifts in reverse chronological order to
    restore the original tensor losslessly.

    Args:
        shifted_tensor: The tensor produced by puzzle_tensor.
        shifts: The list of shift operations returned when return_shifts=True.

    Returns:
        The exact reconstructed original tensor.
    """
    recovered = shifted_tensor.copy()
    for op in reversed(shifts):
        recovered = shift_hyperslice(
            recovered,
            mode=op["mode"],
            slice_idx=op["slice_idx"],
            target_axis=op["target_axis"],
            shift=-op["shift"],
        )
    return recovered
