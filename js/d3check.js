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
    }
})();