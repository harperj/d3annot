var _ = require('underscore');
var $ = require('jquery');
var angular = require('../lib/angular');
var d3 = require('d3');

var restylingApp = angular.module('restylingApp');

restylingApp.directive('ngRightClick', function($parse) {
    return function(scope, element, attrs) {
        var fn = $parse(attrs.ngRightClick);
        element.bind('contextmenu', function(event) {
            scope.$apply(function() {
                event.preventDefault();
                fn(scope, {$event:event});
            });
        });
    };
});

restylingApp.directive('fileUpload', [function() {
    return {
        scope: {
            fileUpload: "="
        },
        link: function(scope, element, attrs) {
            element.bind("change", function (event) {
                var schemaData = {};
                var schemaDataLength = 0;
                Papa.parse(event.target.files[0], {
                    dynamicTyping: true,
                    complete: function (csv) {
                        console.log(csv);
                        schemaDataLength = csv.data.length;
                        for (var i = 1; i < csv.data.length; ++i) {
                            for (var j = 0; j < csv.data[0].length; ++j) {
                                var key = csv.data[0][j];
                                if (schemaData[key]) {
                                    schemaData[key].push(csv.data[i][j]);
                                }
                                else {
                                    schemaData[key] = [csv.data[i][j]];
                                }
                            }
                        }
                        console.log(schemaData);
                        scope.$apply(function() {
                            scope.$parent.loadedSchemaData = schemaData;
                            scope.$parent.loadedSchemaDataLength = schemaDataLength;
                        });
                    }
                });
            });
        }
    }
}]);

restylingApp.directive('svgInject', function($compile) {
    return {
        scope: {
            schema: "=schema",
            ind: "=ind"
        },
        restrict: 'E',
        link: function(scope, element, attrs, controller) {
            scope.$watchGroup(["schema.numNodes", "attrs"], function(newValue, oldValue) {
//                    console.log(scope.schema);
//                    console.log(scope.ind);
                var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                var canvasWidth = 20;
                svg.setAttribute("width", canvasWidth.toString());
                svg.setAttribute("height", canvasWidth.toString());
                _.each(element[0].children, function(node) {
                    $(node).remove();
                }, true);
                _.each(element[0].children, function(node) {
                    $(node).remove();
                }, true);

                var maxWidth = _.max(scope.schema.attrs["width"]);
                var maxHeight= _.max(scope.schema.attrs["height"]);
                var scaleDimVal = maxHeight;
                if (maxWidth > maxHeight) {
                    scaleDimVal = maxWidth;
                }
                scaleDimVal = canvasWidth / scaleDimVal;

                var markNode = document.createElementNS("http://www.w3.org/2000/svg", scope.schema.attrs["shape"][scope.ind]);

                var nodeAttrs = scope.schema.nodeAttrs[scope.ind];
                for (var nodeAttr in nodeAttrs) {
                    if (nodeAttrs.hasOwnProperty(nodeAttr) && nodeAttrs[nodeAttr] !== null) {
                        if (nodeAttr === "text") {
                            $(markNode).text(nodeAttrs[nodeAttr]);
                        }
                        else {
                            d3.select(markNode).attr(nodeAttr, nodeAttrs[nodeAttr]);
                        }
                    }
                }

                // Setup non-geometric attributes
                var geomAttrs = ["width", "height", "area", "shape", "xPosition", "yPosition"];
                for (var attr in scope.schema.attrs) {
                    var isGeom = false;
                    _.each(geomAttrs, function(geomAttr) {
                        if (attr === geomAttr) {
                            isGeom = true;
                            return -1;
                        }
                    });
                    if (!isGeom && scope.schema.attrs[attr][scope.ind] !== 'none') {
                        d3.select(markNode).style(attr, scope.schema.attrs[attr][scope.ind]);
                    }
                }

                markNode.setAttribute("vector-effect", "non-scaling-stroke");
                if (markNode.tagName == "circle") {
                    markNode.setAttribute("r", "1");
                }

                svg.appendChild(markNode);
                element[0].appendChild(svg);

                var newNodeBoundingBox = transformedBoundingBox(markNode);
                var newScale = svg.createSVGTransform();
                var widthScale = attrs['width'] / newNodeBoundingBox.width;
                var heightScale = attrs['height'] / newNodeBoundingBox.height;
                if (isNaN(widthScale)) {
                    widthScale = 1;
                }
                if (isNaN(heightScale)) {
                    heightScale = 1;
                }
                newScale.setScale(widthScale * scaleDimVal, heightScale * scaleDimVal);
                markNode.transform.baseVal.appendItem(newScale);
                newNodeBoundingBox = transformedBoundingBox(markNode);
                var newTranslate = svg.createSVGTransform();
                var globalTransform = markNode.getTransformToElement(svg);
                var globalToLocal = globalTransform.inverse();
                var newNodeCurrentGlobalPt = svg.createSVGPoint();
                newNodeCurrentGlobalPt.x = newNodeBoundingBox.x + (newNodeBoundingBox.width / 2);
                newNodeCurrentGlobalPt.y = newNodeBoundingBox.y + (newNodeBoundingBox.height / 2);

                var newNodeDestinationGlobalPt = svg.createSVGPoint();
                newNodeDestinationGlobalPt.x = canvasWidth / 2;
                newNodeDestinationGlobalPt.y = canvasWidth / 2;

                var localCurrentPt = newNodeCurrentGlobalPt.matrixTransform(globalToLocal);
                var localDestinationPt = newNodeDestinationGlobalPt.matrixTransform(globalToLocal);

                var xTranslate = localDestinationPt.x - localCurrentPt.x;
                var yTranslate = localDestinationPt.y - localCurrentPt.y;
                newTranslate.setTranslate(xTranslate, yTranslate);

                markNode.transform.baseVal.appendItem(newTranslate);
            });
        }
    }
});



var transformedBoundingBox = function (el, to) {
    //console.log(el);
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