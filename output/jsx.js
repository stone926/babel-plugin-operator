"use strict";

require("core-js/modules/es.regexp.to-string.js");
require("core-js/modules/web.dom-collections.iterator.js");
const $operator = {
  plus(l, r) {
    return l.toString() + r.toString();
  },
  and(l, r) {
    return l & r;
  },
  multiply(list, node) {
    return;
  }
};
function component(props) {
  const [x, setX] = useState(1);
  return <div>
      {$operator["plus"](props.content, props.foo())}
      {$operator["and"](x, <div style={{
      color: $operator["plus"](1, props.color)
    }}>{$operator["plus"]("this is conditional", Math.random())}</div>)}
      {$operator["plus"](<a></a>, <div></div>)}
      <ul>
        {$operator["multiply"](props.list, <li>something</li>)}
      </ul>
      <Component></Component>
    </div>;
}