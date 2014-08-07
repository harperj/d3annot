var angular = require('../../lib/angular');

var restylingApp = angular.module('restylingApp');

restylingApp.factory('Schema', function () {
    function Schema(data, attrs, ids, mappings) {
        this.data = data;
        this.attrs = attrs;
        this.ids = ids;
        this.mappings = mappings;
    }

    Schema.fromDeconData = function(deconData) {
        return new User(
            deconData.data,
            deconData.attrs,
            deconData.ids,
            deconData.mappings
        );
    };

    return Schema;
});