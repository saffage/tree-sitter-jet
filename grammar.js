/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

/**
 * @param {RuleOrLiteral} rule
 * @param {RuleOrLiteral} separator
 */
function list_of(rule, separator) {
  return seq(rule, repeat(seq(separator, rule)), optional(separator));
}

export default grammar({
  name: "jet",
  extras: $ => [/\s/, $.doc_comment, $.comment],
  rules: {
    source_file: $ => list_of($.statement, $.statement_separator),

    /*
     * Newline can be used as statement separator but to reduce token spamming
     * we match multiple newlines.
     */
    newline: $ => /(\r?\n)+/,

    doc_comment: _ => prec(2, seq("##", /.*/)),
    comment: _ => choice(prec(1, seq("#", /.*/)), prec(3, seq("###", /.*/))),

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
          field("return_type", optional($.type)),
          field("body", optional($.block)),
        ),
      ),

    type_definition: $ =>
      seq("type", $.upper, optional($.type_params), optional($.type_body)),
    type_params: $ => seq("(", list_of($.lower, ","), ")"),
    type_body: $ =>
      seq(
        "{",
        list_of(
          choice($.type_field, $.type_constructor),
          $.statement_separator,
        ),
        "}",
      ),
    type_field: $ => seq($.lower, $.type),
    type_constructor: $ =>
      seq($.upper, seq("(", list_of($.type_constructor_value, ","), ")")),
    type_constructor_value: $ => seq(optional($.label), $.type),

    label: $ => seq($.lower, ":"),

    expression: $ => $.lower,

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
    constructor_pattern: $ => $.upper,
    list_pattern: $ =>
      seq(
        "[",
        optional(
          seq(
            $.list_item_pattern,
            repeat(seq(",", $.list_item_pattern)),
            optional(","),
          ),
        ),
        "]",
      ),
    list_item_pattern: $ =>
      choice(seq("..", optional($.binding_pattern)), $.pattern),

    block: $ => seq("{", $.expression, "}"),

    lower: _ => /[a-z][a-zA-Z0-9_]*/,
    upper: _ => /[A-Z][a-zA-Z0-9_]*/,
    discard: _ => /_[a-zA-Z0-9_]*/,
  },
});
