const expressionDisplay = document.getElementById("expression");
const resultDisplay = document.getElementById("result");
const statusDisplay = document.getElementById("status");
const memoryIndicator = document.getElementById("memory-indicator");
const keypad = document.querySelector(".keypad");
const memoryKeys = document.querySelector(".memory-keys");

let expression = "";
let justEvaluated = false;
let memoryValue = null;

function isOperator(value) {
  return ["+", "-", "*", "/"].includes(value);
}

function formatExpression(value) {
  if (!value) {
    return "0";
  }

  return value
    .replace(/\*/g, "×")
    .replace(/\//g, "÷")
    .replace(/-/g, "−");
}

function formatResult(value) {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return String(Number.parseFloat(value.toFixed(10)));
}

function setStatus(message, isError = false) {
  statusDisplay.textContent = message;
  statusDisplay.classList.toggle("error", isError);
}

function updateMemoryIndicator() {
  memoryIndicator.classList.toggle("active", memoryValue !== null);
}

function getCurrentEntryStart(value) {
  let depth = 0;
  let index = value.length - 1;

  while (index >= 0) {
    const current = value[index];

    if (current === ")") {
      depth += 1;
      index -= 1;
      continue;
    }

    if (current === "(") {
      if (depth > 0) {
        depth -= 1;
        index -= 1;
        continue;
      }
      break;
    }

    if (depth === 0 && isOperator(current)) {
      if (current === "-" && (index === 0 || isOperator(value[index - 1]) || value[index - 1] === "(")) {
        index -= 1;
        continue;
      }
      break;
    }

    index -= 1;
  }

  return index + 1;
}

function getCurrentEntry(value) {
  return value.slice(getCurrentEntryStart(value));
}

function findLastTopLevelOperatorIndex(value) {
  let depth = 0;

  for (let index = value.length - 1; index >= 0; index -= 1) {
    const current = value[index];

    if (current === ")") {
      depth += 1;
      continue;
    }

    if (current === "(") {
      depth -= 1;
      continue;
    }

    if (depth === 0 && isOperator(current)) {
      if (current === "-" && (index === 0 || isOperator(value[index - 1]) || value[index - 1] === "(")) {
        continue;
      }
      return index;
    }
  }

  return -1;
}

function getOpenParenCount() {
  return (expression.match(/\(/g) || []).length;
}

function getCloseParenCount() {
  return (expression.match(/\)/g) || []).length;
}

function updateDisplay(resultText = null) {
  expressionDisplay.textContent = formatExpression(expression);

  if (resultText !== null) {
    resultDisplay.textContent = resultText;
    return;
  }

  if (!expression) {
    resultDisplay.textContent = "0";
    return;
  }

  resultDisplay.textContent = formatExpression(getCurrentEntry(expression) || expression);
}

async function requestCalculation(value) {
  const response = await fetch("/api/calc", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expression: value }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.detail || "Request failed");
  }

  return payload.result;
}

function appendNumber(value) {
  if (justEvaluated) {
    expression = value === "." ? "0." : value;
    justEvaluated = false;
    return;
  }

  if (expression.endsWith(")")) {
    return;
  }

  if (value === ".") {
    const currentEntry = getCurrentEntry(expression);
    if (currentEntry.includes(".")) {
      return;
    }

    expression += currentEntry ? "." : "0.";
    return;
  }

  if (expression === "0") {
    expression = value;
    return;
  }

  expression += value;
}

function appendOperator(value) {
  if (!expression) {
    if (value === "-") {
      expression = "-";
    }
    return;
  }

  justEvaluated = false;

  if (expression.endsWith("(")) {
    if (value === "-") {
      expression += value;
    }
    return;
  }

  if (isOperator(expression.at(-1))) {
    expression = expression.slice(0, -1) + value;
    return;
  }

  expression += value;
}

function appendParenthesis(value) {
  if (value === "(") {
    if (justEvaluated) {
      expression = "";
      justEvaluated = false;
    }

    if (!expression || isOperator(expression.at(-1)) || expression.endsWith("(")) {
      expression += value;
    }
    return;
  }

  if (getOpenParenCount() > getCloseParenCount() && expression && !isOperator(expression.at(-1)) && !expression.endsWith("(")) {
    expression += value;
  }
}

function clearEntry() {
  if (!expression) {
    return;
  }

  const start = getCurrentEntryStart(expression);
  expression = expression.slice(0, start);
}

function toggleSign() {
  if (!expression) {
    expression = "-";
    return;
  }

  const start = getCurrentEntryStart(expression);
  const entry = expression.slice(start);
  if (!entry) {
    return;
  }

  const before = expression.slice(0, start);
  if (before.endsWith("-") && (before.length === 1 || isOperator(before.at(-2)) || before.at(-2) === "(")) {
    expression = before.slice(0, -1) + entry;
    return;
  }

  if (!before || isOperator(before.at(-1)) || before.endsWith("(")) {
    expression = `${before}-${entry}`;
    return;
  }

  expression = `${before}*(-${entry})`;
}

function getDisplayNumericValue() {
  const normalized = resultDisplay.textContent
    .replace(/−/g, "-")
    .replace(/×/g, "*")
    .replace(/÷/g, "/");
  const value = Number.parseFloat(normalized);
  if (Number.isNaN(value)) {
    throw new Error("No numeric value available");
  }
  return value;
}

