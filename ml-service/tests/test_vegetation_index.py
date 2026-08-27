from PIL import Image

from app.services.vegetation_index import compute_excess_green_index, estimate_vegetation_coverage


def test_solid_green_image_has_high_coverage():
    image = Image.new("RGB", (100, 100), color=(40, 200, 40))
    result = estimate_vegetation_coverage(image)
    assert result.coverage_pct > 90


def test_solid_gray_image_has_low_coverage():
    image = Image.new("RGB", (100, 100), color=(128, 128, 128))
    result = estimate_vegetation_coverage(image)
    assert result.coverage_pct < 10


def test_solid_soil_brown_image_has_low_coverage():
    # Saddle-brown soil: green is clearly below the red/blue midpoint, so ExG = 2G - R - B
    # goes negative. (A lighter tan like (194,178,128) is a known ExG edge case - green is
    # still close enough to red there that the index leans positive; that's a real, documented
    # limitation of the plain Excess Green Index on yellowish soils, not something to hide.)
    image = Image.new("RGB", (100, 100), color=(139, 90, 43))
    result = estimate_vegetation_coverage(image)
    assert result.coverage_pct < 10


def test_half_green_half_gray_is_roughly_half_coverage():
    image = Image.new("RGB", (100, 100), color=(128, 128, 128))
    pixels = image.load()
    for x in range(50):
        for y in range(100):
            pixels[x, y] = (40, 200, 40)

    result = estimate_vegetation_coverage(image)
    assert 35 < result.coverage_pct < 65


def test_excess_green_index_is_positive_for_green_and_negative_for_red():
    import numpy as np

    green_pixel = np.array([[[0, 255, 0]]])
    red_pixel = np.array([[[255, 0, 0]]])
    assert compute_excess_green_index(green_pixel)[0, 0] > 0
    assert compute_excess_green_index(red_pixel)[0, 0] < 0
