import nodePath from "node:path";
import fs from "node:fs";
import parser from "@babel/parser";
import traverse from "@babel/traverse";
import syntaxTypeScript from "@babel/plugin-syntax-typescript";
import getVarVisitor, { isTs } from "./util/variableDeclarationProvider.js";
import { getType, isSameType, build } from "./util/types.js";

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
        const visitorFactory = (replacement, typeKeys, tail = () => "") => (path) => {
          const operatorObjectParent = path.findParent((parentPath) =>
            t.isVariableDeclaration(parentPath) && operatorObjName == parentPath.node.declarations?.[0].id.name
          );
          if (operatorObjectParent) return;
          let key = path.node.operator;
          key += tail(path);
          const operator = outer.registeredOperators.get(key);
          if (operator) {
            let replacer;
            if (outer.isTs) {
              const types = operator.types;
              types.forEach((type, index) => {
                let allSameType = true;
                typeKeys.forEach((typeKey) => {
                  allSameType = allSameType && isSameType(getType(path.node[typeKey], path.scope), type[typeKey]);
                })
                if (allSameType) {
                  if (type.index == -1) {
                    replacer = replacement(build(operatorObjName)[operator], path);
                  } else {
                    replacer = replacement(build(operatorObjName)[operator][index], path);
                  }
                }
              })
            } else {
              replacer = replacement(build(operatorObjName)[operator], path);
            }
            if (replacer) path.replaceWith(replacer[build.raw] ?? replacer);
          }
        };

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
        path.traverse({
          "BinaryExpression|LogicalExpression": visitorFactory((builded, { node: { left, right } }) =>
            builded(left, right),
            ["left", "right"]
          ),
          AssignmentExpression: visitorFactory((builded, { node: { left, right } }) =>
            build(left)['='](builded(left, right))[build.raw],
            ["left", "right"]
          ),
          UpdateExpression: visitorFactory((builded, path) =>
            path.node.prefix ?
              build(path.node.argument)['='](builded(path.node.argument))[build.raw] :
              void (
                path.replaceWith(path.node.argument),
                path.insertAfter(build(path.node)['='](builded(path.node))[build.raw])
              ), ["argument"], (path) => path.node.prefix
          ),
          UnaryExpression: visitorFactory(
            (builded, { node: { argument } }) => builded(argument),
            ["argument"], (path) => path.node.operator === '-' ? "negative" : ""
          )
        });
      }
    },
    post(state) { },
    inherits: syntaxTypeScript.default,
  }
}