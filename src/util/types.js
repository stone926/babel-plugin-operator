import * as t from "@babel/types";

export const typeKnowable = (node/* :Expression */) => {
  return t.isIdentifier(node) || t.isLiteral(node);
}

export const isSameType = (typeAnnotation1, typeAnnotation2) => {
  // console.log(typeAnnotation1, "vs", typeAnnotation2, "\n");
  if (typeAnnotation1?.type === typeAnnotation2?.type) {
    if (typeAnnotation1.type === "TSTypeReference") {
      return typeAnnotation1.typeName.name === typeAnnotation2.typeName.name
    } else {
      return true;
    }
  } else return false;
}

// 只支持identifier+identifier或literal+literal，并且类型显式声明，因为babel没有类型检查
export const getType = (node, scope, err) => {
  if (t.isIdentifier(node)) {
    const binding = scope.getBinding(node.name);
    return binding.identifier.typeAnnotation?.typeAnnotation;
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