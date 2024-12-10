import { build } from "../src/util/types.js";
import * as t from "@babel/types";
import generator from "@babel/generator";

const id = build("obj");
const node = id(Symbol("a"), "a", null)()(Symbol("a")).prop;
console.log(generator.default(node[build.raw]));
