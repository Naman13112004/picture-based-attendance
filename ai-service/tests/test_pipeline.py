import pytest
import numpy as np
from pipeline.matcher import build_class_matrix, match_student_vectorized


def test_build_class_matrix():
    embeddings = [np.array([1.0, 0.0]), np.array([0.0, 1.0])]
    matrix = build_class_matrix(embeddings)
    assert matrix.shape == (2, 2)
    assert np.allclose(matrix[0], [1.0, 0.0])


def test_match_student_vectorized():
    class_matrix = np.array([[1.0, 0.0], [0.0, 1.0]])
    student_emb = [[0.99, 0.01]]

    # Should match first class vector
    result = match_student_vectorized(student_emb, class_matrix, threshold=0.1)
    assert result is True

    # Should not match
    student_emb2 = [[0.5, 0.5]]
    result2 = match_student_vectorized(student_emb2, class_matrix, threshold=0.9)
    assert result2 is False
