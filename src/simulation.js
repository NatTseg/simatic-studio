/**
 * A bounded Boolean SCL-like subset for educational scan simulation.
 * This is not a Siemens compiler, firmware emulator, or timing model.
 * Supported: bit-address output assignments, Boolean expressions, and // comments.
 */
export const SIMULATION_LIMITS = Object.freeze({
  sourceLength: 65_536,
  tokens: 16_384,
  statements: 2_048,
  nesting: 64,
  channels: 256,
  diagnostics: 32,
});

const KEYWORDS = new Set(["TRUE", "FALSE", "NOT", "AND", "XOR", "OR"]);

class ProgramError extends Error {
  constructor(message, token) {
    super(message);
    this.token = token;
  }
}

function diagnostic(message, token = { line: 1, column: 1, length: 1 }) {
  return {
    message,
    line: token.line,
    column: token.column,
    length: Math.max(1, token.length || 0),
    severity: "error",
  };
}

function tokenize(source, inputCount, outputCount) {
  const tokens = [];
  let offset = 0;
  let line = 1;
  let column = 1;

  function advance() {
    const character = source[offset++];
    if (character === "\r") {
      if (source[offset] === "\n") offset++;
      line++;
      column = 1;
    } else if (character === "\n") {
      line++;
      column = 1;
    } else {
      column++;
    }
    return character;
  }

  function add(type, start, extra = {}) {
    const token = { type, ...start, length: offset - start.offset, ...extra };
    if (tokens.length >= SIMULATION_LIMITS.tokens) {
      throw new ProgramError(
        `Program exceeds ${SIMULATION_LIMITS.tokens} tokens.`,
        token,
      );
    }
    tokens.push(token);
  }

  function address(raw, start) {
    const match = /^([IQ])(\d+)\.([0-7])$/i.exec(raw);
    if (!match) {
      add("invalid", start, {
        message:
          'Use a bit address such as "I0.0", "Q0.0", %I0.0, or %Q0.0; bit numbers must be 0–7.',
      });
      return;
    }
    const area = match[1].toUpperCase();
    const index = Number(match[2]) * 8 + Number(match[3]);
    const count = area === "I" ? inputCount : outputCount;
    const label = `${area}${Number(match[2])}.${match[3]}`;
    if (!Number.isSafeInteger(index) || index >= count) {
      const range =
        count > 0
          ? `${area}0.0–${area}${Math.floor((count - 1) / 8)}.${(count - 1) % 8}`
          : "no configured channels";
      add("invalid", start, {
        message: `Address ${label} is outside the configured ${area === "I" ? "input" : "output"} range (${range}).`,
      });
      return;
    }
    add("address", start, { area, index, label });
  }

  while (offset < source.length) {
    const character = source[offset];
    if (/\s/.test(character)) {
      advance();
      continue;
    }
    if (character === "/" && source[offset + 1] === "/") {
      while (offset < source.length && !/[\r\n]/.test(source[offset]))
        advance();
      continue;
    }

    const start = { offset, line, column };
    if (character === '"') {
      advance();
      const contentStart = offset;
      while (
        offset < source.length &&
        source[offset] !== '"' &&
        !/[\r\n]/.test(source[offset])
      )
        advance();
      const raw = source.slice(contentStart, offset);
      if (source[offset] !== '"') {
        add("invalid", start, { message: "Unterminated quoted address." });
      } else {
        advance();
        address(raw, start);
      }
    } else if (character === "%") {
      advance();
      const contentStart = offset;
      // Consume the entire absolute-address token, so %I0.0AND is rejected
      // instead of silently splitting a malformed token into an expression.
      while (offset < source.length && /[A-Za-z0-9_.]/.test(source[offset]))
        advance();
      address(source.slice(contentStart, offset), start);
    } else if (/[A-Za-z_]/.test(character)) {
      while (offset < source.length && /[A-Za-z0-9_]/.test(source[offset]))
        advance();
      const word = source.slice(start.offset, offset).toUpperCase();
      add(KEYWORDS.has(word) ? word : "identifier", start, { word });
    } else if (character === ":" && source[offset + 1] === "=") {
      advance();
      advance();
      add("assign", start);
    } else if (character === "(" || character === ")" || character === ";") {
      advance();
      add(character, start);
    } else {
      advance();
      add("invalid", start, {
        message: `Unsupported character ${JSON.stringify(character)}. Only Boolean assignments and // comments are supported.`,
      });
    }
  }
  tokens.push({ type: "eof", offset, line, column, length: 0 });
  return tokens;
}

function toPostfix(expression) {
  const instructions = [];
  const pending = [{ expression, visited: false }];
  while (pending.length) {
    const item = pending.pop();
    const node = item.expression;
    if (node.op === "literal" || node.op === "read") {
      instructions.push(node);
    } else if (item.visited) {
      instructions.push({ op: node.op });
    } else {
      pending.push({ expression: node, visited: true });
      if (node.right) pending.push({ expression: node.right, visited: false });
      pending.push({ expression: node.left, visited: false });
    }
  }
  return instructions;
}

