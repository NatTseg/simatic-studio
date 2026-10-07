import test from "node:test";
import assert from "node:assert/strict";
import {
  compileProgram,
  executeScan,
  SIMULATION_LIMITS,
} from "../src/simulation.js";

function compile(source, options) {
  const compiled = compileProgram(source, options);
  assert.equal(compiled.valid, true, JSON.stringify(compiled.diagnostics));
  return compiled;
}

function scan(source, inputs = [], previousOutputs = [], options) {
  return executeScan(compile(source, options), inputs, previousOutputs);
}

test("assignments are sequential, Q reads see current writes, and the final write wins", () => {
  const outputs = scan(
    '"Q0.0" := TRUE; "Q0.1" := "Q0.0"; "Q0.0" := FALSE; "Q0.2" := "Q0.0";',
  );
  assert.deepEqual(outputs.slice(0, 3), [false, true, false]);
});

test("unassigned outputs retain prior state and a Q feedback latch persists across scans", () => {
  const compiled = compile("%Q0.0 := (%I0.0 OR %Q0.0) AND NOT %I0.1;");
  const initial = Array(10).fill(false);
  initial[9] = true;
  const set = executeScan(compiled, [true, false], initial);
  const latched = executeScan(compiled, [false, false], set);
  const reset = executeScan(compiled, [false, true], latched);
  assert.equal(set[0], true);
  assert.equal(latched[0], true);
  assert.equal(reset[0], false);
  assert.equal(reset[9], true);
  assert.deepEqual(scan("// No output writes", [], initial), initial);
});

test("NOT > AND > XOR > OR precedence and nested parentheses are respected", () => {
  const outputs = scan(`
    "Q0.0" := TRUE OR TRUE XOR TRUE;
    "Q0.1" := TRUE XOR TRUE AND FALSE;
    "Q0.2" := NOT TRUE AND FALSE;
    "Q0.3" := NOT (TRUE AND (FALSE OR NOT (FALSE XOR TRUE)));
    "Q0.4" := TRUE XOR TRUE XOR TRUE;
    "Q0.5" := (TRUE OR TRUE) XOR TRUE;
  `);
  assert.deepEqual(outputs.slice(0, 6), [true, true, false, true, true, false]);
});

test("lexer supports adjacent punctuation and quoted operands without requiring whitespace", () => {
  const source = '"Q0.0":=NOT("I0.0"AND NOT"I0.1")OR"I0.2";"Q0.1":=not false;';
  assert.deepEqual(scan(source, [true, false, false]).slice(0, 2), [
    false,
    true,
  ]);
  for (const malformed of [
    '"Q0.0":=TRUE ANDNOT FALSE;',
    "%Q0.0:=%I0.0AND%I0.1;",
    '"Q0.0":=TRUEFALSE;',
  ]) {
    assert.equal(compileProgram(malformed).valid, false, malformed);
  }
});

test("statements span lines, multiple statements share a line, and trailing comments are ignored", () => {
  const outputs = scan(
    '// setup\r\n"Q0.0"\n:=\nTRUE\n; "Q0.1" := FALSE; // end\r\n%Q1.1 := // rhs follows\n %I1.5; // eof',
    Array(14).fill(true),
  );
  assert.equal(outputs[0], true);
  assert.equal(outputs[1], false);
  assert.equal(outputs[9], true);
  assert.equal(compileProgram(" \n // comment only").valid, true);
  assert.equal(compileProgram("").valid, true);
});

test("all configured bit channels work, including addresses in the second byte", () => {
  const outputs = scan(
    '%Q1.0 := %I1.4; "Q1.1" := "I1.5";',
    Array(14).fill(true),
  );
  assert.deepEqual(outputs.slice(8), [true, true]);
  const resized = scan("%Q1.7 := %I2.0;", Array(17).fill(true), [], {
    inputCount: 17,
    outputCount: 16,
  });
  assert.equal(resized.length, 16);
  assert.equal(resized[15], true);
});

