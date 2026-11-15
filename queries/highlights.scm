(comment) @comment
(doc_comment) @comment.doc

;
; Imports
;
(import package: (lower) @namespace)
(import module: (lower) @namespace)
(import function_or_constant: (lower) @constant)
(import constructor: (upper) @constructor)
(import type: (upper) @type)

;
; Definitions
;
(function_definition name: (lower) @function.definition)
(type_definition name: (upper) @type.definition)
(type_field name: (lower) @property)
(type_constructor name: (upper) @constructor)

;
; Patterns
;
(binding_pattern) @variable.definition
(constructor_pattern name: (upper) @constructor)

;
; Literals
;
(int) @constant
(float) @constant
(string "\"" @string (_)* "\"" @string)
(raw_string) @string
(raw_string_escape) @string.escape
(string_segment) @string
(escape_sequence) @string.escape
(string_fmt_escape) @string.escape

;
; Expressions
;
(call (primary (lower) @function))
(call (primary (upper) @constructor))
; (primary (lower) @variable)
(primary (upper) @constructor)
(member_access (_) "." (lower) @property)

;
; Common
;
(type_variable) @type.parameter
(named_type) @type
(label ":") @label
[
  "fn"
  "type"
  "let"
  "val"
  "var"
  "as"
  "when"
  "if"
  "else"
  "import"
] @keyword
[
    ","
    ".."
    "->"
    "="
    "|"
] @punctuation
[
    "||"
    "&&"
    "=="
    "!="
    "<"
    "<="
    ">"
    ">="
    "+"
    "-"
    "*"
    "/"
    "%"
] @operator
[
    "{"
    "}"
    "["
    "]"
    "("
    ")"
] @punctuation.bracket
