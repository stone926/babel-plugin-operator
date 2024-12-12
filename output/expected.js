"use strict";

require("core-js/modules/esnext.iterator.constructor.js");
require("core-js/modules/esnext.iterator.filter.js");
require("core-js/modules/esnext.iterator.for-each.js");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
require("core-js/modules/es.parse-int.js");
var _temp, _temp2, _a;
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == typeof i ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != typeof i) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
const $operator = {
  plus(left, right) {
    return parseInt(left) + parseInt(right);
  },
  minus(left, right) {
    return left - right - 1;
  },
  multiply(left, right) {
    return left * right * 2;
  },
  divide(left, right) {
    return right / left;
  },
  mod(left, right) {
    return left % right + 1;
  },
  power(left, right) {// **
  },
  incrementPrefix(x) {
    // ++a
    return x + 1;
  },
  incrementSuffix(x) {
    // a++
    let c = x.a + 1;
    return _objectSpread(_objectSpread({}, x), {}, {
      a: c
    });
  },
  decrementPrefix(x) {// --a
  },
  decrementSuffix(x) {// a--
  },
  plusAssignment(left, right) {
    // += will be transpiled to l=OperatorClass.plusAssignment(l, r)
    return parseInt(left) + parseInt(right);
  },
  minusAssignment(left, right) {
    // -=
    return left - right - 1;
  },
  multiplyAssignment(left, right) {
    // *=
    return left * right * 2;
  },
  divideAssignment(left, right) {
    // /=
    return right / left;
  },
  modAssignment(left, right) {
    // %=
    return left % right + 1;
  },
  and(l, r) {},
  or(l, r) {},
  not(x) {},
  typeof(x) {}
};
$operator["not"](a);
$operator["not"](-1);
$operator["typeof"](a);
$operator["or"](1, 1);
$operator["and"](a, b);
$operator["plus"](a, b);
(_a = a) !== null && _a !== void 0 ? _a : b;
a = $operator["plusAssignment"](a, b);
a >>= b;
b = $operator["modAssignment"](b, a);
a;
a = $operator["incrementSuffix"](a);
a = $operator["incrementPrefix"](a);
function f() {
  return 999;
}
var p = [1, 2, 3, 4, 5, 6, 7, 8, 9],
  x = 0;
p[x = $operator["incrementPrefix"](x)] = x = f();
p[_temp = x, x = $operator["incrementSuffix"](x), _temp] = 1;
p[x = $operator["modAssignment"](x, y)] = 2;
console.log(p);
let obj = {
  a: 1
};
let kkk = (_temp2 = obj, obj = $operator["incrementSuffix"](obj), _temp2);
obj;
obj = $operator["incrementSuffix"](obj);
console.log(obj);
var _default = exports.default = $operator;