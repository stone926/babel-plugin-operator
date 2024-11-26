"use strict";

var _expected = require("./expected");
class T {
  f(a, b) {
    return _expected.$operator.plus(a, b);
  }
}
console.log(_expected.$operator.plus(1, "1"));
console.log(_expected.$operator.minus(1, "1"));
!a;
_expected.$operator.nullishCoalesce(a, "");
a >> 1;