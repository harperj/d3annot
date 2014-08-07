var angular = require('../lib/angular');
var $ = require('jquery');

var restylingApp = angular.module('restylingApp');

restylingApp.service('ChromeMessageService', function() {
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