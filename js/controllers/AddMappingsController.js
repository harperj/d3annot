var _ = require('underscore');
var angular = require('../../lib/angular');

var restylingApp = angular.module('restylingApp');

restylingApp.controller('AddMappingsController', ['$scope', 'VisDataService',
    function($scope, visDataService) {
    $scope.dataFieldsSelected = [];
    $scope.attrSelected = "";
    $scope.newNominalMappingData = {};
    $scope.newLinearMappingData = [];

    $scope.data = visDataService.visData;
    $scope.ids = visDataService.ids;

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
        if ($scope.data.length > 0)
            return _.without(_.keys($scope.data[$scope.selectedSchema].data), $scope.dataFieldsSelected);
        return 0;
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
                &&  $scope.dataFieldsSelected.length < _.keys($scope.data[$scope.selectedSchema].data).length);
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