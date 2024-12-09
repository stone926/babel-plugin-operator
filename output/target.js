"use strict";

const $operator = {
  plus: [(l, r) => l + r, (l, r) => l, function (l, r) {
    return l.length + r.length;
  }, (l, r) => {
    return l ? r + 1 : r - 1;
  }],
  minus: (l, r) => l.slice(r),
  multiply(l, r) {
    return null;
  },
  incrementSuffix: [x => x + "increment"],
  incrementPrefix: [x => x + "increment"],
  not: [x => -x],
  plusAssignment: [(l, r) => 1]
};
let m1 = [[1, 2], [3, 4]];
m1.rowCount = 2;
m1.columnCount = 2;
let m2 = [];
let m3 = m1 + m2; //重载
let num = 1 + 2; //重载
let len = "1" + "2"; //重载
let str = "3" + "4"; //不重载
let num2 = true + 1; //重载
let num3 = 1 + true; //不重载
let str2 = "aaa" - 1;
let str3 = "ppp" - "qqq";
let r = /vue$/;
// let xx: bigint = 2n;

let nn1 = !-1;
let mm1 = "mm";
mm1++;
++mm1;
mm1 += 1;
function foo() {}
foo();
let bbb = {
  bar() {}
};
bbb.bar();