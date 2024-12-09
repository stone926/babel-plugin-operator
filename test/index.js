import { build } from "../src/util/types.js";
import * as t from "@babel/types";
import generator from "@babel/generator";

const id = build("obj");
const node = id(t.identifier("identifier")).lll[0]['>>>='](build("p").k()).func();
console.log(generator.default(node[build.raw]));
