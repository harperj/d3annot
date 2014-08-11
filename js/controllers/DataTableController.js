var _ = require('underscore');
var angular = require('../../lib/angular');
var VisDeconstruct = require('../VisDeconstruct');

var restylingApp = angular.module('restylingApp');

restylingApp.controller('DataTableController', ['$scope', 'orderByFilter', 'VisDataService',
    function($scope, orderByFilter, visDataService) {
        $scope.data = visDataService.visData;
        $scope.ids = visDataService.ids;

        $scope.getNumber = function(number) {
            return new Array(number);
        };

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
    }
]);