"use strict";

var _ = require('underscore');
var $ = require('jquery');
var angular = require('angular');
var Papa = require('../lib/papaparse.js');
var d3 = require('d3');
var VisDeconstruct = require('./VisDeconstruct.js');

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
            function setupMessageServiceData (dataObj) {
                var ids = dataObj.ids;
                var data = dataObj.schematized;
                _.each(data, function(schema, i) {
                    data[i].numNodes = schema.ids.length;
                });
                $scope.ids = ids;
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

            $scope.doUpdate = function(updateMessage, schema) {
                var val = updateMessage.val;
                var attr = updateMessage.attr;
                _.each(updateMessage.ids, function(id, ind) {
                    schema.attrs[attr][ind] = val;

                    if (attr === "area") {
                        schema.attrs["width"] = Math.sqrt(replaceVal);
                    }
                    else if (attr === "width" || attr === "height") {
                        schema.attrs["area"] = schema.attrs["width"][ind]
                            * schema.attrs["height"][ind];
                    }
                });

                chromeMessageService.sendMessage(updateMessage);
            };

            $scope.getNumber = function(number) {
                return new Array(number);
            };

            $scope.updateDataWithLinearMapping = function(mapping, schemaInd) {
                // update the attribute values according to the new mapping
                var attrArray = $scope.data[schemaInd].attrs[mapping.attr];
                var schema = $scope.data[schemaInd];
                _.each(attrArray, function(attrVal, ind) {

                    var newAttrVal = 0;
                    _.each(mapping.params.coeffs, function(coeff, coeffInd) {
//                    if (coeffInd === changedInd) {
//                        mapping.params.coeffs[changedInd] = newVal;
//                        coeff = newVal;
//                    }
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
                        ids: [$scope.data[schemaInd].ids[ind]]
                    };
                    $scope.doUpdate(message, $scope.data[schemaInd]);
                });
            };


        }]);

    restylingApp.controller('DataTableController', ['$scope', 'orderByFilter', function($scope, orderByFilter) {
        $scope.saveFilename = "";

        $scope.getSchemaSize = function(schema) {
            var dataField = _.keys(schema.data)[0];
            return schema.data[dataField].length;
        };

        $scope.hasMarks = function(schema) {
            return schema.attrs !== null;
        };

        $scope.saveData = function() {
            saveAs(new Blob([JSON.stringify($scope.data)]), $scope.saveFilename);
        };

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
        };
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

            // update vals accordingly
            var message = {
                type: "update",
                attr: mapping.attr,
                val: replaceVal,
                ids: schema.ids
            };
            $scope.doUpdate(message, schema);
            schema.mappings = VisDeconstruct.extractMappings(schema);

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
                $scope.doUpdate(message, $scope.data[mappingSchemaInd]);
            }
        };

        $scope.linearMappingChange = function($event, mapping, changedInd) {
            if ($event.keyCode !== 13) {
                return;
            }

            var newVal = +angular.element($event.target).val();

            var mappingSchemaInd = -1;

            // Update the mapping
            _.each($scope.data, function(schema, schemaInd) {
                var mappingInd = schema.mappings.indexOf(mapping);
                if (mappingInd !== -1) {
                    for (var i = 0; i < $scope.linearUpdateCoeffs.length; ++i) {
                        mapping.params.coeffs[i] = $scope.linearUpdateCoeffs[i];
                    }
                    mappingSchemaInd = schemaInd;
                }
            });

            mapping.params.coeffs[changedInd] = newVal;

            $scope.updateDataWithLinearMapping(mapping, mappingSchemaInd);
        };
    }]);

    restylingApp.controller('AddMappingsController', ['$scope', function($scope) {
        $scope.dataFieldsSelected = [];
        $scope.attrSelected = "";
        $scope.newNominalMappingData = {};
        $scope.newLinearMappingData = [];

        $scope.linearMappingAvailable = function() {
            var schema = $scope.data[$scope.selectedSchema];
            //console.log($scope.dataFieldsSelected);
            //console.log($scope.attrSelected);
            if (!$scope.attrSelected && $scope.dataFieldsSelected.length === 0) {
                return true;
            }
            else if ($scope.attrSelected
                && typeof schema.attrs[$scope.attrSelected][0] === "number"
                && $scope.dataFieldsSelected.length === 0) {
                return true;
            }
            else if (!$scope.attrSelected
                && $scope.dataFieldsSelected.length > 0
                && typeof schema.data[$scope.dataFieldsSelected[0]][0] === "number") {
                return true;
            }
            else if ($scope.attrSelected
                && $scope.dataFieldsSelected.length > 0
                && typeof schema.attrs[$scope.attrSelected][0] === "number"
                && typeof schema.data[$scope.dataFieldsSelected[0]][0] === "number") {
                return true;
            }
            return false;
        };

        $scope.isMapped = function(attr) {
            var schema = $scope.data[$scope.selectedSchema];
            return _.find(schema.mappings, function(mapping) {
                return mapping.attr == attr;
            }) !== undefined;
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
                $scope.doUpdate(message, schema);
            }
        };

         $scope.getRemainingFields = function() {
            return _.without($scope.data[$scope.selectedSchema].schema, $scope.dataFieldsSelected);
        };

        $scope.showAddNominalMappingDialog = function() {
            return $scope.action === 'nominal'
                && $scope.dataFieldsSelected.length === 1
                && $scope.attrSelected;
        };

        $scope.removeDataField = function(ind) {
            $scope.dataFieldsSelected.splice(ind, 1);
        };

        $scope.showAddLinearMappingDialog = function() {
            return $scope.action === 'linear'
                && $scope.dataFieldsSelected.length > 0
                && $scope.attrSelected;
        };

        $scope.showChangeAttrDialog = function() {
            return $scope.dataFieldsSelected.length === 0
                && $scope.attrSelected;
        };

        $scope.allowMappingSelect = function(mappingType) {
            if (mappingType === 'linear') {
                if ($scope.linearMappingAvailable()) {
                    return true;
                }
            }
            else if (mappingType === 'nominal') {
                return true;
            }
            return false;
        };

        $scope.allowAddField = function() {
            return $scope.dataFieldsSelected.length === 0
                || ($scope.action === 'linear'
                &&  $scope.dataFieldsSelected.length < $scope.data[$scope.selectedSchema].schema.length);
        };

        $scope.selectMappingType = function(mappingType) {
            if (mappingType === 'linear') {
                $scope.action = 'linear';
                $scope.setupNewLinearMapping();
            }
            else if (mappingType === 'nominal') {
                $scope.action = 'nominal';
                $scope.setupNewNominalMapping();
            }
        };

        $scope.setupNewLinearMapping = function() {
            console.log("Setting up new linear mapping");
            console.log($scope.dataFieldsSelected);
            $scope.newLinearMappingData =
                Array.apply(null, new Array($scope.dataFieldsSelected.length+1))
                .map(Number.prototype.valueOf,0);
        };

        $scope.setupNewNominalMapping = function() {
            $scope.newNominalMappingData = {};
        };

        $scope.addNominalMapping = function($event) {
            if ($event.keyCode === 13) {
                var schema = $scope.data[$scope.selectedSchema];
                var dataField = $scope.dataFieldsSelected[0];
                var markAttr = $scope.attrSelected;
                var nominalMap = $scope.newNominalMappingData;

                console.log(nominalMap);

                _.each(_.keys(nominalMap), function(keyVal) {
                    var keyInds = [];
                    var keyIds = [];
                    _.each(schema.data[dataField], function(val, valInd) {
                        if (val.toString() === keyVal) {
                            keyInds.push(valInd);
                            keyIds.push(schema.ids[valInd]);
                        }
                    });

                    var message = {
                        type: "update",
                        attr: markAttr,
                        val: nominalMap[keyVal],
                        ids: keyIds
                    };
                    $scope.doUpdate(message, schema);
                });

                // Now add the mapping to the schema
                var mapping = {
                    data: dataField,
                    attr: markAttr,
                    type: "nominal",
                    params: nominalMap
                };
                schema.mappings.push(mapping);
            }
        };

        $scope.addLinearMapping = function($event) {
            if ($event.keyCode === 13) {
                console.log($scope.newLinearMappingData);
                var schema = $scope.data[$scope.selectedSchema];
                var dataFields = $scope.dataFieldsSelected;
                var markAttr = $scope.attrSelected;
                var coeffs = $scope.newLinearMappingData;
                _.each(coeffs, function(coeff, ind) {
                    coeffs[ind] = +coeffs[ind];
                });

                var attrMin = Number.MAX_VALUE;
                _.each(schema.ids, function(id, ind) {
                    var attrVal = 0;
                    _.each(dataFields, function(dataField, dataFieldInd) {
                        attrVal += schema.data[dataField][ind] * coeffs[dataFieldInd];
                    });
                    // Finally add the constant
                    attrVal += coeffs[coeffs.length-1];
                    if (attrVal < attrMin) {
                        attrMin = attrVal;
                    }
                });

                var mapping = {
                    type: 'linear',
                    data: $scope.dataFieldsSelected,
                    attr: $scope.attrSelected,
                    params: {
                        attrMin: attrMin,
                        coeffs: $scope.newLinearMappingData
                    }
                };
                $scope.data[$scope.selectedSchema].mappings.push(mapping);
                $scope.updateDataWithLinearMapping(mapping, $scope.selectedSchema);
                //schema.mappings = VisDeconstruct.extractMappings(schema);
            }
        };

        $scope.addDataField = function(dataField, ind) {
            console.log(dataField);
            console.log(ind);
            if ($scope.dataFieldsSelected.length === ind) {
                $scope.dataFieldsSelected.push(dataField);
            }
            else {
                $scope.dataFieldsSelected[ind] = dataField;
            }

            if ($scope.action === "linear") {
                $scope.setupNewLinearMapping();
            }
        };

        $scope.attrSelectable = function(attr) {
            return !($scope.action === "linear" &&
                typeof $scope.data[$scope.selectedSchema].attrs[attr][0] !== "number");
        };

    }]);

