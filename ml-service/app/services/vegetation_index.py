"""Vegetation coverage estimation via the Excess Green Index.

ExG = 2G - R - B (Woebbecke et al., 1995) is a standard vegetation index used in agricultural
and ecological remote sensing to separate green vegetation from soil/water/background in plain
RGB imagery, without needing a trained model. This is a real, citable, deterministic technique -
not a placeholder pretending to be something else. It estimates the *visible* vegetated
proportion of the frame, not a physical ground area (that conversion happens in the backend's
carbon calculation, combining this percentage with a reported/measured plot area).
"""

from dataclasses import dataclass

import numpy as np
from PIL import Image


@dataclass
class CoverageResult:
    coverage_pct: float
    threshold_used: float
    mean_exg: float


def compute_excess_green_index(rgb: np.ndarray) -> np.ndarray:
    r = rgb[..., 0].astype(np.float32)
    g = rgb[..., 1].astype(np.float32)
    b = rgb[..., 2].astype(np.float32)
    return 2 * g - r - b


def otsu_threshold(values: np.ndarray, bins: int = 256) -> float:
    """Otsu's method: the threshold that maximizes between-class variance of a histogram.
    Standard adaptive alternative to a fixed magic-number threshold."""
    hist, bin_edges = np.histogram(values, bins=bins)
    hist = hist.astype(np.float64)
    bin_centers = (bin_edges[:-1] + bin_edges[1:]) / 2

    total = hist.sum()
    if total == 0:
        return 0.0

    sum_total = float((hist * bin_centers).sum())
    sum_background = 0.0
    weight_background = 0.0
    best_variance = 0.0
    best_threshold = float(bin_centers[0])

    for count, center in zip(hist, bin_centers):
        weight_background += count
        if weight_background == 0:
            continue
        weight_foreground = total - weight_background
        if weight_foreground == 0:
            break
        sum_background += count * center
        mean_background = sum_background / weight_background
        mean_foreground = (sum_total - sum_background) / weight_foreground
        variance_between = weight_background * weight_foreground * (mean_background - mean_foreground) ** 2
        if variance_between > best_variance:
            best_variance = variance_between
            best_threshold = float(center)

    return best_threshold


def estimate_vegetation_coverage(image: Image.Image, min_threshold: float = 10.0) -> CoverageResult:
    """Returns the estimated visible-vegetation coverage percentage plus the intermediate
    values, so the API response can show its work rather than a bare number."""
    rgb = np.asarray(image.convert("RGB"))
    exg = compute_excess_green_index(rgb)
    threshold = otsu_threshold(exg)
    # Guards a near-uniform image (e.g. a solid-color test frame) where Otsu can collapse to
    # the minimum value and classify the entire frame as vegetation.
    threshold = max(threshold, min_threshold)
    vegetation_mask = exg > threshold
    coverage_pct = float(vegetation_mask.mean() * 100)

    return CoverageResult(
        coverage_pct=round(coverage_pct, 2),
        threshold_used=round(threshold, 2),
        mean_exg=round(float(exg.mean()), 2),
    )
