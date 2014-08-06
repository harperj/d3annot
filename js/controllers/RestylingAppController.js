var _ = require('underscore');
var angular = require('../../lib/angular');

var restylingApp = angular.module('restylingApp');

restylingApp.controller('RestylingAppController', ['$scope', 'ChromeMessageService',
    function($scope, chromeMessageService) {
        $scope.selectedSchema = 0;
        $scope.data = [];
        $scope.selectedRows = [];

        // Load data from the visualization as it arrives
        function setupMessageServiceData (dataObj) {
            console.log('data received');
            var ids = dataObj.ids;
            var data = dataObj.schematized;
            _.each(data, function(schema, i) {
                data[i].numNodes = schema.ids.length;
            });
            console.log("data received");
            console.log(data);
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
    }
]);