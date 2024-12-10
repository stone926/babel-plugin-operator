import * as t from "@babel/types";
import { isAssignmentOperator } from "../behavior/supportedOperators.js";

export const typeKnowable = (node/* :Expression */) => {
  return t.isIdentifier(node) || t.isLiteral(node);
}

export const isSameType = (typeAnnotation1, typeAnnotation2) => {
  if (typeAnnotation1.type === typeAnnotation2.type) {
    if (typeAnnotation1.type === "TSTypeReference") {
      let t1 = typeAnnotation1.typeName;
      let t2 = typeAnnotation2.typeName;
      return t1.name === t2.name;
    } else if (typeAnnotation1.type === "TSUnionType") {
      throw new TypeError("Ambiguous type: TSUnionType is not supported");
    } else {
      return true;
    }
  } else return false;
}

// 只支持identifier+identifier或literal+literal，并且类型显式声明，因为babel没有类型检查
export const getType = (node, scope) => {
  if (t.isIdentifier(node)) {
    const binding = scope.getBinding(node.name);
    return binding?.identifier.typeAnnotation?.typeAnnotation;
  } else if (t.isStringLiteral(node) || t.isTemplateLiteral(node)) {
    return t.tsStringKeyword();
  } else if (t.isNumericLiteral(node)) {
    return t.tsNumberKeyword();
  } else if (t.isNullLiteral(node)) {
    return t.tsNullKeyword();
  } else if (t.isBooleanLiteral(node)) {
    return t.tsBooleanKeyword();
  } else if (t.isRegExpLiteral(node)) {
    return t.tsTypeReference(t.identifier("RegExp"));
  } else if (t.isBigIntLiteral(node)) {
    return t.tsBigIntKeyword();
  } else if (t.isDecimalLiteral(node)) { // !! what's this?
    return t.tsNumberKeyword();
  } else if (t.isUnaryExpression(node)) {
    return node.operator === '-' && t.isNumericLiteral(node.argument) ? t.tsNumberKeyword() : undefined;
  }
}

export const fromLiteral = (literal) => {
  if (typeof literal === "number" || literal instanceof Number) {
    return t.numericLiteral(Number(literal));
  } else if (typeof literal === "string" || literal instanceof String) {
    return t.stringLiteral(String(literal));
  } else if (typeof literal === "boolean" || literal instanceof Boolean) {
    return t.booleanLiteral(Boolean(literal));
  } else if (literal === undefined) {
    return t.identifier("undefined");
  } else if (literal === null) {
    return t.nullLiteral();
  } else if (typeof literal === "symbol" || literal instanceof Symbol) {
    return t.identifier(literal.description)
  } else {
    throw new TypeError(`cannot build literal node from an object ${literal}`);
  }
}

/**
 * @param {import("@babel/types").Expression} _obj 赋值语句左值
 * @param {string} operator 赋值运算符
 * @returns @param _right build过后的对象或literal
 */
export const buildAssignment = (obj, operator) => {
  return (_right) => {
    let right = _right;
    try {
      right = fromLiteral(right);
    } catch {
      right = right[kRaw] ?? right;
    }
    return build(t.assignmentExpression(
      operator, obj, right
    ))
  };
}


/**
 * foo.bar()["="](build("baz").goo)
 * @param {*} _obj 
 * @returns 
 */
export const build = (_obj) => {
  let obj = _obj;
  if (typeof obj === "string" || obj instanceof String) {
    obj = t.identifier(String(obj));
  }
  return new Proxy((...args) => build(t.callExpression(obj, args.map(item =>
    t.isExpression(item) ? item : fromLiteral(item)
  ))), {
    get(target, prop, receiver) {
      if (prop === kRaw) {
        return obj;
      } else if (isAssignmentOperator(prop)) {
        return buildAssignment(obj, prop);
      } else if (typeof prop === "symbol") {
        return build(t.memberExpression(obj, t.identifier(prop.description), true));
      } else {
        return build(t.memberExpression(obj, t.stringLiteral(prop), true));
      }
    }
  });
}

let kRaw = Symbol("raw");
build.raw = kRaw;