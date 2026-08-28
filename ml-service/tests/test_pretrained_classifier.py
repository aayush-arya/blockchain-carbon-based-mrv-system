from PIL import Image

from app.services.pretrained_classifier import ECOSYSTEM_CODES, classify_ecosystem, warm_up


def test_warm_up_loads_the_model_without_raising():
    warm_up()


def test_prediction_is_always_a_valid_ecosystem_code():
    image = Image.new("RGB", (80, 80), color=(60, 140, 70))
    result = classify_ecosystem(image)
    assert result.predicted_ecosystem in ECOSYSTEM_CODES


def test_scores_sum_to_approximately_one_and_are_bounded():
    image = Image.new("RGB", (80, 80), color=(20, 90, 160))
    result = classify_ecosystem(image)
    assert abs(sum(result.scores.values()) - 1.0) < 1e-4
    for score in result.scores.values():
        assert 0 <= score <= 1
    assert 0 <= result.confidence <= 1


def test_confidence_equals_top_scoring_class_score():
    image = Image.new("RGB", (80, 80), color=(90, 130, 60))
    result = classify_ecosystem(image)
    assert result.confidence == result.scores[result.predicted_ecosystem]
    assert result.confidence == max(result.scores.values())


def test_non_rgb_image_is_handled():
    # image.convert("RGB") is called inside classify_ecosystem - grayscale/palette images
    # should not raise, since a phone camera can hand back non-RGB modes.
    image = Image.new("L", (80, 80), color=128)
    result = classify_ecosystem(image)
    assert result.predicted_ecosystem in ECOSYSTEM_CODES
