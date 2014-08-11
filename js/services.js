var angular = require('../lib/angular');
var $ = require('jquery');
var _ = require('underscore');

var restylingApp = angular.module('restylingApp');

restylingApp.service('VisDataService', ['Schema',  function(Schema) {
    var port;
    var visData = [];
    var ids = [];

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
        sendMessage: sendMessage
    }
}]);