import * as t from "@babel/types";

export default (replacement) => (path) => {
  const operatorObjectParent = path.findParent((parentPath) =>
    t.isVariableDeclaration(parentPath) && operatorObjName == parentPath.node.declarations?.[0].id.name
  );
  if (operatorObjectParent) return;
  const operator = outer.registeredOperators.get(path.node.operator + (path.node.prefix ?? ""));
  if (operator) {
    path.replaceWith(replacement(operator, path));
  }
}