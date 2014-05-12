"use strict";
(function () {
    chrome.tabs.onUpdated.addListener(function (tabId, change, tab) {
        if (change.status == "complete") {
            checkForD3(tabId);
        }
    });

    function checkForD3(tabId) {
        chrome.tabs.sendRequest(tabId, {type: "d3Check"}, function (hasD3) {
            if (!hasD3) {
                chrome.pageAction.hide(tabId);
            } else {
                chrome.pageAction.show(tabId);
            }
        });
    }

    chrome.pageAction.onClicked.addListener(function (tab) {
        chrome.tabs.sendRequest(tab.id, {type: "pageActionClicked"});
    });

})();
