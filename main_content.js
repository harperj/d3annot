"use strict";
(function () {

    if (window === top) {
        chrome.extension.onRequest.addListener(function(req, sender, sendResponse) {
            waitToInject();
            sendResponse(findD3());
        });
    }

    var injectJS = function (url) {
        var script;
        script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = url;
        return document.body.appendChild(script);
    };

    var doInject = function () {
        console.log("injecting");
        injectJS(chrome.extension.getURL('lib/jquery.js'));
        injectJS(chrome.extension.getURL('lib/underscore.js'));
        injectJS(chrome.extension.getURL('lib/FileSaver.js'));
        return injectJS(chrome.extension.getURL('injected.js'));
    };

    var waitToInject = function () {
        return setTimeout(doInject, 5);
    };

})();
