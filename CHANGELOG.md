1.1.0
  1. add elementary ts support. Only identifiers whose types are explicitly declared and literals(including string literal, numeric literal, boolean literal, regexp literal, null literal, and bigint literal. Negative numbers like -1 is considered numeric literal though it is actually an unary expression) will be overloaded, because babel have no type check.
  2. bug fix: unary expressions cannot be overloaded
1.1.1
  1. enable jsx syntax