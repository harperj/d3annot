"use strict";
(function () {

    var evt = document.createEvent("CustomEvent");
    if (typeof d3 != 'undefined') {
        evt.initCustomEvent("d3FoundEvent", true, true, true);
        document.dispatchEvent(evt);
    }
    else {
        evt.initCustomEvent("d3FoundEvent", true, true, false);
        document.dispatchEvent(evt);
        return;
    }

    $(document).bind("contextmenu", function (event) {
        var ancestorSVG = $(event.target).closest("svg");
        if (ancestorSVG.length > 0) {
            event.preventDefault();
            return visDeconstruct(ancestorSVG);
        }
    });

    var visDeconstruct = function (svgNode) {
        var dataNodes = extractData(svgNode);
        console.log(dataNodes);
    };

    var markGeneratingTags = ["circle", "ellipse", "rect", "path", "polygon", "text"];

    var extractData = function (svgNode) {
        var svgChildren = $(svgNode).find('*');
        var data = [];

        for (var i = 0; i < svgChildren.length; ++i) {
            var node = svgChildren[i];
            if (node.__data__ && _.contains(markGeneratingTags, node.tagName.toLowerCase())) {
                data.push({
                    node: node,
                    id: i
                });
            }
        }

        return data;
    };

})();
