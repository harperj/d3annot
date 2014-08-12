var angular = require('../lib/angular');
var $ = require('jquery');
var _ = require('underscore');

var restylingApp = angular.module('restylingApp');

restylingApp.service('VisDataService', ['Schema',  function(Schema) {
    var port;
    var visData = [];
    var ids = [];
    var selectedSchema = 0;

    function updateNodes(attr, val, ids) {
        var message = {
            type: "update",
            attr: attr,
            val: val,
            ids: ids
        };
        sendMessage(message);
        visData[selectedSchema].updateWithMessage(message);
    }

    function selectSchema(schema) {
        console.log(visData);
        selectedSchema = visData.indexOf(schema);
        var selectedRows = [];
        console.log(selectedSchema);
    }

    function getSelected() {
        return visData[selectedSchema];
    }

    function updateDataWithLinearMapping(mapping, schemaInd) {
        // update the attribute values according to the new mapping
        var attrArray = visData[schemaInd].attrs[mapping.attr];
        var schema = visData[schemaInd];
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

            updateNodes(mapping.attr, newAttrVal, [visData[schemaInd].ids[ind]]);
        });
    };

    chrome.runtime.onMessage.addListener(function(message, sender) {
        if (message.type === "restylingData") {
            var data = message.data;
            data = $.extend([], data);

            ids = ids.concat(data.ids);

            _.each(data.schematized, function(schema) {
                visData.push(Schema.fromDeconData(schema));
            });

            port = chrome.tabs.connect(sender.tab.id, {name: 'd3decon'});
        }
    });

    function sendMessage(message) {
        port.postMessage(message);
    }

    return {
        ids: ids,
        visData: visData,
        sendMessage: sendMessage,
        updateDataWithLinearMapping: updateDataWithLinearMapping,
        updateNodes: updateNodes,
        selectSchema: selectSchema,
        getSelected: getSelected,
        selectedSchema: selectedSchema
    }
}]);