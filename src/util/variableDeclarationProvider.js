import path from "node:path";
import * as t from "@babel/types";
import supportedOperators from "../behavior/supportedOperators.js";

const isFunctionOverloader = (node) => {
  return t.isObjectMethod(node) || (
    t.isObjectProperty(node) && (t.isFunctionExpression(node.value) || t.isArrowFunctionExpression(node.value))
  )
}

const isArrayOverloader = (node) => {
  return t.isObjectProperty(node) && t.isArrayExpression(node.value);
}

const registerOperator = (registry, name) => {
  const primitiveName = name.toString();
  if (Object.keys(supportedOperators).includes(primitiveName)) {
    if (primitiveName !== "incrementSuffix" &&
      primitiveName !== "incrementPrefix" &&
      primitiveName !== "decrementSuffix" &&
      primitiveName !== "decrementPrefix"
    ) {
      registry.set(supportedOperators[primitiveName], name);
    } else {
      let s = supportedOperators[primitiveName];
      if (primitiveName == "incrementSuffix" || primitiveName == "decrementSuffix") {
        s += "false";
      } else {
        s += "true";
      }
      registry.set(s, name);
    }
  }
};

export const jsVariableDeclarationVisitor = (outer) => (path) => {
  const name = path.node.declarations[0].id.name;
  if (name === outer.operatorObjectName) {
    t.assertObjectExpression(path.node.declarations[0].init);
    path.node.declarations[0].init.properties.forEach(item => {
      if (isFunctionOverloader(item)) {
        registerOperator(outer.registeredOperators, item.key.name ?? item.key.value);
      }
    });
  }
};

const buildType = (functionNode, err, index = -1) => {
  const typeAnnotated = {}, anyTypeAnnotation = t.tsAnyKeyword();
  const paramLength = functionNode.params.length;
  if (paramLength == 2) {
    typeAnnotated.left = functionNode.params[0].typeAnnotation?.typeAnnotation ?? anyTypeAnnotation;
    typeAnnotated.right = functionNode.params[1].typeAnnotation?.typeAnnotation ?? anyTypeAnnotation;
  } else if (paramLength == 1) {
    typeAnnotated.argument = functionNode.params[0].typeAnnotation.typeAnnotation;
  } else {
    throw err(`Invalid Params Count. Expected 1 or 2, but got ${paramLength}`);
  }
  typeAnnotated.return = functionNode.returnType?.typeAnnotation ?? anyTypeAnnotation;
  typeAnnotated.index = index;
  return typeAnnotated;
}

export const tsVariableDeclarationVisitor = (outer) => (path) => {
  const name = path.node.declarations?.[0].id.name;
  if (name === outer.operatorObjectName) {
    path.node.declarations?.[0].init.properties.forEach(item => {
      const name = new String(item.key.name);
      name.types = [];
      if (isFunctionOverloader(item)) {
        const functionNode = t.isObjectMethod(item) ? item : item.value;
        name.types.push(buildType(functionNode, path.buildCodeFrameError));
      } else if (isArrayOverloader(item)) {
        item.value.elements.forEach((functionNode, index) => {
          t.assertFunction(functionNode);
          name.types.push(buildType(functionNode, path.buildCodeFrameError, index));
        });
      }
      registerOperator(outer.registeredOperators, name);
    });
  }
};

export const isTs = (filename) => {
  switch (path.extname(filename)) {
    case ".js":
    case ".mjs":
    case ".cjs":
    case ".jsx":
      return false;
    case ".ts":
    case ".mts":
    case ".cts":
    case ".tsx":
      return true;
    default: throw new Error(`unexpected file extension ${path.extname(filename)}`);
  }
}

export default (outer) => {
  return outer.isTs ? tsVariableDeclarationVisitor(outer) : jsVariableDeclarationVisitor(outer);
};