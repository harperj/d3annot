var _ = require('underscore');
var angular = require('../../lib/angular');

var restylingApp = angular.module('restylingApp');

restylingApp.controller('RestylingAppController', ['$scope', 'VisDataService',
    function($scope, visDataService) {
//        $scope.selectedSchema = 0;
        window.dataService = visDataService;
        $scope.data = visDataService.visData;
//        $scope.ids = visDataService.ids;
//        $scope.selectedRows = [];
//


//        $scope.doUpdate = function(updateMessage, schema) {
//            schema.updateWithMessage(updateMessage);
//            visDataService.sendMessage(updateMessage);
//        };
    }
]);