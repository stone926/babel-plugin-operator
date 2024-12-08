import nodePath from "node:path";
import fs from "node:fs";
import parser from "@babel/parser";
import traverse from "@babel/traverse";
import syntaxTypeScript from "@babel/plugin-syntax-typescript";
import getVarVisitor, { isTs } from "./util/variableDeclarationProvider.js";
import { getType, isSameType } from "./util/types.js";

export default function ({ types: t }) {
  return {
    pre(state) {
      // key: 运算符; value: MethodName
      this.registeredOperators = new Map();
      this.operatorObjectName = state.opts.operatorObjectName ?? "$operator";
      this.encoding = state.opts.encoding ?? "utf8";
      this.isTs = false;
    },
    visitor: {
      Program(path, state) {
        const outer = this;
        this.isTs = isTs(state.filename);
        let operatorFileName = undefined, operatorObjName = this.operatorObjectName;
        const VariableDeclaration = getVarVisitor(outer);
        const visitorFactory = (replacement, tail = () => "") => (path) => {
          const operatorObjectParent = path.findParent((parentPath) =>
            t.isVariableDeclaration(parentPath) && operatorObjName == parentPath.node.declarations?.[0].id.name
          );
          if (operatorObjectParent) return;
          let key = path.node.operator;
          key += tail(path);
          const operator = outer.registeredOperators.get(key);
          if (operator) {
            path.replaceWith(replacement(operator, path));
          }
        }

        // 若import了$operator，获取$operator所在文件的路径并存储
        path.traverse({
          ImportDeclaration(path) {
            for (let i = 0; i < (path.node.specifiers.length ?? 0); i++) {
              let specifier = path.node.specifiers[i];
              if (specifier.imported.name === outer.operatorObjectName) {
                let x = path.node.source.value;
                if (!x.endsWith(".js")) x += ".js"
                operatorFileName = nodePath.join(state.filename, "../", x);
                operatorObjName = specifier.local.name;
                return;
              }
            }
          }
        });

        // 如果import了$operator，读入文件并生成ast，从而注册重载
        if (operatorFileName) {
          let operatorFile = fs.readFileSync(operatorFileName, { encoding: outer.encoding });
          const ast = parser.parse(operatorFile, { sourceType: "module" });
          traverse.default(ast, { VariableDeclaration });
        } else { // 如果没有import $operator，在当前文件中寻找并注册重载
          path.traverse({ VariableDeclaration });
        }
        // console.log(outer.registeredOperators)
        if (!outer.isTs) {
          path.traverse({
            "BinaryExpression|LogicalExpression": visitorFactory((operator, path) => t.callExpression(
              t.memberExpression(t.identifier(operatorObjName), t.identifier(operator)),
              [path.node.left, path.node.right]
            )),
            AssignmentExpression: visitorFactory((operator, path) => t.parenthesizedExpression(
              t.assignmentExpression(
                "=", path.node.left, t.callExpression(
                  t.memberExpression(t.identifier(operatorObjName), t.identifier(operator)),
                  [path.node.left, path.node.right]
                )
              ), path.node.left
            )),
            UpdateExpression: visitorFactory((operator, path) => {
              if (path.node.prefix) {
                return t.parenthesizedExpression(
                  t.assignmentExpression(
                    "=", path.node.argument, t.callExpression(
                      t.memberExpression(t.identifier(operatorObjName), t.identifier(operator)),
                      [path.node.argument]
                    )
                  )
                )
              } else {
                path.replaceWith(path.node.argument);
                path.insertAfter(
                  t.expressionStatement(
                    t.assignmentExpression(
                      "=", path.node, t.callExpression(
                        t.memberExpression(t.identifier(operatorObjName), t.identifier(operator)),
                        [path.node]
                      )
                    )
                  )
                );
                return path.node;
              }
            }, (path) => path.node.prefix),
            UnaryExpression: visitorFactory((operator, path) => t.callExpression(
              t.memberExpression(t.identifier(operatorObjName), t.identifier(operator)),
              [path.node.argument]
            ), (path) => path.node.operator === '-' ? "negative" : "")
          });
        } else {
          let f = true;
          path.traverse({
            "BinaryExpression|LogicalExpression": visitorFactory((operator, path) => {
              let R = path.node;
              const leftType = getType(path.node.left, path.scope, path.buildCodeFrameError);
              const rightType = getType(path.node.right, path.scope, path.buildCodeFrameError);
              operator.types.forEach((type, index) => {
                if (isSameType(leftType, type.left) && isSameType(rightType, type.right)) {
                  if (type.index == -1) {
                    R = t.callExpression(
                      t.memberExpression(t.identifier(operatorObjName), t.identifier(operator.toString())),
                      [path.node.left, path.node.right]
                    );
                  } else {
                    R = t.callExpression(
                      t.memberExpression(
                        t.memberExpression(
                          t.identifier(operatorObjName), t.identifier(operator.toString())
                        ), t.numericLiteral(index), true
                      ), [path.node.left, path.node.right]
                    );
                  }
                }
              });
              return R;
            }),
            AssignmentExpression: visitorFactory((operator, path) => {
              let R = path.node;
              const leftType = getType(path.node.left, path.scope, path.buildCodeFrameError);
              const rightType = getType(path.node.right, path.scope, path.buildCodeFrameError);
              operator.types.forEach((type, index) => {
                if (isSameType(leftType, type.left) && isSameType(rightType, type.right)) {
                  if (type.index == -1) {
                    R = t.parenthesizedExpression(
                      t.assignmentExpression(
                        "=", path.node.left, t.callExpression(
                          t.memberExpression(t.identifier(operatorObjName), t.identifier(operator.toString())),
                          [path.node.left, path.node.right]
                        )
                      ), path.node.left
                    );
                  } else {
                    R = t.parenthesizedExpression(
                      t.assignmentExpression(
                        "=", path.node.left,
                        t.callExpression(
                          t.memberExpression(
                            t.memberExpression(
                              t.identifier(operatorObjName),
                              t.identifier(operator.toString())
                            ), t.numericLiteral(index), true
                          ), [path.node.left, path.node.right]
                        )
                      ), path.node.left
                    );
                  }
                }
              });
              return R;
            }),
            UpdateExpression: visitorFactory((operator, path) => {
              let R = path.node;
              const unaryType = getType(path.node.argument, path.scope, path.buildCodeFrameError);
              operator.types.forEach((type, index) => {
                if (isSameType(unaryType, type.unary)) {
                  if (type.index == -1) {
                    if (path.node.prefix) {
                      R = t.parenthesizedExpression(
                        t.assignmentExpression(
                          "=", path.node.argument, t.callExpression(
                            t.memberExpression(t.identifier(operatorObjName), t.identifier(operator.toString())),
                            [path.node.argument]
                          )
                        )
                      );
                    } else {
                      path.replaceWith(path.node.argument);
                      path.insertAfter(
                        t.expressionStatement(
                          t.assignmentExpression(
                            "=", path.node, t.callExpression(
                              t.memberExpression(t.identifier(operatorObjName), t.identifier(operator.toString())),
                              [path.node]
                            )
                          )
                        )
                      );
                      R = path.node;
                    }
                  } else {
                    if (path.node.prefix) {
                      R = t.parenthesizedExpression(
                        t.assignmentExpression(
                          "=", path.node.argument, t.callExpression(
                            t.memberExpression(
                              t.memberExpression(
                                t.identifier(operatorObjName), t.identifier(operator.toString())
                              ), t.numericLiteral(index), true
                            ), [path.node.argument]
                          )
                        )
                      );
                    } else {
                      // console.log(path.node.argument)
                      path.replaceWith(path.node.argument);
                      path.insertAfter(
                        t.expressionStatement(
                          t.assignmentExpression(
                            "=", path.node, t.callExpression(
                              t.memberExpression(t.memberExpression(
                                t.identifier(operatorObjName),
                                t.identifier(operator.toString())
                              ), t.numericLiteral(index), true),
                              [path.node]
                            )
                          )
                        )
                      );
                      R = path.node;
                    }
                  }
                }
              });
              return R;
            }, (path) => path.node.prefix),
            UnaryExpression: visitorFactory((operator, path) => {
              let R = path.node;
              const unaryType = getType(path.node.argument, path.scope, path.buildCodeFrameError);
              console.log(path.node)
              operator.types.forEach((type, index) => {
                if (isSameType(unaryType, type.unary)) {
                  if (type.index == -1) {
                    R = t.callExpression(
                      t.memberExpression(t.identifier(operatorObjName), t.identifier(operator.toString())),
                      [path.node.argument]
                    );
                  } else {
                    R = t.callExpression(
                      t.memberExpression(t.memberExpression(
                        t.identifier(operatorObjName), t.identifier(operator.toString())),
                        t.numericLiteral(index), true
                      ), [path.node.argument]
                    );
                  }
                }
              });
              return R;
            }, (path) => path.node.operator === '-' ? "negative" : "")
          })
        }
      }
    },
    post(state) { },
    inherits: syntaxTypeScript.default,
  }
}