function injectValue(value) {
  const text = formatResult(value);

  if (justEvaluated || !expression) {
    expression = text;
    justEvaluated = false;
    updateDisplay(text);
    return;
  }

  const start = getCurrentEntryStart(expression);
  const prefix = expression.slice(0, start);
  expression = `${prefix}${text}`;
  justEvaluated = false;
  updateDisplay(text);
}

async function applyPercent() {
  if (!expression) {
    return;
  }

  const start = getCurrentEntryStart(expression);
  const currentEntry = expression.slice(start);
  if (!currentEntry || isOperator(currentEntry.at(-1)) || currentEntry === "(") {
    return;
  }

  const before = expression.slice(0, start);
  const operatorIndex = findLastTopLevelOperatorIndex(before);
  const currentValue = await requestCalculation(currentEntry);

  let percentValue = currentValue / 100;
  if (operatorIndex !== -1) {
    const baseExpression = before.slice(0, operatorIndex);
    if (baseExpression) {
      const baseValue = await requestCalculation(baseExpression);
      percentValue = (baseValue * currentValue) / 100;
    }
  }

  const formatted = formatResult(percentValue);
  expression = `${before}${formatted}`;
  justEvaluated = false;
  updateDisplay(formatted);
}

function memoryStore() {
  memoryValue = getDisplayNumericValue();
  updateMemoryIndicator();
  setStatus("Stored in memory");
}

function memoryRecall() {
  if (memoryValue === null) {
    setStatus("Memory is empty", true);
    return;
  }

  injectValue(memoryValue);
  setStatus("Memory recalled");
}

function memoryClear() {
  memoryValue = null;
  updateMemoryIndicator();
  setStatus("Memory cleared");
}

function memoryAdd() {
  const amount = getDisplayNumericValue();
  memoryValue = (memoryValue ?? 0) + amount;
  updateMemoryIndicator();
  setStatus("Added to memory");
}

function memorySubtract() {
  const amount = getDisplayNumericValue();
  memoryValue = (memoryValue ?? 0) - amount;
  updateMemoryIndicator();
  setStatus("Subtracted from memory");
}

async function calculate() {
  if (!expression || isOperator(expression.at(-1)) || getOpenParenCount() !== getCloseParenCount()) {
    setStatus("Complete the expression first.", true);
    return;
  }

  setStatus("Calculating...");
  const result = await requestCalculation(expression);
  const formatted = formatResult(result);
  expression = formatted;
  justEvaluated = true;
  updateDisplay(formatted);
  setStatus("Ready");
}

async function handleAction(button) {
  const { action, value } = button.dataset;

  try {
    if (value) {
      if (isOperator(value)) {
        appendOperator(value);
      } else if (value === "(" || value === ")") {
        appendParenthesis(value);
      } else {
        appendNumber(value);
      }
      updateDisplay();
      setStatus("Ready");
      return;
    }

    if (action === "clear-all") {
      expression = "";
      justEvaluated = false;
      updateDisplay("0");
      setStatus("Ready");
      return;
    }

    if (action === "clear-entry") {
      clearEntry();
      updateDisplay();
      setStatus("Ready");
      return;
    }

    if (action === "backspace") {
      expression = expression.slice(0, -1);
      justEvaluated = false;
      updateDisplay();
      setStatus("Ready");
      return;
    }

    if (action === "percent") {
      await applyPercent();
      setStatus("Ready");
      return;
    }

    if (action === "toggle-sign") {
      toggleSign();
      updateDisplay();
      setStatus("Ready");
      return;
    }

    if (action === "equals") {
      await calculate();
      return;
    }

    if (action === "memory-store") {
      memoryStore();
      return;
    }

    if (action === "memory-recall") {
      memoryRecall();
      return;
    }

    if (action === "memory-clear") {
      memoryClear();
      return;
    }

    if (action === "memory-add") {
      memoryAdd();
      return;
    }

    if (action === "memory-subtract") {
      memorySubtract();
    }
  } catch (error) {
    resultDisplay.textContent = "0";
    setStatus(error.message, true);
    justEvaluated = false;
  }
}

keypad.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) {
    return;
  }

  await handleAction(button);
});

memoryKeys.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) {
    return;
  }

  await handleAction(button);
});

window.addEventListener("keydown", async (event) => {
  const key = event.key;

  if (/^[0-9]$/.test(key) || key === ".") {
    event.preventDefault();
    await handleAction({ dataset: { value: key } });
    return;
  }

  if (["+", "-", "*", "/"].includes(key)) {
    event.preventDefault();
    await handleAction({ dataset: { value: key } });
    return;
  }

  if (key === "(" || key === ")") {
    event.preventDefault();
    await handleAction({ dataset: { value: key } });
    return;
  }

  if (key === "%") {
    event.preventDefault();
    await handleAction({ dataset: { action: "percent" } });
    return;
  }

  if (key === "Enter" || key === "=") {
    event.preventDefault();
    await handleAction({ dataset: { action: "equals" } });
    return;
  }

  if (key === "Backspace") {
    event.preventDefault();
    await handleAction({ dataset: { action: "backspace" } });
    return;
  }

  if (key === "Escape" || key.toLowerCase() === "c") {
    event.preventDefault();
    await handleAction({ dataset: { action: "clear-all" } });
  }
});

updateDisplay("0");
updateMemoryIndicator();