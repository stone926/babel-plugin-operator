import lib1a from "./lib1.cjs?query=1"
import * as lib1b from "./lib1.cjs?query=2"
console.log("import lib1a: ", lib1a, "\n")
console.log("import * as lib1b: ", lib1b, "\n-------------------------------\n")

console.log(import.meta)