function DeconUtil() {
    var transformedBoundingBox = function (el, to) {
        var bb, m, pt, pts, svg, xMax, xMin, yMax, yMin, _i, _len;
        var bb = el.getBBox();
        var svg = el.ownerSVGElement;
        if (!to) {
            to = svg;
        }
        var m = el.getTransformToElement(to);
        var pts = [svg.createSVGPoint(), svg.createSVGPoint(), svg.createSVGPoint(), svg.createSVGPoint()];
        pts[0].x = bb.x;
        pts[0].y = bb.y;
        pts[1].x = bb.x + bb.width;
        pts[1].y = bb.y;
        pts[2].x = bb.x + bb.width;
        pts[2].y = bb.y + bb.height;
        pts[3].x = bb.x;
        pts[3].y = bb.y + bb.height;

        var xMin = Infinity;
        var xMax = -Infinity;
        var yMin = Infinity;
        var yMax = -Infinity;

        for (_i = 0, _len = pts.length; _i < _len; _i++) {
            var pt = pts[_i];
            pt = pt.matrixTransform(m);
            xMin = Math.min(xMin, pt.x);
            xMax = Math.max(xMax, pt.x);
            yMin = Math.min(yMin, pt.y);
            yMax = Math.max(yMax, pt.y);
        }
        bb.x = xMin;
        bb.width = xMax - xMin;
        bb.y = yMin;
        bb.height = yMax - yMin;
        return bb;
    };
}