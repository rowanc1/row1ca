// see http://bl.ocks.org/mbostock/3231298
// also http://stackoverflow.com/questions/19886834/increase-and-decrease-radius-of-a-circle-using-d3-transition

var blotch = function(id){

  var width = document.body.clientWidth,
      height = document.body.clientHeight;

  var nodes = d3.range(200).map(function() { return {radius: Math.random() * 12 + 4}; }),
      root = nodes[0],
      color = d3.scale.category20c();

  root.radius = 0;
  root.fixed = true;

  var force = d3.layout.force()
      .gravity(0.05)
      .charge(function(d, i) { return i ? 0 : -2000; })
      .nodes(nodes)
      .size([width, height]);

  force.start();

  var svg = d3.select(id).append("svg")
      .attr("width", width)
      .attr("height", height);

  var rect = svg.append('rect')
            .attr("x", "0")
            .attr("y", "0")
            .attr("width", width)
            .attr("height", height)
            .attr('fill','transparent');
  var oil = svg.append('g');
  var bubbles = svg.append('g');

  bubbles.selectAll("circle")
      .data(nodes.slice(1))
    .enter().append("circle")
      .attr("r", function(d) { return d.radius; })
      .attr("opacity", 0.3)
      .style("fill", function(d, i) { return d3.rgb('#ccc').brighter(Math.random()*5); });

  force.on("tick", function(e) {
    var q = d3.geom.quadtree(nodes),
        i = 0,
        n = nodes.length;

    while (++i < n) q.visit(collide(nodes[i]));

    bubbles.selectAll("circle")
        .attr("cx", function(d) { return d.x; })
        .attr("cy", function(d) { return d.y; });
  });




  svg.on("mousemove", function() {
    var p1 = d3.mouse(this);
    root.px = p1[0];
    root.py = p1[1];
    force.resume();
  });



  rect.on("mousemove", function() {
    if(Math.random() < 0.5){return;}
    var p1 = d3.mouse(this);
    oil.append('circle')
        .attr("cx",p1[0])
        .attr("cy",p1[1])
        .attr("r", 10)
        .transition().duration(6000*Math.random()+3000)
          .attr("r", 100*Math.random()+50);
  });

  function collide(node) {
    var r = node.radius + 16,
        nx1 = node.x - r,
        nx2 = node.x + r,
        ny1 = node.y - r,
        ny2 = node.y + r;
    return function(quad, x1, y1, x2, y2) {
      if (quad.point && (quad.point !== node)) {
        var x = node.x - quad.point.x,
            y = node.y - quad.point.y,
            l = Math.sqrt(x * x + y * y),
            r = node.radius + quad.point.radius;
        if (l < r) {
          l = (l - r) / l * .5;
          node.x -= x *= l;
          node.y -= y *= l;
          quad.point.x += x;
          quad.point.y += y;
        }
      }
      return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1;
    };
  }
  return {clearOil:function(){oil.selectAll("circle").remove();}}
};
