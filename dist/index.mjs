import path from 'node:path';
import fs from 'node:fs';
import parser from '@babel/parser';
import traverse from '@babel/traverse';
import syntaxTypeScript from '@babel/plugin-syntax-typescript';
import * as t from '@babel/types';

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

const isFunctionOverloader = (node) => {
  return t.isObjectMethod(node) || (
    t.isObjectProperty(node) && (t.isFunctionExpression(node.value) || t.isArrowFunctionExpression(node.value))
  )
};

const isArrayOverloader = (node) => {
  return t.isObjectProperty(node) && t.isArrayExpression(node.value);
};

const registerOperator = (registry, name) => {
  const primitiveName = name.toString();
  if (Object.keys(m).includes(primitiveName)) {
    if (primitiveName !== "incrementSuffix" &&
      primitiveName !== "incrementPrefix" &&
      primitiveName !== "decrementSuffix" &&
      primitiveName !== "decrementPrefix"
    ) {
      registry.set(m[primitiveName], name);
    } else {
      let s = m[primitiveName];
      if (primitiveName == "incrementSuffix" || primitiveName == "decrementSuffix") {
        s += "false";
      } else {
        s += "true";
      }
      registry.set(s, name);
    }
  }
};

const jsVariableDeclarationVisitor = (outer) => (path) => {
  const name = path.node.declarations[0].id.name;
  if (name === outer.operatorObjectName) {
    t.assertObjectExpression(path.node.declarations[0].init);
    path.node.declarations[0].init.properties.forEach(item => {
      if (isFunctionOverloader(item)) {
        // console.log(item.key.name);
        registerOperator(outer.registeredOperators, item.key.name);
      }
    });
  }
};

const buildType = (functionNode, index=-1) => {
  const typeAnnotated = {};
  const anyTypeAnnotation = t.tsAnyKeyword();
  if (functionNode.params.length == 2) {
    typeAnnotated.left = functionNode.params[0].typeAnnotation?.typeAnnotation ?? anyTypeAnnotation;
    typeAnnotated.right = functionNode.params[1].typeAnnotation?.typeAnnotation ?? anyTypeAnnotation;
    // console.log(typeAnnotated.left, typeAnnotated.right);
  } else if (functionNode.params.length == 1) {
    typeAnnotated.unary = functionNode.params[0].typeAnnotation.typeAnnotation;
    // console.log(typeAnnotated.unary)
  } else {
    throw path.buildCodeFrameError("Invalid Params Count");
  }
  typeAnnotated.return = functionNode.returnType?.typeAnnotation ?? anyTypeAnnotation;
  typeAnnotated.index = index;
  return typeAnnotated;
};

const tsVariableDeclarationVisitor = (outer) => (path) => {
  const name = path.node.declarations?.[0].id.name;
  if (name === outer.operatorObjectName) {
    path.node.declarations?.[0].init.properties.forEach(item => {
      const name = new String(item.key.name);
      name.types = [];
      if (isFunctionOverloader(item)) {
        const functionNode = t.isObjectMethod(item) ? item : item.value;
        name.types.push(buildType(functionNode));
      } else if (isArrayOverloader(item)) {
        item.value.elements.forEach((functionNode, index) => {
          t.assertFunction(functionNode);
          name.types.push(buildType(functionNode, index));
        });
      }
      registerOperator(outer.registeredOperators, name);
    });
  }
};

const isTs = (filename) => {
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
};

var getVarVisitor = (outer) => {
  return outer.isTs ? tsVariableDeclarationVisitor(outer) : jsVariableDeclarationVisitor(outer);
};

const isSameType = (typeAnnotation1, typeAnnotation2) => {
  // console.log(typeAnnotation1, "vs", typeAnnotation2, "\n");
  if (typeAnnotation1?.type === typeAnnotation2?.type) {
    if (typeAnnotation1.type === "TSTypeReference") {
      return typeAnnotation1.typeName.name === typeAnnotation2.typeName.name
    } else {
      return true;
    }
  } else return false;
};

// 只支持identifier+identifier或literal+literal，并且类型显式声明，因为babel没有类型检查
const getType = (node, scope, err) => {
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
};

function index ({ types: t }) {
  return {
    pre(state) {
      // key: 运算符; value: MethodName
      this.registeredOperators = new Map();
      this.operatorObjectName = state.opts.operatorObjectName ?? "$operator";
      this.encoding = state.opts.encoding ?? "utf8";
      this.isTs = false;
    },
    visitor: {
      Program(path$1, state) {
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
        };

        // 若import了$operator，获取$operator所在文件的路径并存储
        path$1.traverse({
          ImportDeclaration(path$1) {
            for (let i = 0; i < (path$1.node.specifiers.length ?? 0); i++) {
              let specifier = path$1.node.specifiers[i];
              if (specifier.imported.name === outer.operatorObjectName) {
                let x = path$1.node.source.value;
                if (!x.endsWith(".js")) x += ".js";
                operatorFileName = path.join(state.filename, "../", x);
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
          path$1.traverse({ VariableDeclaration });
        }
        // console.log(outer.registeredOperators)
        if (!outer.isTs) {
          path$1.traverse({
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
          path$1.traverse({
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
              console.log(path.node);
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
          });
        }
      }
    },
    post(state) { },
    inherits: syntaxTypeScript.default,
  }
}

export { index as default };
