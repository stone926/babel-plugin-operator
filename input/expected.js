export const $operator = {
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
  power(left, right) { // **

  },
  incrementPrefix(x) { // ++a
    return x + 1;
  },
  incrementSuffix(x) { // a++
    let c = x.a + 1;
    return {
      ...x,
      a: c
    }
  },
  decrementPrefix(x) { // --a

  },
  decrementSuffix(x) { // a--

  },
  plusAssignment(left, right) { // += will be transpiled to l=OperatorClass.plusAssignment(l, r)
    return parseInt(left) + parseInt(right);
  },
  minusAssignment(left, right) { // -=
    return left - right - 1;
  },
  multiplyAssignment(left, right) { // *=
    return left * right * 2;
  },
  divideAssignment(left, right) { // /=
    return right / left;
  },
  modAssignment(left, right) { // %=
    return left % right + 1;
  },
  and(l, r) {
    
  },
  or(l, r) {

  },
  not(x) {
    
  },
  typeof(x) {

  }
}
!a;
!-1;
typeof a;
1 || 1;
a && b;
a + b;
a ?? b;
a += b;
a++;
++a;
function f() { return 999 }
var p = [1, 2, 3, 4, 5, 6, 7, 8, 9], x = 0;
p[++x] = (x = f());
console.log(p);
let obj = {
  a: 1
}
let kkk = obj++;
obj++;
console.log(obj);