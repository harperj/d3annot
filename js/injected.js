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
        var deconstructed = VisDeconstruct.deconstruct(svgNode);

        updater = new VisUpdater(svgNode, deconstructed.dataNodes.nodes, deconstructed.dataNodes.ids,
            deconstructed.schematizedData);

        console.log(deconstructed.schematizedData);

        var deconData = {
            schematized: deconstructed.schematizedData,
            ids: deconstructed.dataNodes.ids
        };

        // Now send a custom event with dataNodes to the content script
        var evt = document.createEvent("CustomEvent");
        evt.initCustomEvent("deconDataEvent", true, true, deconData);
        document.dispatchEvent(evt);
    }

})();