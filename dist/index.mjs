import nodePath from "node:path";
import fs from "node:fs";
import parser from "@babel/parser";
import traverse from "@babel/traverse";

export default function ({ types: t }) {
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
  return {
    pre(state) {
      // key: 运算符; value: MethodName
      this.registeredOperators = new Map();
      this.operatorObjectName = state.opts.operatorObjectName ?? "$operator";
      this.encoding = state.opts.encoding ?? "utf8";
    },
    visitor: {
      Program(path, state) {
        const outer = this;
        let operatorFileName = undefined, operatorObjName = this.operatorObjectName;
        const VariableDeclaration = (path) => {
          const name = path.node.declarations?.[0].id.name;
          if (name === outer.operatorObjectName) {
            path.node.declarations?.[0].init.properties.forEach(item => {
              if (t.isObjectMethod(item)) {
                const methodName = item.key.name;
                if (Object.keys(m).includes(methodName)) {
                  if (methodName !== "incrementSuffix" &&
                    methodName !== "incrementPrefix" &&
                    methodName !== "decrementSuffix" &&
                    methodName !== "decrementPrefix"
                  ) {
                    outer.registeredOperators.set(m[methodName], methodName);
                  } else {
                    let s = m[methodName];
                    if (methodName == "incrementSuffix" || methodName == "decrementSuffix") {
                      s += "false";
                    } else {
                      s += "true";
                    }
                    outer.registeredOperators.set(s, methodName);
                  }
                }
              }
            });
          }
        }
        const visitorFactory = (replacement) => (path) => {
          const operatorObjectParent = path.findParent((parentPath) =>
            t.isVariableDeclaration(parentPath) && operatorObjName == parentPath.node.declarations?.[0].id.name
          );
          if (operatorObjectParent) return;
          const operator = outer.registeredOperators.get(path.node.operator + (path.node.prefix ?? ""));
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
          traverse.default(ast, { VariableDeclaration })
        } else { // 如果没有import $operator，在当前文件中寻找并注册重载
          path.traverse({ VariableDeclaration });
        }

        // 所有重载都注册完毕，接下来替换被重载的运算
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
          }),
          UnaryExpression: visitorFactory((operator, path) => t.callExpression(
            t.memberExpression(t.identifier(operatorObjName), t.identifier(operator)),
            [path.node.argument]
          ))
        });
      }
    },
    post(state) { },
  }
}