var dataScope;
    restylingApp.controller('AddTableController', ['$scope', function($scope) {
        dataScope = $scope;

        $scope.createMarks = function(schemaID) {

        };

        $scope.addCSVDataTable = function() {
            if (!$scope.loadedSchemaData) {
                return false;
            }

            var newSchemaData = _.extend({}, $scope.loadedSchemaData);

            var newSchema = {
                data: newSchemaData,
                attrs: null,
                ids: null,
                nodeAttrs: null,
                schema: _.keys(newSchemaData)
            };

            $scope.data.push(newSchema);
            console.log(newSchema);
        };

        $scope.leftOuterJoinCSV = function(key) {
            if (!$scope.loadedSchemaData) {
                return false;
            }

            var leftData = $scope.data[$scope.selectedSchema].data;
            var rightData = $scope.loadedSchemaData;
            var leftLength = leftData[_.keys(leftData)[0]].length;
            var rightLength = $scope.loadedSchemaDataLength;

            for (var row = 0; row < leftLength; ++row) {
                var foundMatchingKey = false;
                for (var rightRow = 0; rightRow < rightLength; ++rightRow) {
                    if (leftData[key][row] === rightData[key][rightRow]) {
                        foundMatchingKey = true;
                        _.each(_.keys(rightData), function(dataField) {
                            if (dataField !== key) {
                                if (leftData[dataField]) {
                                    leftData[dataField].push(rightData[dataField][rightRow]);
                                }
                                else {
                                    leftData[dataField] = [rightData[dataField][rightRow]];
                                }
                            }
                        });
                        break;
                    }
                }

                if (!foundMatchingKey) {
                    _.each(_.keys(rightData), function(dataField) {
                        if (dataField !== key) {
                            if (leftData[dataField]) {
                                leftData[dataField].push(null);
                            }
                            else {
                                leftData[dataField] = [null];
                            }
                        }
                    });
                }
            }
            console.log(leftData);
            $scope.data[$scope.selectedSchema].schema = _.keys(leftData);
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
                scope.$watch("attrs", function(newValue, oldValue) {
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
//})();