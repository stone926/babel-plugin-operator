'use strict';

var path = require('node:path');
var fs = require('node:fs');
var parser = require('@babel/parser');
var traverse = require('@babel/traverse');
var syntaxTypeScript = require('@babel/plugin-syntax-typescript');
var t = require('@babel/types');

function _interopNamespaceDefault(e) {
  var n = Object.create(null);
  if (e) {
    Object.keys(e).forEach(function (k) {
      if (k !== 'default') {
        var d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: function () { return e[k]; }
        });
      }
    });
  }
  n.default = e;
  return Object.freeze(n);
}

var t__namespace = /*#__PURE__*/_interopNamespaceDefault(t);

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
  return t__namespace.isObjectMethod(node) || (
    t__namespace.isObjectProperty(node) && (t__namespace.isFunctionExpression(node.value) || t__namespace.isArrowFunctionExpression(node.value))
  )
};

const isArrayOverloader = (node) => {
  return t__namespace.isObjectProperty(node) && t__namespace.isArrayExpression(node.value);
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
    t__namespace.assertObjectExpression(path.node.declarations[0].init);
    path.node.declarations[0].init.properties.forEach(item => {
      if (isFunctionOverloader(item)) {
        registerOperator(outer.registeredOperators, item.key.name);
      }
    });
  }
};

const buildType = (functionNode, index = -1) => {
  const typeAnnotated = {};
  const anyTypeAnnotation = t__namespace.tsAnyKeyword();
  if (functionNode.params.length == 2) {
    typeAnnotated.left = functionNode.params[0].typeAnnotation?.typeAnnotation ?? anyTypeAnnotation;
    typeAnnotated.right = functionNode.params[1].typeAnnotation?.typeAnnotation ?? anyTypeAnnotation;
  } else if (functionNode.params.length == 1) {
    typeAnnotated.argument = functionNode.params[0].typeAnnotation.typeAnnotation;
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
        const functionNode = t__namespace.isObjectMethod(item) ? item : item.value;
        name.types.push(buildType(functionNode));
      } else if (isArrayOverloader(item)) {
        item.value.elements.forEach((functionNode, index) => {
          t__namespace.assertFunction(functionNode);
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
  if (t__namespace.isIdentifier(node)) {
    const binding = scope.getBinding(node.name);
    return binding?.identifier.typeAnnotation?.typeAnnotation;
  } else if (t__namespace.isStringLiteral(node) || t__namespace.isTemplateLiteral(node)) {
    return t__namespace.tsStringKeyword();
  } else if (t__namespace.isNumericLiteral(node)) {
    return t__namespace.tsNumberKeyword();
  } else if (t__namespace.isNullLiteral(node)) {
    return t__namespace.tsNullKeyword();
  } else if (t__namespace.isBooleanLiteral(node)) {
    return t__namespace.tsBooleanKeyword();
  } else if (t__namespace.isRegExpLiteral(node)) {
    return t__namespace.tsTypeReference(t__namespace.identifier("RegExp"));
  } else if (t__namespace.isBigIntLiteral(node)) {
    return t__namespace.tsBigIntKeyword();
  } else if (t__namespace.isDecimalLiteral(node)) { // !! what's this?
    return t__namespace.tsNumberKeyword();
  } else if (t__namespace.isUnaryExpression(node)) {
    return node.operator === '-' && t__namespace.isNumericLiteral(node.argument) ? t__namespace.tsNumberKeyword() : undefined;
  }
};

const fromLiteral = (literal) => {
  if (typeof literal === "number" || literal instanceof Number) {
    return t__namespace.numericLiteral(Number(literal));
  } else if (typeof literal === "string" || literal instanceof String) {
    return t__namespace.stringLiteral(String(literal));
  } else if (typeof literal === "boolean" || literal instanceof Boolean) {
    return t__namespace.booleanLiteral(Boolean(literal));
  } else if (literal === undefined) {
    return t__namespace.identifier("undefined");
  } else if (literal === null) {
    return t__namespace.nullLiteral();
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
    return build(t__namespace.assignmentExpression(
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
    obj = t__namespace.identifier(String(obj));
  }
  return new Proxy((...args) => build(t__namespace.callExpression(obj, args.map(item =>
    t__namespace.isExpression(item) ? item : fromLiteral(item)
  ))), {
    get(target, prop) {
      if (prop === kRaw) {
        return obj;
      } else if (isAssignmentOperator(prop)) {
        return buildAssignment(obj, prop);
      } else if (typeof prop === "symbol") {
        throw new TypeError("please build Symbol by function call");
      } else {
        return build(t__namespace.memberExpression(obj, t__namespace.stringLiteral(prop), true));
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
                });
                if (allSameType) {
                  if (type.index == -1) {
                    replacer = replacement(build(operatorObjName)[operator], path);
                  } else {
                    replacer = replacement(build(operatorObjName)[operator][index], path);
                  }
                }
              });
            } else {
              replacer = replacement(build(operatorObjName)[operator], path);
            }
            if (replacer) path.replaceWith(replacer[build.raw] ?? replacer);
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
        path$1.traverse({
          "BinaryExpression|LogicalExpression": visitorFactory((builded, { node: { left, right } }) =>
            builded(left, right),
            ["left", "right"]
          ),
          AssignmentExpression: visitorFactory((builded, { node: { left, right } }) => t.parenthesizedExpression(
            build(left)['='](builded(left, right))[build.raw]
          ), ["left", "right"]),
          UpdateExpression: visitorFactory((builded, path) =>
            path.node.prefix ?
              t.parenthesizedExpression(
                build(path.node.argument)['='](builded(path.node.argument))[build.raw]
              ) :
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

module.exports = index;
