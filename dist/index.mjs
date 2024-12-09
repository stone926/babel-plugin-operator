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

const isAssignmentOperator = (str) => {
  for (let key in m) {
    if ((key.endsWith("Assignment") && m[key] === str)||(str==="=")) {
      return true;
    }
  }
  return false;
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
  if (typeAnnotation1?.type === typeAnnotation2?.type) {
    if (typeAnnotation1.type === "TSTypeReference") {
      let t1 = typeAnnotation1.typeName;
      let t2 = typeAnnotation2.typeName;
      return t1.name === t2.name;
    } else {
      return true;
    }
  } else return false;
};

// 只支持identifier+identifier或literal+literal，并且类型显式声明，因为babel没有类型检查
const getType = (node, scope) => {
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
};

const fromLiteral = (literal) => {
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
  } else {
    throw new TypeError(`cannot build literal node from an object ${literal}`);
  }
};

/**
 * @param {import("@babel/types").Expression} _obj 赋值语句左值
 * @param {string} operator 赋值运算符
 * @returns @param _right build过后的对象或literal
 */
const buildAssignment = (obj, operator) => {
  return (_right) => {
    // let right = t.isExpression(_right)?_right:fromLiteral(_right);
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
};


/**
 * foo.bar()["="](baz.goo)
 * @param {*} _obj 
 * @returns 
 */
const build = (_obj) => {
  let obj = _obj;
  if (typeof obj === "string" || obj instanceof String) {
    obj = t.identifier(String(obj));
  }
  return new Proxy((...args) => build(t.callExpression(obj, args.map(item =>
    t.isExpression(item) ? item : fromLiteral(item)
  ))), {
    get(target, prop) {
      if (prop === kRaw) {
        return obj;
      } else if (isAssignmentOperator(prop)) {
        return buildAssignment(obj, prop);
      } else if (typeof prop === "symbol") {
        throw new TypeError("please build Symbol by function call");
      } else {
        return build(t.memberExpression(obj, t.stringLiteral(prop), true));
      }
    }
  });
};

let kRaw = Symbol("raw");
build.raw = kRaw;

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
            const replacer = replacement(build(operatorObjName)[operator], path);
            if (replacer) path.replaceWith(replacer[build.raw] ?? replacer);
          }
        };
        const visitorFactoryTs = (replacement, typeKeys, tail = () => "") => (path) => {
          const operatorObjectParent = path.findParent((parentPath) =>
            t.isVariableDeclaration(parentPath) && operatorObjName == parentPath.node.declarations?.[0].id.name
          );
          if (operatorObjectParent) return;
          let key = path.node.operator;
          key += tail(path);
          const operator = outer.registeredOperators.get(key);
          if (operator) {
            const types = operator.types;
            types.forEach((type, index) => {
              let allSameType = true;
              typeKeys.forEach((typeKey) => {
                allSameType = allSameType && isSameType(getType(path.node[typeKey], path.scope), type[typeKey]);
              });
              if (allSameType) {
                let replacer;
                if (type.index == -1) {
                  replacer = replacement(build(operatorObjName)[operator], path);
                } else {
                  replacer = replacement(build(operatorObjName)[operator][index], path);
                }
                if (replacer) path.replaceWith(replacer[build.raw] ?? replacer);
              }
            });
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
        if (!outer.isTs) {
          path$1.traverse({
            "BinaryExpression|LogicalExpression": visitorFactory((builded, { node: { left, right } }) =>
              builded(left, right)
            ),
            AssignmentExpression: visitorFactory((builded, { node: { left, right } }) => t.parenthesizedExpression(
              build(left)['='](builded(left, right))[build.raw]
            )),
            UpdateExpression: visitorFactory((builded, path) => {
              if (path.node.prefix) {
                return t.parenthesizedExpression(
                  build(path.node.argument)['='](builded(path.node.argument))[build.raw]
                )
              } else {
                path.replaceWith(path.node.argument);
                path.insertAfter(build(path.node)['='](builded(path.node))[build.raw]);
              }
            }, (path) => path.node.prefix),
            UnaryExpression: visitorFactory(
              (builded, { node: { argument } }) => builded(argument),
              (path) => path.node.operator === '-' ? "negative" : ""
            )
          });
        } else {
          path$1.traverse({
            "BinaryExpression|LogicalExpression": visitorFactoryTs((builded, { node: { left, right } }) =>
              builded(left, right),
              ["left", "right"]
            ),
            AssignmentExpression: visitorFactoryTs((builded, { node: { left, right } }) =>
              build(left)['='](builded(left, right))[build.raw],
              ["left", "right"]
            ),
            UpdateExpression: visitorFactoryTs((builded, path) => {
              if (path.node.prefix) {
                return t.parenthesizedExpression(
                  build(path.node.argument)['='](builded(path.node.argument))[build.raw]
                );
              } else {
                path.replaceWith(path.node.argument);
                path.insertAfter(
                  build(path.node)['='](builded(path.node))[build.raw]
                );
              }
            }, ["unary"], (path) => path.node.prefix),
            UnaryExpression: visitorFactoryTs((builded, { node: { argument } }) =>
              builded(argument),
              ["unary"], (path) => path.node.operator === '-' ? "negative" : ""
            )
          });
        }
      }
    },
    post(state) { },
    inherits: syntaxTypeScript.default,
  }
}

export { index as default };
