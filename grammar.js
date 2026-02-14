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

export default grammar({
  name: "jet",
  extras: $ => [/\s/, $.doc_comment, $.comment],
  inline: $ => [
    $.statements,
    $.statement,
    $.expression,
    $.pattern,
    $.string_like,
    $.statement_separator,
  ],
  rules: {
    source_file: $ => $.statements,

    /*
     * Newline can be used as statement separator but to reduce token spamming
     * we match multiple newlines.
     */
    newline: _ => /(\r?\n)+/,

    doc_comment: _ => prec(2, seq("##", /.*/)),
    comment: _ => choice(prec(1, seq("#", /.*/)), prec(3, seq("###", /.*/))),

    statements: $ => list_of($.statement, $.statement_separator),
    statement_separator: $ => choice(";", $.newline),
    statement: $ =>
      choice(
        $.constant_definition,
        $.function_definition,
        $.type_definition,
        $.expression,
      ),

    constant_definition: $ =>
      seq("let", $.pattern, "=", field("value", $.expression)),

    function_definition: $ =>
      prec.right(
        seq(
          "fn",
          repeat($.newline),
          field("name", $.lower),
          repeat($.newline),
          field("parameters", $.parameters),
          optional(field("return_type", $.type)),
          optional(field("body", $.block)),
        ),
      ),

    type_definition: $ =>
      seq(
        "type",
        repeat($.newline),
        field("name", $.upper),
        optional($.type_parameters),
        optional($.type_body),
      ),
    type_parameters: $ =>
      seq("(", maybe_list_of(field("type_parameter", $.lower), ","), ")"),
    type_body: $ =>
      seq(
        "{",
        maybe_list_of(
          choice($.type_field, $.type_constructor),
          $.statement_separator,
        ),
        "}",
      ),
    type_field: $ => seq(field("name", $.lower), $.type),
    type_constructor: $ =>
      seq(
        field("name", $.upper),
        optional(seq("(", list_of($.type_constructor_value, ","), ")")),
      ),
    type_constructor_value: $ => seq(optional($.label), $.type),

    label: $ => seq($.lower, ":"),

    expression: $ => choice($.lower, $.upper, $.string_like, $.list, $.when),

    list: $ => seq("[", maybe_list_of($.list_item, ","), "]"),
    list_item: $ => choice($.list_spread, $.expression),
    list_spread: $ => seq("..", $.expression),

    when: $ =>
      seq(
        "when",
        // repeat($.newline),
        field("subject", $.expression),
        // repeat($.newline),
        "{",
        // repeat($.newline),
        maybe_list_of($.clause, $.statement_separator),
        // repeat($.newline),
        "}",
      ),
    clause: $ =>
      seq(
        $.pattern,
        optional(
          field("guard", seq("if", field("guard_expression", $.expression))),
        ),
        repeat($.newline),
        "->",
        repeat($.newline),
        $.expression,
      ),

    type: $ => choice($.lower, seq($.upper, optional($.type_args))),
    type_args: $ =>
      seq(
        "(",
        optional(seq($.type, repeat(seq(",", $.type)), optional(","))),
        ")",
      ),

    parameters: $ =>
      seq(
        "(",
        optional(seq($.pattern, repeat(seq(",", $.pattern)), optional(","))),
        ")",
      ),

    /*
     * Patterns grammar.
     */
    pattern: $ =>
      choice(
        $.rebinding_pattern,
        $.binding_pattern,
        $.typed_binding_pattern,
        $.constructor_pattern,
        $.list_pattern,
      ),
    binding_pattern: $ => $.lower,
    rebinding_pattern: $ => seq($.pattern, "as", $.binding_pattern),
    typed_binding_pattern: $ => seq($.binding_pattern, $.type),
    constructor_pattern: $ =>
      seq(
        field("name", $.upper),
        optional(
          seq("(", maybe_list_of($.constructor_value_pattern, ","), ")"),
        ),
      ),
    constructor_value_pattern: $ => seq(optional($.label), $.pattern),
    list_pattern: $ => seq("[", maybe_list_of($.list_pattern_item, ","), "]"),
    list_pattern_item: $ => choice($.list_pattern_spead, $.pattern),
    list_pattern_spead: $ => seq("..", optional($.binding_pattern)),

    block: $ => seq("{", optional($.statements), "}"),

    string_like: $ => choice($.string_line, $.string),
    string: $ =>
      seq(
        '"',
        repeat(
          choice($.escaped_sequence, $.string_fmt_escape, $.string_fmt, /./),
        ),
        '"',
      ),
    string_line: _ => seq("\\\\", /.*/),
    string_fmt: $ => seq("{", optional($.statements), "}"),
    string_fmt_escape: _ => /\{\{|\}\}/,
    escaped_sequence: _ =>
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

    lower: _ => /[a-z][a-zA-Z0-9_]*/,
    upper: _ => /[A-Z][a-zA-Z0-9_]*/,
    discard: _ => /_[a-zA-Z0-9_]*/,
  },
});
