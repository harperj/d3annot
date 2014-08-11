var Papa = require('../../lib/papaparse');
var _ = require('underscore');
var angular = require('../../lib/angular');

var restylingApp = angular.module('restylingApp');

restylingApp.controller('AddTableController', ['$scope', 'VisDataService',
    function($scope, visDataService) {
        window.dataScope = $scope;
        $scope.data = visDataService.visData;
        $scope.ids = visDataService.ids;

        $scope.createMarks = function(schemaID) {
            var schema = $scope.data[schemaID];
            var createMarksMessage = {
                type: "create",
                ids: schema.ids
            };
            visDataService.sendMessage(createMarksMessage);
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
                numNodes: $scope.loadedSchemaDataLength,
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
    }
]);