var angular = require('../../lib/angular');
var _ = require('underscore');
_.mixin( require('underscore.deferred') );
var Miso = require('miso.dataset');

var restylingApp = angular.module('restylingApp');

function Schema(data, attrs, nodeAttrs, ids, mappings) {
    this.data = data;
    this.attrs = attrs;

    var columnData = [];
    _.each(data, function(val, key) {
        columnData.push({
            name: key,
            data: val
        });
    });
    _.each(attrs, function(val, key) {
        columnData.push({
            name: key,
            data: val
        });
    });

    this.numFields = Object.keys(data).length;
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

Schema.prototype.attrIsMapped = function(attr) {
    return _.find(this.mappings, function(mapping) {
        return mapping.attr == attr;
    }) !== undefined;
};

Schema.prototype.uniqVals = function(fieldName, isAttr) {
    var allVals;
    if (isAttr) {
        allVals = this.attrs[fieldName];
    }
    else {
        allVals = this.data[fieldName];
    }
    return _.uniq(allVals);
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


restylingApp.factory('Schema', function () {
    return Schema;
});

module.exports = Schema;