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
}

function component(props) {
  const [x, setX] = useState(1);

  return (
    <div>
      {props.content + props.foo()}
      {x && <div style={{
        color: 1 + props.color
      }}>{"this is conditional" + Math.random()}</div>}
      {<a></a> + <div></div>}
      <ul>
        {props.list*<li>something</li>}
      </ul>
      <Component></Component>
    </div>
  );
}