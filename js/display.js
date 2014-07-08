"use strict";

(function () {
    var restylingApp = angular.module('restylingApp', []);

    restylingApp.factory('chromeMessageService', function() {
        var port;

        function addDataListener(callback) {
            chrome.runtime.onMessage.addListener(function (message, sender) {
                if (message.type === "restylingData") {
                    var data = message.data;
                    data = $.extend([], data);
                    callback(data);
                    port = chrome.tabs.connect(sender.tab.id, {name: 'd3decon'});
                }
            });
        }

        function sendMessage(message) {
            port.postMessage(message);
        }

        return {
            receiveData: function (callback) {
                addDataListener(callback);
            },
            sendMessage: sendMessage
        }
    });

    restylingApp.filter('range', function() {
        return function(input, total) {
            total = parseInt(total);
            for (var i=0; i<total; i++)
                input.push(i);
            return input;
        };
    });

    restylingApp.controller('RestylingAppController', ['$scope', 'chromeMessageService',
        function($scope, chromeMessageService) {
            $scope.selectedSchema = 0;
            $scope.data = [];
            $scope.selectedRows = [];

            // Load data from the visualization as it arrives
            function setupMessageServiceData (data) {
                _.each(data, function(schema, i) {
                    data[i].numNodes = schema.ids.length;
                });
                $scope.data = data;
                $scope.$apply();
            }
            chromeMessageService.receiveData(setupMessageServiceData);

            $scope.selectSchema = function(schema) {
                console.log($scope.data);
                $scope.selectedSchema = $scope.data.indexOf(schema);
                $scope.selectedRows = [];
                console.log($scope.selectedSchema);
            };

            $scope.doUpdate = function(message) {
                chromeMessageService.sendMessage(message);
            };

            $scope.getNumber = function(number) {
                return new Array(number);
            }

        }]);

    restylingApp.controller('DataTableController', ['$scope', 'orderByFilter', function($scope, orderByFilter) {

        $scope.findSchemaById = function(id) {
            var schemaInd;
            _.each($scope.data, function(schema, ind) {
                if (schema.ids.indexOf(id) > -1) {
                    schemaInd = ind;
                }
            });
            return schemaInd;
        };

        $scope.selectRow = function(schema, ind) {

            var rowSchemaInd = $scope.data.indexOf(schema);
            if (rowSchemaInd !== $scope.selectedSchema) {
                $scope.selectSchema($scope.data[rowSchemaInd]);
            }

            if ($scope.selectedRows.indexOf(ind) !== -1) {
                $scope.selectedRows.splice($scope.selectedRows.indexOf(ind), 1);
            }
            else {
                $scope.selectedRows.push(ind);
            }
        };

        $scope.rowIsSelected = function(schema, ind) {
            if ($scope.data.indexOf(schema) === $scope.selectedSchema) {
                return $scope.selectedRows.indexOf(ind) !== -1;
            }
            else {
                return false;
            }
        };

        $scope.splitSchema = function() {
            if ($scope.selectedRows.length > 0) {
                var schema = $scope.data[$scope.selectedSchema];
                $scope.selectedRows = $scope.selectedRows.sort(function(a, b){return b-a});

                var newSchema = {
                    ids: [],
                    data: {},
                    attrs: {},
                    nodeAttrs: [],
                    mappings: []
                };
                console.log("Selected rows:");
                console.log($scope.selectedRows);

                _.each($scope.selectedRows, function(ind, count) {
                    newSchema.ids.push(schema.ids[ind]);
                    schema.ids.splice(ind, 1);
                    newSchema.nodeAttrs.push(schema.nodeAttrs[ind]);
                    schema.nodeAttrs.splice(ind, 1);

                    _.each(schema.data, function(val, key) {
                        if (newSchema.data[key]) {
                            newSchema.data[key].push(val[ind]);
                        }
                        else {
                            newSchema.data[key] = [val[ind]]
                        }
                        schema.data[key].splice(ind, 1);
                    });
                    _.each(schema.attrs, function(val, key) {
                        if (newSchema.attrs[key]) {
                            newSchema.attrs[key].push(val[ind]);
                        }
                        else {
                            newSchema.attrs[key] = [val[ind]]
                        }
                        schema.attrs[key].splice(ind, 1);
                    });
                });
                newSchema.schema = _.keys(newSchema.data);
                newSchema.numNodes = newSchema.ids.length;
                schema.numNodes = schema.ids.length;

                console.log(schema);
                schema.mappings = VisDeconstruct.extractMappings(schema);
                console.log("new schema");
                console.log(newSchema);
                newSchema.mappings = VisDeconstruct.extractMappings(newSchema);
                console.log(newSchema);
                $scope.data.push(newSchema);
                $scope.selectedRows = [];
            }
        }
    }]);



    restylingApp.controller('MappingsListController', ['$scope', function($scope) {

        $scope.linearUpdateCoeffs = [];

        $scope.selectMapping = function(mapping) {
            if (mapping.type === "linear") {
                $scope.linearUpdateCoeffs = mapping.params.coeffs;
            }
        };

        $scope.isLinear = function(mapping) {
            return mapping.type === "linear";
        };

        $scope.isNominal = function(mapping) {
            return mapping.type === "nominal";
        };

        $scope.removeMapping = function(mapping) {
            var schema = $scope.data[$scope.selectedSchema];
            var mappingInd = schema.mappings.indexOf(mapping);

            var replaceVal;
            if (mapping.type === "nominal") {
                replaceVal = schema.attrs[mapping.attr][0];
            }
            else {
                replaceVal = mapping.params.attrMin;
            }

            // remove mapping
            schema.mappings.splice(mappingInd, 1);

            // update vals accordingly
            var message = {
                type: "update",
                attr: mapping.attr,
                val: replaceVal,
                ids: schema.ids
            };
            $scope.doUpdate(message);

        };

        $scope.nominalMappingChange = function($event, mapping, from) {
            if ($event.keyCode === 13) {
                var newVal = angular.element($event.target).val();

                console.log(mapping.params);
                console.log(from);
                var oldVal = mapping.params[from];
                var changeInds = [];
                var mappingSchemaInd = -1;

                // update mapping with new value and find schema ind
                 _.each($scope.data, function (schema, schemaInd) {
                     var mappingInd = schema.mappings.indexOf(mapping);
                     if (mappingInd !== -1) {
                         console.log("Found mapping.");
                         schema.mappings[mappingInd].params[from] = newVal;
                         mappingSchemaInd = schemaInd;
                     }
                 });


                // update data with new attr vals and collect indices
                console.log(oldVal);
                _.each($scope.data[mappingSchemaInd].attrs[mapping.attr], function (val, valInd) {
                    if (val === oldVal) {
                        $scope.data[mappingSchemaInd].attrs[mapping.attr][valInd] = newVal;
                        changeInds.push(valInd);
                    }
                });

                var ids = _.map(changeInds, function (ind) {
                    return $scope.data[mappingSchemaInd].ids[ind]
                });
                var message = {
                    type: "update",
                    attr: mapping.attr,
                    val: newVal,
                    ids: ids
                };
                $scope.doUpdate(message);
            }
        };

        $scope.linearMappingChange = function($event, mapping, changedInd) {
            if ($event.keyCode !== 13) {
                return;
            }

            var newVal = +angular.element($event.target).val();

            var mappingSchemaInd = -1;

            _.each($scope.data, function(schema, schemaInd) {
                var mappingInd = schema.mappings.indexOf(mapping);
                if (mappingInd !== -1) {
                    for (var i = 0; i < $scope.linearUpdateCoeffs.length; ++i) {
                        mapping.params.coeffs[i] = $scope.linearUpdateCoeffs[i];
                    }
                    mappingSchemaInd = schemaInd;
                }
            });

            var attrArray = $scope.data[mappingSchemaInd].attrs[mapping.attr];
            var schema = $scope.data[mappingSchemaInd];
            _.each(attrArray, function(attrVal, ind) {

                var newAttrVal = 0;
                _.each(mapping.params.coeffs, function(coeff, coeffInd) {
                    if (coeffInd === changedInd) {
                        mapping.params.coeffs[changedInd] = newVal;
                        coeff = newVal;
                    }
                    if (coeffInd < mapping.data.length) {
                        newAttrVal += coeff * schema.data[mapping.data[coeffInd]][ind];
                        console.log(coeff * schema.data[mapping.data[coeffInd]][ind] + "+");
                    }
                    else {
                        console.log(coeff);
                        newAttrVal += coeff;
                    }
                });

                attrArray[ind] = newAttrVal;
                var message = {
                    type: "update",
                    attr: mapping.attr,
                    val: newAttrVal,
                    ids: [$scope.data[mappingSchemaInd].ids[ind]]
                };
                $scope.doUpdate(message);
            });

        };
    }]);

    restylingApp.controller('AddMappingsController', ['$scope', function($scope) {
        $scope.dataFieldSelected = "";
        $scope.attrSelected = "";

        $scope.linearMappingAvailable = function() {
            var schema = $scope.data[$scope.selectedSchema];
            if (typeof schema.attrs[$scope.attrSelected][0] !== "number"
                || typeof schema.data[$scope.dataFieldSelected][0] !== "number") {
                return false;
            }
            return true;
        };

        $scope.isMapped = function(attr) {
            var schema = $scope.data[$scope.selectedSchema];
            var foundMapping = _.find(schema.mappings, function(mapping) {
                return mapping.attr == attr;
            });
            return foundMapping;
        };

        $scope.uniqVals = function(schemaInd, fieldName, isAttr) {
            var allVals;
            if (isAttr) {
                allVals = $scope.data[schemaInd].attrs[fieldName];
            }
            else {
                allVals = $scope.data[schemaInd].data[fieldName];
            }
            return _.uniq(allVals);
        };

        $scope.attrChange = function($event, oldAttrVal, attr) {
            if ($event.keyCode === 13) { //enter key
                var schema = $scope.data[$scope.selectedSchema];
                var newAttrVal = angular.element($event.target).val();
                var inds = [];
                for (var i = 0; i < schema.attrs[attr].length; ++i) {
                    if (schema.attrs[attr][i] === oldAttrVal) {
                        schema.attrs[attr][i] = newAttrVal;
                        inds.push(i);
                    }
                }
                var ids = _.map(inds, function(ind) {return schema.ids[ind];});
                var message = {
                    type: "update",
                    attr: attr,
                    val: newAttrVal,
                    ids: ids
                };
                $scope.doUpdate(message);
            }
        };

    }]);

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

    restylingApp.directive('svgInject', function($compile) {
        return {
            scope: {
                schema: "=schema",
                ind: "=ind"
            },
            restrict: 'E',
            link: function(scope, element, attrs, controller) {
                scope.$watch("schema.numNodes", function(newValue, oldValue) {
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

                    var newTranslate = svg.createSVGTransform();
                    newTranslate.setTranslate(canvasWidth / 2, canvasWidth / 2);
                    var newScale = svg.createSVGTransform();
                    var originalWidthScale = scope.schema.attrs["width"][scope.ind] /
                        transformedBoundingBox(markNode).width;
                    var originalHeightScale = scope.schema.attrs["height"][scope.ind] /
                        transformedBoundingBox(markNode).height;

                    if (isNaN(originalWidthScale)) {
                        originalWidthScale = 1;
                    }
                    if (isNaN(originalHeightScale)) {
                        originalHeightScale = 1;
                    }

                    newScale.setScale(originalWidthScale * ((canvasWidth-2) / scaleDimVal),
                            originalHeightScale * (canvasWidth-2) / scaleDimVal);
                    markNode.transform.baseVal.appendItem(newTranslate);
                    markNode.transform.baseVal.appendItem(newScale);

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
})();