/**
 * Created by harper on 5/11/14.
 */
'use strict';

var VisUpdater = function(svgNode, markNodes, ids, schemas) {

    var currentNodes = new Array(markNodes.length);
    _.each(markNodes, function(markNode, ind) {
        currentNodes[ind] = markNode;
    });

    function getAttrsFromId(id) {
        var attrs = { };
        _.each(schemas, function(schema) {
            var ind = schema.ids.indexOf(id);
            if (ind !== -1) {
                _.each(schema.attrs, function(val, attr) {
                    attrs[attr] = val[ind];
                });
            }
        });
        return attrs;
    }

    function getSchemaFromId(id) {
        var schemaInd = -1;
        _.each(schemas, function(schema, i) {
            var ind = schema.ids.indexOf(id);
            if (ind !== -1) {
                schemaInd = i;
            }
        });
        return schemaInd;
    }

    function updateNodes(nodeIds, attr, val) {
        _.each(nodeIds, function(nodeId) {
            if (ids.indexOf(nodeId) !== -1) {
                updateNode(nodeId, attr, val);
            }
        });
    }

    function updateNode(nodeId, changeAttr, changeVal) {
        var schemaInd = getSchemaFromId(nodeId);
        //console.log(changeVal);
        //console.log(changeAttr);

        var withinSchemaInd = schemas[schemaInd].ids.indexOf(nodeId);
        schemas[schemaInd].attrs[changeAttr][withinSchemaInd] = changeVal;
        redrawNode(nodeId);
    }

    function redrawNode(nodeId) {
        var ind = ids.indexOf(nodeId);
        var currentNode = currentNodes[ind];
        var attrs = getAttrsFromId(nodeId);
        var schema = getSchemaFromId(nodeId);
        var svg = currentNode.ownerSVGElement;

        var newNode = getNewNodeFromShape(attrs['shape']);

        currentNode.parentNode.appendChild(newNode);

        _.each(attrs, function(val, attr) {
            if (val !== null) {
               d3.select(newNode).style(attr, val);
            }
        });
        var withinSchemaInd = schemas[schema].ids.indexOf(nodeId);
        _.each(schemas[schema].nodeAttrs[withinSchemaInd], function(val, attr) {
            if (attr === "text") {
                $(newNode).text(val);
            }
            else {
                d3.select(newNode).attr(attr, val);
            }
        });

        var newNodeBoundingBox = transformedBoundingBox(newNode);
        var newScale = svg.createSVGTransform();
        var widthScale = attrs['width'] / newNodeBoundingBox.width;
        var heightScale = attrs['height'] / newNodeBoundingBox.height;
        newScale.setScale(widthScale, heightScale);

        var newTranslate = svg.createSVGTransform();
        var globalTransform = currentNode.getTransformToElement(svg);
        var globalToLocal = globalTransform.inverse();

        var newNodeCurrentGlobalPt = svg.createSVGPoint();
        newNodeCurrentGlobalPt.x = newNodeBoundingBox.x + (newNodeBoundingBox.width / 2);
        newNodeCurrentGlobalPt.y = newNodeBoundingBox.y + (newNodeBoundingBox.height / 2);

        var newNodeDestinationGlobalPt = svg.createSVGPoint();
        newNodeDestinationGlobalPt.x = attrs['xPosition'];
        newNodeDestinationGlobalPt.y = attrs['yPosition'];

        var localCurrentPt = newNodeCurrentGlobalPt.matrixTransform(globalToLocal);
        var localDestinationPt = newNodeDestinationGlobalPt.matrixTransform(globalToLocal);

        var xTranslate = localDestinationPt.x - localCurrentPt.x;
        var yTranslate = localDestinationPt.y - localCurrentPt.y;
        newTranslate.setTranslate(xTranslate, yTranslate);
        var globalTransform = newNode.getTransformToElement(svg);

        newNode.transform.baseVal.appendItem(newScale);
        newNode.transform.baseVal.appendItem(newTranslate);

        $(currentNodes[ind]).remove();
        currentNodes[ind] = newNode;
    }

    function getNewNodeFromShape (shapeName) {
        var newNode = document.createElementNS("http://www.w3.org/2000/svg", shapeName);

        if (shapeName === "rect") {
            d3.select(newNode).attr("width", 1);
            d3.select(newNode).attr("height", 1);
        }
        else if (shapeName === "circle") {
            d3.select(newNode).attr("r", 1);
        }

        return newNode;
    }

    function transformedBoundingBox (el, to) {
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

        for (var i = 0; i < pts.length; i++) {
            var pt = pts[i];
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

    return {
        updateNodes: updateNodes
    };
};