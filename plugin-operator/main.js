module.exports = function ({ types: t }) {
  const m = {
    plus: "+",
    minus: "-",
    multiply: "*",
    divide: "/",
    mod: "%",
    power: "**",
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
  const isOriginal = (node, originalMark) => {
    let b = false;
    node.trailingComments?.forEach(comment => {
      b = (comment.value === originalMark);
      if (b) comment.value = "";
    });
    // t.removeComments(node);
    return b;
  };
  return {
    pre(state) {
      // key: 运算符; value: MethodName
      this.registeredOperators = new Map();
      // value: the names of operate class
      this.operatorObjectName = state.opts.operatorObjectName ?? "$operator";
      this.originalMark = state.opts.originalMark ?? "__original__";
    },
    visitor: {
      Program(path, state) {
        const operatorObjectName = this.operatorObjectName;
        const originalMark = this.originalMark;
        const registeredOperators = this.registeredOperators;
        path.traverse({
          VariableDeclaration(path) {
            const that = this;
            const name = path.node.declarations?.[0].id.name;
            if (name === this.operatorObjectName) {
              if (path.node.kind !== "const") {
                path.buildCodeFrameError("The operator object must be a constant!");
                return;
              }
              path.node.declarations?.[0].init.properties.forEach(item => {
                if (t.isObjectMethod(item)) {
                  const methodName = item.key.name;
                  if (Object.keys(m).includes(methodName)) {
                    if (methodName !== "incrementSuffix" &&
                      methodName !== "incrementPrefix" &&
                      methodName !== "decrementSuffix" &&
                      methodName !== "decrementPrefix"
                    ) {
                      that.registeredOperators.set(m[methodName], methodName);
                    } else {
                      let s = m[methodName];
                      if (methodName == "incrementSuffix" || methodName == "decrementSuffix") {
                        s += "false";
                      } else {
                        s += "true";
                      }
                      that.registeredOperators.set(s, methodName);
                    }
                  }
                }
              });
            }
          },
          "BinaryExpression|LogicalExpression"(path) {
            const that = this;
            const operatorObjectParent = path.findParent((parentPath) =>
              t.isVariableDeclaration(parentPath) && that.operatorObjectName == parentPath.node.declarations?.[0].id.name
            );
            if (operatorObjectParent) return;
            const operator = this.registeredOperators.get(path.node.operator);
            if (operator) {
              path.replaceWith(
                t.callExpression(
                  t.memberExpression(
                    t.identifier(this.operatorObjectName),
                    t.identifier(operator)
                  ),
                  [path.node.left, path.node.right]
                )
              );
            }
          },
          AssignmentExpression(path) {
            const that = this;
            const operatorObjectParent = path.findParent((parentPath) =>
              t.isVariableDeclaration(parentPath) && that.operatorObjectName == parentPath.node.declarations?.[0].id.name
            );
            if (operatorObjectParent) return;
            const operator = this.registeredOperators.get(path.node.operator);
            if (operator) {
              path.replaceWith(
                t.parenthesizedExpression(
                  t.assignmentExpression(
                    "=",
                    path.node.left,
                    t.callExpression(
                      t.memberExpression(
                        t.identifier(this.operatorObjectName),
                        t.identifier(operator)
                      ),
                      [path.node.left, path.node.right]
                    )
                  ),
                  path.node.left
                )
              );
            }
          },
          UpdateExpression(path) {
            const that = this;
            const operatorObjectParent = path.findParent((parentPath) =>
              t.isVariableDeclaration(parentPath) && that.operatorObjectName == parentPath.node.declarations?.[0].id.name
            );
            if (operatorObjectParent) return;
            const operator = this.registeredOperators.get(path.node.operator + path.node.prefix);
            if (operator) {
              if (path.node.prefix) {
                path.replaceWith(
                  t.parenthesizedExpression(
                    t.assignmentExpression(
                      "=",
                      path.node.argument,
                      t.callExpression(
                        t.memberExpression(
                          t.identifier(this.operatorObjectName),
                          t.identifier(operator)
                        ),
                        [path.node.argument]
                      )
                    )
                  )
                );
              } else {
                path.replaceWith(path.node.argument);
                path.insertAfter(
                  t.expressionStatement(
                    t.assignmentExpression(
                      "=",
                      path.node,
                      t.callExpression(
                        t.memberExpression(
                          t.identifier(this.operatorObjectName),
                          t.identifier(operator)
                        ),
                        [path.node]
                      )
                    )
                  )
                );
              }
            }
          },
          UnaryExpression(path) {
            const that = this;
            const operatorObjectParent = path.findParent((parentPath) =>
              t.isVariableDeclaration(parentPath) && that.operatorObjectName == parentPath.node.declarations?.[0].id.name
            );
            if (operatorObjectParent) return;
            const operator = this.registeredOperators.get(path.node.operator);
            if (operator) {
              path.replaceWith(
                t.callExpression(
                  t.memberExpression(
                    t.identifier(this.operatorObjectName),
                    t.identifier(operator)
                  ),
                  [path.node.argument]
                )
              );
            }
          }
        }, { operatorObjectName, originalMark, registeredOperators });
      }
    },
    post(state) { },
  }
}