const m = {
  plus: "+",
  minus: "-",
  multiply: "*",
  divide: "/",
  mod: "%",
  power: "**",
  negative: "-negative",
  incrementPrefix: "++",
  incrementSuffix: "++",
  decrementPrefix: "--",
  decrementSuffix: "--",
  plusAssignment: "+=",
  minusAssignment: "-=",
  multiplyAssignment: "*=",
  divideAssignment: "/=",
  modAssignment: "%=",
  powerAssignment: "**=",
  leftMoveAssignment: "<<=",
  rightMoveAssignment: ">>=",
  rightMoveUnsignedAssignment: ">>>=",
  bitAndAssignment: "&=",
  bitOrAssignment: "|=",
  andAssignment: "&&=",
  orAssignment: "||=",
  nullishCoalesceAssignment: "??=",
  equal: "==",
  equalStrict: "===",
  notEqual: "!=",
  notEqualStrict: "!==",
  greaterThanOrEqual: ">=",
  lessThanOrEqual: "<=",
  greaterThan: ">",
  lessThan: "<",
  and: "&&",
  or: "||",
  not: "!",
  bitAnd: "&",
  bitOr: "|",
  bitNot: "~",
  bitXor: "^",
  leftMove: "<<",
  rightMove: ">>",
  rightMoveUnsigned: ">>>",
  nullishCoalesce: "??",
  in: "in",
  instanceof: "instanceof",
  typeof: "typeof"
};

export const isAssignmentOperator = (str) => {
  for (let key in m) {
    if ((key.endsWith("Assignment") && m[key] === str)||(str==="=")) {
      return true;
    }
  }
  return false;
}

export default m;