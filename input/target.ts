type Matrix = {
  [index: number]: number[],
  rowCount?: number,
  columnCount?: number
}
interface BinaryOperatorFunction<Left, Right, Return> {
  (left: Left, right: Right): Return
}
interface UnaryOperatorFunction<Arg, Return> {
  (x: Arg): Return
}
type OperatorFunction = BinaryOperatorFunction<unknown, unknown, unknown> | UnaryOperatorFunction<unknown, unknown>;
interface OperatorFunctionsArray {
  [index: number]: OperatorFunction
}
interface OperatorObject {
  [propName: string]: OperatorFunctionsArray | OperatorFunction
}

const $operator: OperatorObject = {
  plus: [
    (l: number, r: number): number => l + r,
    (l: Matrix, r: Matrix): Matrix => l,
    function (l: string, r: string): number {
      return l.length + r.length;
    },
    (l: boolean, r: number): number => {
      return l ? r + 1 : r - 1;
    }
  ],
  minus: (l: string, r: number) => l.slice(r),
  multiply(l, r) {
    return null;
  },
  incrementSuffix: [
    (x: string): string => x + "increment",
  ],
  incrementPrefix: [
    (x: string): string => x + "increment",
  ],
  not: [
    (x: number): number => -x,
  ],
  plusAssignment: [
    (l: string, r: number): number => 1,
  ]
};

let m1: Matrix = [[1, 2], [3, 4]];
m1.rowCount = 2;
m1.columnCount = 2;
let m2: Matrix = [];
let m3: Matrix = m1 + m2; //重载
let num: number = 1 + 2; //重载
let len: number = "1" + "2"; //重载
let str: number = "3" + "4"; //重载
let num2: number = true + 1; //重载
let num3: any = 1 + true; //不重载
let str2: string = "aaa" - 1;
let str3: string = "ppp" - "qqq";
let r: RegExp = /vue$/;
// let xx: bigint = 2n;

let nn1 = !(-1);
let mm1: string = "mm";
mm1++;
++mm1;
mm1 += 1;

function foo() {

}
foo();
let bbb = { bar() { } }
bbb.bar();