from __future__ import annotations

import ast
import operator
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel


BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

app = FastAPI(title="PyCalculator API")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


class CalcRequest(BaseModel):
    expression: str


ALLOWED_BINARY_OPERATORS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
}

ALLOWED_UNARY_OPERATORS = {
    ast.UAdd: operator.pos,
    ast.USub: operator.neg,
}


def safe_eval(expression: str) -> float:
    try:
        node = ast.parse(expression, mode="eval")
    except SyntaxError as exc:
        raise ValueError("Invalid expression syntax") from exc

    def _eval(current_node: ast.AST) -> float:
        if isinstance(current_node, ast.Expression):
            return _eval(current_node.body)

        if isinstance(current_node, ast.Constant) and isinstance(current_node.value, (int, float)):
            return float(current_node.value)

        if isinstance(current_node, ast.BinOp) and type(current_node.op) in ALLOWED_BINARY_OPERATORS:
            left = _eval(current_node.left)
            right = _eval(current_node.right)
            operation = ALLOWED_BINARY_OPERATORS[type(current_node.op)]
            return float(operation(left, right))

        if isinstance(current_node, ast.UnaryOp) and type(current_node.op) in ALLOWED_UNARY_OPERATORS:
            operand = _eval(current_node.operand)
            operation = ALLOWED_UNARY_OPERATORS[type(current_node.op)]
            return float(operation(operand))

        raise ValueError("Unsupported operation")

    try:
        return _eval(node)
    except ZeroDivisionError as exc:
        raise ValueError("Division by zero is not allowed") from exc


@app.get("/")
def serve_ui() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.post("/api/calc")
def calculate(payload: CalcRequest) -> dict[str, float]:
    try:
        result = safe_eval(payload.expression)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {"result": result}