test("invalid addresses, unsupported instructions, and malformed statements are rejected explicitly", () => {
  const malformed = [
    '"Q1.2" := TRUE;',
    '"Q0.0" := "I1.6";',
    '"Q0.8" := TRUE;',
    "%Q0.0 := %I0.8;",
    "%Q0.0 := %IX0.0;",
    '"Q0.0" := "M0.0";',
    '"I0.0" := TRUE;',
    'IF TRUE THEN "Q0.0" := TRUE; END_IF;',
    '"Q0.0" := TON();',
    '"Q0.0" = TRUE;',
    '"Q0.0" := TRUE',
    '"Q0.0" := TRUE FALSE;',
    '"Q0.0" := (TRUE;',
    '"Q0.0" := ;',
    '"Q0.0" := 1;',
    '"Q0.0" := TRUE; alert(1);',
    '/* comment */ "Q0.0" := TRUE;',
  ];
  for (const source of malformed) {
    const compiled = compileProgram(source);
    assert.equal(compiled.valid, false, source);
    assert.equal(
      compiled.statements.length,
      0,
      "Invalid programs must never partially execute",
    );
    assert.ok(compiled.diagnostics.length > 0, source);
    assert.ok(
      compiled.diagnostics.every(
        (item) => item.message && item.line >= 1 && item.column >= 1,
      ),
      source,
    );
    assert.throws(() => executeScan(compiled, []), /invalid program/i);
  }
});

test("diagnostics point to exact one-based lines and columns, including CRLF and inline comments", () => {
  const compiled = compileProgram(
    '// first\r\n  "Q0.0" := TRUE; // valid\r\n    "Q1.2" := FALSE;',
  );
  assert.equal(compiled.valid, false);
  assert.equal(compiled.diagnostics[0].line, 3);
  assert.equal(compiled.diagnostics[0].column, 5);
  assert.match(compiled.diagnostics[0].message, /outside.*output range/);
  const missingOperand = compileProgram('\n"Q0.0" := TRUE AND ;');
  assert.equal(missingOperand.diagnostics[0].line, 2);
  assert.equal(missingOperand.diagnostics[0].column, 20);
});

test("scan returns independent Boolean outputs and never mutates input or previous-output arrays", () => {
  const inputs = Object.freeze([true, false]);
  const previousOutputs = Object.freeze([false, true, true]);
  const compiled = compile('"Q0.0" := "I0.0";');
  const outputs = executeScan(compiled, inputs, previousOutputs);
  assert.notEqual(outputs, previousOutputs);
  assert.equal(outputs.length, 10);
  assert.deepEqual(outputs.slice(0, 4), [true, true, true, false]);
  assert.ok(outputs.every((value) => typeof value === "boolean"));
  outputs[0] = false;
  assert.deepEqual(inputs, [true, false]);
  assert.deepEqual(previousOutputs, [false, true, true]);
  assert.equal(executeScan(compiled, inputs, previousOutputs)[0], true);
});

test("bounded parsing rejects excessive input and recursion without stack overflow", () => {
  assert.equal(
    compileProgram(" ".repeat(SIMULATION_LIMITS.sourceLength + 1)).valid,
    false,
  );
  assert.equal(
    compileProgram(
      '"Q0.0" := ' + "NOT ".repeat(SIMULATION_LIMITS.nesting + 1) + "TRUE;",
    ).valid,
    false,
  );
  assert.equal(
    compileProgram(
      '"Q0.0" := ' +
        "(".repeat(SIMULATION_LIMITS.nesting + 1) +
        "TRUE" +
        ")".repeat(SIMULATION_LIMITS.nesting + 1) +
        ";",
    ).valid,
    false,
  );
  const flatExpression =
    '"Q0.0" := ' + Array(6_000).fill("FALSE").join(" OR ") + ";";
  assert.equal(
    scan(flatExpression)[0],
    false,
    "Flat Boolean chains must evaluate without recursive stack growth",
  );
  assert.equal(
    compileProgram('"Q0.0":=TRUE;'.repeat(SIMULATION_LIMITS.statements + 1))
      .valid,
    false,
  );
  assert.equal(
    compileProgram('"Q0.0":=TRUE;', { outputCount: 0 }).valid,
    false,
  );
  assert.equal(compileProgram("", { inputCount: -1 }).valid, false);
  assert.equal(compileProgram("", { outputCount: 1.5 }).valid, false);
});
