(type_definition
    "type" @context
    name: (_) @name
    (type_parameters)? @context) @item

(type_constructor
    name: (_) @name) @item

(type_constructor_value
    (label) @context
    (_) @context) @item

(type_field
    name: (_) @name) @item

(function_definition
    "fn" @context
    name: (_) @name) @item
