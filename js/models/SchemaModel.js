var angular = require('../../lib/angular');

var restylingApp = angular.module('restylingApp');

restylingApp.factory('Schema', function () {
    function Schema(data, attrs, nodeAttrs, ids, mappings) {
        this.data = data;
        this.attrs = attrs;
        this.ids = ids;
        this.mappings = mappings;
        this.nodeAttrs = nodeAttrs;
    }

    Schema.prototype.updateWithMessage = function(updateMessage) {
        var val = updateMessage.val;
        var attr = updateMessage.attr;
        var schema = this;
        _.each(updateMessage.ids, function(id, ind) {
            schema.attrs[attr][ind] = val;

            if (attr === "area") {
                schema.attrs["width"] = Math.sqrt(val);
            }
            else if (attr === "width" || attr === "height") {
                schema.attrs["area"] = schema.attrs["width"][ind]
                    * schema.attrs["height"][ind];
            }
        });
    };

    Schema.fromDeconData = function(deconData) {
        return new Schema(
            deconData.data,
            deconData.attrs,
            deconData.nodeAttrs,
            deconData.ids,
            deconData.mappings
        );
    };

    return Schema;
});