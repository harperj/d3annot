var angular = require('../../lib/angular');
var _ = require('underscore');
var VisDeconstruct = require('../VisDeconstruct');

var restylingApp = angular.module('restylingApp');

restylingApp.controller('MappingsListController', ['$scope', 'VisDataService',
    function($scope, visDataService) {
        $scope.data = visDataService.visData;
        $scope.ids = visDataService.ids;
        $scope.selectedSchema = visDataService.selectedSchema;

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
            var schema = visDataService.getSelected();
//            var mappingInd = schema.mappings.indexOf(mapping);

            var replaceVal;
            if (mapping.type === "nominal") {
                replaceVal = schema.attrs[mapping.attr][0];
            }
            else {
                replaceVal = mapping.params.attrMin;
            }

            visDataService.updateNodes(mapping.attr, replaceVal, schema.ids);
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

                visDataService.updateNodes(mapping.attr, newVal, ids);
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
    }
]);