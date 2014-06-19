"use strict";
(function () {
    var updater;

    /** Binds right click to initiate deconstruction on the root SVG node. **/
    $(document).bind("contextmenu", function (event) {
        var ancestorSVG = $(event.target).closest("svg");
        if (ancestorSVG.length > 0) {
            event.preventDefault();
            return visDeconstruct(ancestorSVG);
        }
    });

    document.addEventListener("updateEvent", function(event) {
        var updateMessage = event.detail;
        updater.updateNodes(updateMessage.ids, updateMessage.attr, updateMessage.val);
    });

    /**
     * Accepts a top level SVG node and deconstructs it by extracting data, marks, and the
     * mappings between them.
     * @param svgNode - Top level SVG node of a D3 visualization.
     */
    function visDeconstruct(svgNode) {
        var dataNodes = VisDeconstruct.extractData(svgNode);
        var attrData = VisDeconstruct.extractVisAttrs(dataNodes.nodes);
        var nodeAttrData = VisDeconstruct.extractNodeAttrs(dataNodes.nodes);
        var schematizedData = VisDeconstruct.schematize(dataNodes.data, dataNodes.ids, attrData, nodeAttrData);
        console.log(schematizedData);
        _.each(schematizedData, function(schema, i) {
            schematizedData[i].mappings = VisDeconstruct.extractMappings(schema);
            VisDeconstruct.extractMultiLinearMapping(schema);
        });

        updater = new VisUpdater(svgNode, dataNodes.nodes, dataNodes.ids, schematizedData);

        console.log(schematizedData);



        // Now send a custom event with dataNodes to the content script
        var evt = document.createEvent("CustomEvent");
        evt.initCustomEvent("deconDataEvent", true, true, schematizedData);
        document.dispatchEvent(evt);
    }

})();