function parse(tokens) {
  let cursor = 0;
  let depth = 0;
  const statements = [];
  const diagnostics = [];
  const current = () => tokens[cursor];

  function fail(message, token = current()) {
    if (token.type === "invalid") message = token.message;
    if (token.type === "identifier")
      message = `Unsupported instruction or symbol ${token.word}. Only Boolean I/Q bit assignments are supported.`;
    throw new ProgramError(message, token);
  }

  function consume(type, message) {
    if (current().type !== type) fail(message);
    return tokens[cursor++];
  }

  function nested(parseExpression) {
    depth++;
    if (depth > SIMULATION_LIMITS.nesting) {
      fail(`Expression nesting exceeds ${SIMULATION_LIMITS.nesting} levels.`);
    }
    try {
      return parseExpression();
    } finally {
      depth--;
    }
  }

  function primary() {
    const token = current();
    if (token.type === "TRUE" || token.type === "FALSE") {
      cursor++;
      return { op: "literal", value: token.type === "TRUE" };
    }
    if (token.type === "address") {
      cursor++;
      return { op: "read", area: token.area, index: token.index };
    }
    if (token.type === "(") {
      cursor++;
      const expression = nested(or);
      consume(")", "Expected a closing parenthesis.");
      return expression;
    }
    fail(
      "Expected TRUE, FALSE, an I/Q bit address, NOT, or a parenthesized Boolean expression.",
    );
  }

  function unary() {
    if (current().type !== "NOT") return primary();
    cursor++;
    return { op: "not", left: nested(unary) };
  }

  function binary(next, operator, operation) {
    let expression = next();
    while (current().type === operator) {
      cursor++;
      expression = { op: operation, left: expression, right: next() };
    }
    return expression;
  }

  function and() {
    return binary(unary, "AND", "and");
  }
  function xor() {
    return binary(and, "XOR", "xor");
  }
  function or() {
    return binary(xor, "OR", "or");
  }

  while (current().type !== "eof") {
    try {
      if (statements.length >= SIMULATION_LIMITS.statements) {
        fail(`Program exceeds ${SIMULATION_LIMITS.statements} assignments.`);
      }
      const target = consume(
        "address",
        "Expected an output bit address at the start of an assignment.",
      );
      if (target.area !== "Q")
        fail(
          "Only output addresses (Q) can be assigned; input addresses (I) are read-only.",
          target,
        );
      consume("assign", "Expected := after the output address.");
      const expression = or();
      consume(";", "Expected ; after the Boolean expression.");
      statements.push({
        target: target.index,
        address: target.label,
        expression: toPostfix(expression),
      });
    } catch (error) {
      if (!(error instanceof ProgramError)) throw error;
      diagnostics.push(diagnostic(error.message, error.token));
      if (diagnostics.length >= SIMULATION_LIMITS.diagnostics) break;
      while (current().type !== "eof" && current().type !== ";") cursor++;
      if (current().type === ";") cursor++;
      depth = 0;
    }
  }
  return { statements, diagnostics };
}

/**
 * Compile the supported Boolean subset without evaluating user source.
 * Empty/comment-only programs are valid and retain every output across scans.
 * Diagnostics use one-based lines and columns. Invalid programs cannot execute.
 */
export function compileProgram(
  source,
  { inputCount = 14, outputCount = 10 } = {},
) {
  const result = {
    valid: false,
    diagnostics: [],
    statements: [],
    inputCount,
    outputCount,
  };
  if (typeof source !== "string") {
    result.diagnostics.push(diagnostic("Program source must be a string."));
    return result;
  }
  for (const [name, count] of [
    ["inputCount", inputCount],
    ["outputCount", outputCount],
  ]) {
    if (
      !Number.isInteger(count) ||
      count < 0 ||
      count > SIMULATION_LIMITS.channels
    ) {
      result.diagnostics.push(
        diagnostic(
          `${name} must be an integer from 0 to ${SIMULATION_LIMITS.channels}.`,
        ),
      );
    }
  }
  if (source.length > SIMULATION_LIMITS.sourceLength) {
    result.diagnostics.push(
      diagnostic(
        `Program exceeds ${SIMULATION_LIMITS.sourceLength} characters.`,
      ),
    );
  }
  if (result.diagnostics.length) return result;

  try {
    const parsed = parse(tokenize(source, inputCount, outputCount));
    result.diagnostics = parsed.diagnostics;
    result.valid = parsed.diagnostics.length === 0;
    if (result.valid) result.statements = parsed.statements;
  } catch (error) {
    if (!(error instanceof ProgramError)) throw error;
    result.diagnostics.push(diagnostic(error.message, error.token));
  }
  return result;
}

/**
 * Execute one sequential scan. Outputs not written retain their previous state;
 * Q reads see earlier writes in this scan. Inputs and previousOutputs are untouched.
 * Missing channel values default to false. Returns a new Boolean output array.
 */
export function executeScan(compiled, inputs = [], previousOutputs = []) {
  if (!compiled?.valid || !Array.isArray(compiled.statements)) {
    throw new TypeError(
      "Cannot execute an invalid program. Compile and fix its diagnostics first.",
    );
  }
  const outputs = Array.from({ length: compiled.outputCount }, (_, index) =>
    Boolean(previousOutputs[index]),
  );
  for (const statement of compiled.statements) {
    const stack = [];
    for (const instruction of statement.expression) {
      if (instruction.op === "literal") {
        stack.push(instruction.value);
      } else if (instruction.op === "read") {
        stack.push(
          instruction.area === "I"
            ? Boolean(inputs[instruction.index])
            : outputs[instruction.index],
        );
      } else if (instruction.op === "not") {
        stack.push(!stack.pop());
      } else {
        const right = stack.pop();
        const left = stack.pop();
        if (instruction.op === "and") stack.push(left && right);
        else if (instruction.op === "xor") stack.push(left !== right);
        else if (instruction.op === "or") stack.push(left || right);
        else
          throw new TypeError(
            `Unsupported compiled operation: ${instruction.op}`,
          );
      }
    }
    outputs[statement.target] = stack[0];
  }
  return outputs;
}
