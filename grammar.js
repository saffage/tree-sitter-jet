/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

/**
 * @param {RuleOrLiteral} rule
 * @param {RuleOrLiteral} separator
 */
function list_of(rule, separator) {
  return seq(rule, repeat(seq(separator, rule)), optional(separator));
}

/**
 * @param {RuleOrLiteral} rule
 * @param {RuleOrLiteral} separator
 */
function maybe_list_of(rule, separator) {
  return optional(list_of(rule, separator));
}

/**
 * @param {function(string | number, RuleOrLiteral): PrecLeftRule | PrecRightRule} assoc
 * @param {number} precedence
 * @param {RegExp | RustRegex | string} operator
 * @param {RuleOrLiteral} left
 * @param {RuleOrLiteral | null} right
 */
function binary(assoc, precedence, operator, left, right = null) {
  return assoc(
    precedence,
    seq(
      field("left", left),
      field("operator", operator),
      field("right", right || left),
    ),
  );
}

const LOWER = /[a-z][a-zA-Z0-9_]*/;
const UPPER = /[A-Z][a-zA-Z0-9_]*/;
const DISCARD = /_[a-zA-Z0-9_]*/;

export default grammar({
  name: "jet",
  extras: $ => [/\s/, $.doc_comment, $.comment],
  rules: {
    source_file: $ => maybe_list_of($._statement, $._statement_separator),

    /*
     * Common rules.
     */
    label: _ => seq(LOWER, ":"),
    _type: $ => choice($.type_variable, $.named_type, $.fn_type),
    type_variable: _ => LOWER,
    named_type: $ =>
      prec.left(
        seq(
          field("name", UPPER),
          optional(
            seq("(", maybe_list_of(field("type_argument", $._type), ","), ")"),
          ),
        ),
      ),
    fn_type: $ =>
      seq(
        "fn",
        repeat($._newline),
        seq(
          "(",
          maybe_list_of(
            field("parameter", seq(optional($.label), $._type)),
            ",",
          ),
          ")",
        ),
        optional(field("return_type", $._type)),
      ),

    // Match multiple newlines to reduce token spamming.
    _newline: _ => /(\r?\n)+/,

    doc_comment: _ => prec(2, seq("##", /.*/)),
    comment: _ => choice(prec(1, seq("#", /.*/)), prec(3, seq("###", /.*/))),

    _statements: $ => list_of($._statement, $._statement_separator),
    _statement_separator: $ => choice(/;\n?/, $._newline),
    _statement: $ =>
      choice(
        $.import,
        $.constant_definition,
        $.value_definition,
        $.function_definition,
        $.type_alias,
        $.type_definition,
        $._expression,
      ),

    import: $ =>
      seq(
        "import",
        field("package", $.lower),
        repeat(seq(".", field("module", $.lower))),
        optional(
          seq(
            "{",
            maybe_list_of(
              choice(
                field("function_or_constant", $.lower),
                field("constructor", $.upper),
                field("type", seq("type", $.upper)),
              ),
              ",",
            ),
            "}",
          ),
        ),
      ),

    constant_definition: $ =>
      seq(
        "let",
        repeat($._newline),
        $._pattern_for_definition,
        repeat($._newline),
        "=",
        repeat($._newline),
        field("value", $._expression),
      ),

    value_definition: $ =>
      prec.left(
        seq(
          choice("val", "var"),
          repeat($._newline),
          $._pattern_for_definition,
          repeat($._newline),
          optional(seq("=", repeat($._newline), field("value", $._expression))),
        ),
      ),

    function_definition: $ =>
      prec.right(
        seq(
          "fn",
          repeat($._newline),
          field("name", $.lower),
          repeat($._newline),
          $.parameters,
          optional(field("return_type", $._type)),
          optional(field("body", $.block)),
        ),
      ),

    type_alias: $ =>
      seq(
        "type",
        repeat($._newline),
        field("name", $.upper),
        "=",
        repeat($._newline),
        $._type,
      ),
    type_definition: $ =>
      seq(
        "type",
        repeat($._newline),
        field("name", $.upper),
        optional($.type_parameters),
        optional($.type_body),
      ),
    type_parameters: $ =>
      seq(
        "(",
        maybe_list_of(field("type_parameter", $.type_variable), ","),
        ")",
      ),
    type_body: $ =>
      seq(
        "{",
        maybe_list_of(
          choice($.type_field, $.type_constructor),
          $._statement_separator,
        ),
        "}",
      ),
    type_field: $ => seq(field("name", $.lower), $._type),
    type_constructor: $ =>
      seq(
        field("name", $.upper),
        optional(seq("(", list_of($.type_constructor_value, ","), ")")),
      ),
    type_constructor_value: $ => seq(optional($.label), $._type),

    _expression: $ => choice($._binary_expression, $.primary),
    _unary: $ => seq(repeat(choice("+", "-", "!")), $.primary),
    _binary_expression: $ =>
      choice(
        binary(prec.left, 1, "||", $._expression),
        binary(prec.left, 2, "&&", $._expression),
        binary(prec.left, 3, "==", $._expression),
        binary(prec.left, 3, "!=", $._expression),
        binary(prec.left, 4, "<", $._expression),
        binary(prec.left, 4, "<=", $._expression),
        binary(prec.left, 4, ">", $._expression),
        binary(prec.left, 4, ">=", $._expression),
        binary(prec.left, 6, "+", $._expression),
        binary(prec.left, 6, "-", $._expression),
        binary(prec.left, 7, "*", $._expression),
        binary(prec.left, 7, "/", $._expression),
        binary(prec.left, 7, "%", $._expression),
      ),
    primary: $ =>
      choice(
        $._number,
        $._identifier,
        $._string,
        $.block,
        $.list,
        $.when,
        $.if_else,
        $.lambda,
        $.call,
        $.member_access,
      ),

    block: $ => seq("{", optional($._statements), "}"),
    list: $ => seq("[", maybe_list_of($.list_item, ","), "]"),
    list_item: $ => choice($.list_spread, $._expression),
    list_spread: $ => seq("..", $._expression),

    call: $ => seq($._expression, "(", maybe_list_of($.argument, ","), ")"),
    argument: $ => seq(optional($.label), $._expression),

    member_access: $ =>
      seq($._member_access_operand, ".", field("member", $.lower)),
    _member_access_operand: $ =>
      choice($._identifier, $.block, $.when, $.call, $.member_access),

    when: $ =>
      seq(
        "when",
        repeat($._newline),
        field("subject", $._expression),
        repeat($._newline),
        "{",
        maybe_list_of($.clause, $._statement_separator),
        "}",
      ),
    clause: $ =>
      seq(
        $._pattern_alternatives,
        optional(
          field("guard", seq("if", field("guard_expression", $._expression))),
        ),
        repeat($._newline),
        "->",
        repeat($._newline),
        field("body", $._expression),
      ),

    lambda: $ =>
      prec.right(
        seq(
          "fn",
          repeat($._newline),
          $.parameters,
          optional(field("return_type", $._type)),
          optional(field("body", $.block)),
        ),
      ),
    parameters: $ =>
      seq(
        "(",
        optional(
          seq(
            $._pattern_for_definition,
            repeat(seq(",", $._pattern_for_definition)),
            optional(","),
          ),
        ),
        ")",
      ),

    if_else: $ =>
      seq(
        "if",
        field("condition", $._expression),
        field("then_block", $.block),
        optional(seq("else", choice($.if_else, field("else_block", $.block)))),
      ),

    // Same as pattern but 'as' and alternatives are not allowed.
    _pattern_for_definition: $ =>
      choice(
        $.binding_pattern,
        $.typed_binding_pattern,
        $.constructor_pattern,
        $.list_pattern,
      ),

    _pattern: $ => choice($.rebinding_pattern, $._pattern_unit),
    _pattern_unit: $ =>
      choice(
        $.binding_pattern,
        $.typed_binding_pattern,
        $.constructor_pattern,
        $.list_pattern,
        $.string,
        $.float,
        $.int,
      ),

    rebinding_pattern: $ =>
      prec.right(
        seq(
          field("pattern", $._pattern_unit),
          "as",
          field("alias", $.binding_pattern),
        ),
      ),

    _pattern_alternatives: $ =>
      seq($._pattern, repeat(seq("|", field("alternative", $._pattern)))),

    // Choice fixes an ambiguity with labeled values as the label itself
    // is a LOWER.
    binding_pattern: _ => choice(LOWER, DISCARD),
    typed_binding_pattern: $ => seq($.binding_pattern, $._type),
    constructor_pattern: $ =>
      seq(
        field("name", $.upper),
        optional(
          seq("(", maybe_list_of($.constructor_value_pattern, ","), ")"),
        ),
      ),
    constructor_value_pattern: $ =>
      seq(optional($.label), $._pattern_alternatives),
    list_pattern: $ => seq("[", maybe_list_of($.list_pattern_item, ","), "]"),
    list_pattern_item: $ =>
      choice($.list_pattern_spead, $._pattern_alternatives),
    list_pattern_spead: $ => seq("..", optional($.binding_pattern)),

    _identifier: $ => choice($.lower, $.upper, $.discard),
    lower: _ => /[a-z][a-zA-Z0-9_]*/,
    upper: _ => /[A-Z][a-zA-Z0-9_]*/,
    discard: _ => /_[a-zA-Z0-9_]*/,

    _string: $ => choice($.raw_string, $.string),
    raw_string: $ =>
      seq(
        "`",
        repeat(choice($.raw_string_escape, $.raw_string_char)),
        token.immediate("`"),
      ),
    raw_string_escape: _ => token.immediate("``"),
    raw_string_char: _ => token.immediate(/[^`]/),
    string: $ =>
      seq(
        '"',
        repeat(
          choice(
            $.escape_sequence,
            $.string_fmt_escape,
            $.string_fmt,
            $.string_segment,
          ),
        ),
        '"',
      ),
    string_fmt: $ => seq("{", optional($._statements), "}"),
    string_fmt_escape: _ => /\{\{|\}\}/,
    string_segment: _ => /[^"{\\]+/,
    escape_sequence: _ =>
      seq(
        "\\",
        choice(
          // Common escape sequences.
          /[nrt'\"\\]/,

          // ASCII\byte escape.
          /x(_?[a-fA-F0-9]){2}/,

          // Unicode codepoint.
          /u\{[a-fA-F0-9]{1,6}\}/,
        ),
      ),

    _number: $ => choice($.float, $.int),
    float: $ =>
      seq(
        optional("-"),
        $._decimal,
        ".",
        optional($._decimal),
        optional(seq(/[eE][+-]?/, $._decimal)),
      ),
    int: $ =>
      seq(optional("-"), choice($._hex, $._decimal, $._octal, $._binary)),
    // NOTE: compiler disallows [0X, 0B, 0O] but we don't.
    _hex: _ => /0[xX][0-9a-fA-F][_0-9a-fA-F]*/,
    _octal: _ => /0[oO][0-7][_0-7]*/,
    _binary: _ => /0[bB][0-1][_0-1]*/,
    _decimal: _ => /[0-9][0-9_]*/,
  },
});
