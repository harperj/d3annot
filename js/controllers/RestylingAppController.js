var _ = require('underscore');
var angular = require('../../lib/angular');

var restylingApp = angular.module('restylingApp');

restylingApp.controller('RestylingAppController', ['$scope', 'VisDataService',
    function($scope, visDataService) {
        $scope.selectedSchema = 0;
        $scope.data = visDataService.visData;
        $scope.ids = visDataService.ids;
        $scope.selectedRows = [];

        $scope.selectSchema = function(schema) {
            console.log($scope.data);
            $scope.selectedSchema = $scope.data.indexOf(schema);
            $scope.selectedRows = [];
            console.log($scope.selectedSchema);
        };

        $scope.doUpdate = function(updateMessage, schema) {
            schema.updateWithMessage(updateMessage);
            visDataService.sendMessage(updateMessage);
        };

        $scope.updateDataWithLinearMapping = function(mapping, schemaInd) {
            // update the attribute values according to the new mapping
            var attrArray = $scope.data[schemaInd].attrs[mapping.attr];
            var schema = $scope.data[schemaInd];
            _.each(attrArray, function(attrVal, ind) {
                var newAttrVal = 0;
                _.each(mapping.params.coeffs, function(coeff, coeffInd) {
                    if (coeffInd < mapping.data.length) {
                        newAttrVal += coeff * schema.data[mapping.data[coeffInd]][ind];
                        console.log(coeff * schema.data[mapping.data[coeffInd]][ind] + "+");
                    }
                    else {
                        console.log(coeff);
                        newAttrVal += coeff;
                    }
                });

                var message = {
                    type: "update",
                    attr: mapping.attr,
                    val: newAttrVal,
                    ids: [$scope.data[schemaInd].ids[ind]]
                };
                $scope.doUpdate(message, $scope.data[schemaInd]);
            });
        };
    }
]);