"use strict";

(function () {
    var restylingApp = angular.module('restylingApp', []);

    restylingApp.factory('chromeMessageService', function() {
        return function (callback) {
            chrome.runtime.onMessage.addListener(function (message) {
                if (message.type === "restylingData") {
                    var data = message.data;
                    data = $.extend({}, data);
                    callback(data);
                }
            });
        }
    });

    restylingApp.controller('RestylingAppController', ['$scope', 'chromeMessageService',
        function($scope, chromeMessageService) {

            // Load data from the visualization as it arrives
            chromeMessageService(function (data) {
                _.each(data, function(schema, i) {
                    data[i].numNodes = schema.nodes.length;
                });
                $scope.data = data;
                $scope.$apply();
            });

        }]);

    restylingApp.controller('DataTableController', ['$scope', 'orderByFilter',
    function($scope, orderByFilter) {

    }]);

    restylingApp.controller('MappingsListController', ['$scope',
    function($scope) {

    }]);
})();