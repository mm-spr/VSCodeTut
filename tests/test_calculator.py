import unittest

from fastapi.testclient import TestClient

from PyCalculator.calculator import app, safe_eval


class SafeEvalTests(unittest.TestCase):
    def test_evaluates_operator_precedence(self):
        self.assertEqual(safe_eval("2 + 3 * 4"), 14.0)

    def test_evaluates_parentheses(self):
        self.assertEqual(safe_eval("(9 + 3) * 2 / 4"), 6.0)

    def test_evaluates_unary_minus(self):
        self.assertEqual(safe_eval("-5 + 8"), 3.0)

    def test_rejects_invalid_syntax(self):
        with self.assertRaisesRegex(ValueError, "Invalid expression syntax"):
            safe_eval("2 +")

    def test_rejects_unsupported_operation(self):
        with self.assertRaisesRegex(ValueError, "Unsupported operation"):
            safe_eval("abs(-3)")

    def test_rejects_division_by_zero(self):
        with self.assertRaisesRegex(ValueError, "Division by zero is not allowed"):
            safe_eval("5 / 0")


class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_calc_endpoint_returns_json_result(self):
        response = self.client.post("/api/calc", json={"expression": "7 * (8 + 1)"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"result": 63.0})

    def test_calc_endpoint_returns_validation_error_for_invalid_expression(self):
        response = self.client.post("/api/calc", json={"expression": "7 / 0"})

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"detail": "Division by zero is not allowed"})

    def test_root_serves_html(self):
        response = self.client.get("/")

        self.assertEqual(response.status_code, 200)
        self.assertIn("text/html", response.headers["content-type"])


if __name__ == "__main__":
    unittest.main()