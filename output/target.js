"use strict";

require("core-js/modules/es.regexp.constructor.js");
require("core-js/modules/es.regexp.exec.js");
require("core-js/modules/es.regexp.to-string.js");
type Matrix = {
  [index: number]: number[];
  rowCount?: number;
  columnCount?: number;
};
interface BinaryOperatorFunction<Left, Right, Return> {
  (left: Left, right: Right): Return;
}
interface UnaryOperatorFunction<Arg, Return> {
  (x: Arg): Return;
}
type OperatorFunction = BinaryOperatorFunction<unknown, unknown, unknown> | UnaryOperatorFunction<unknown, unknown>;
interface OperatorFunctionsArray {
  [index: number]: OperatorFunction;
}
interface OperatorObject {
  [propName: string]: OperatorFunctionsArray | OperatorFunction;
}
const $operator: OperatorObject = {
  plus: [(l: number, r: number): number => l + r, (l: Matrix, r: Matrix): Matrix => l, function (l: string, r: string): number {
    return l.length + r.length;
  }, (l: boolean, r: number): number => {
    return l ? r + 1 : r - 1;
  }],
  minus: (l: string, r: number) => l.slice(r),
  multiply(l, r) {
    return null;
  },
  incrementSuffix: [(x: string): string => x + "increment"],
  incrementPrefix: [(x: string): string => x + "increment"],
  not: [(x: number): number => -x],
  plusAssignment: [(l: string, r: number): number => 1]
};
let m1: Matrix = [[1, 2], [3, 4]];
m1.rowCount = 2;
m1.columnCount = 2;
let m2: Matrix = [];
let m3: Matrix = $operator["plus"]["1"](m1, m2); //重载
let num: number = $operator["plus"]["0"](1, 2); //重载
let len: number = $operator["plus"]["2"]("1", "2"); //重载
let str: number = $operator["plus"]["2"]("3", "4"); //重载
let num2: number = $operator["plus"]["3"](true, 1); //重载
let num3: any = 1 + true; //不重载
let str2: string = $operator["minus"]("aaa", 1);
let str3: string = "ppp" - "qqq";
let r: RegExp = /vue$/;
// let xx: bigint = 2n;

let nn1 = $operator["not"]["0"](-1);
let mm1: string = "mm";
mm1;
mm1 = $operator["incrementSuffix"]["0"](mm1);
mm1 = $operator["incrementPrefix"]["0"](mm1);
mm1 = $operator["plusAssignment"]["0"](mm1, 1);
function foo() {}
foo();
let bbb = {
  bar() {}
};
bbb.bar();