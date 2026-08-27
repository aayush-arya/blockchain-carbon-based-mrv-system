from PIL import Image

from app.services.heuristic_classifier import ECOSYSTEM_CODES, classify_ecosystem


def test_prediction_is_always_a_valid_ecosystem_code():
    image = Image.new("RGB", (80, 80), color=(60, 140, 70))
    result = classify_ecosystem(image)
    assert result.predicted_ecosystem in ECOSYSTEM_CODES


def test_scores_sum_to_approximately_one_and_are_bounded():
    image = Image.new("RGB", (80, 80), color=(20, 90, 160))
    result = classify_ecosystem(image)
    assert abs(sum(result.scores.values()) - 1.0) < 1e-6
    for score in result.scores.values():
        assert 0 <= score <= 1
    assert 0 <= result.confidence <= 1


def test_confidence_equals_top_scoring_class_score():
    image = Image.new("RGB", (80, 80), color=(90, 130, 60))
    result = classify_ecosystem(image)
    assert result.confidence == result.scores[result.predicted_ecosystem]
    assert result.confidence == max(result.scores.values())


def test_a_strongly_blue_image_scores_seagrass_higher_than_a_strongly_green_uniform_one():
    # Directional/relative assertion rather than an exact prediction, since this is an
    # approximate heuristic, not a trained classifier.
    blue_image = Image.new("RGB", (80, 80), color=(10, 60, 160))
    green_image = Image.new("RGB", (80, 80), color=(60, 160, 40))

    blue_result = classify_ecosystem(blue_image)
    green_result = classify_ecosystem(green_image)

    assert blue_result.scores["seagrass"] > green_result.scores["seagrass"]
