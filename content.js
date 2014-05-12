"use strict";

(function () {

    if (window === top) {
        chrome.extension.onRequest.addListener(function(req, sender, sendResponse) {
            if (req.type == "d3Check") {
                // Inject code to check if D3 is included with the page
                injectD3Check();

                // Injected script will send a custom event with boolean
                document.addEventListener('d3FoundEvent', function(event) {
                    sendResponse(event.detail);
                });
            }
            else if (req.type == "pageActionClicked") {
                // User clicked the page action, so we inject the main plugin script
                deconSetup();
            }
        });
    }

    function injectJS(url) {
        var script;
        script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = url;
        return document.body.appendChild(script);
    }

    function deconSetup () {
        // Inject scripts for the deconstruction process
        doInject();
    }

    function doInject () {
        console.log("injecting main code");
        injectJS(chrome.extension.getURL('lib/jquery.js'));
        injectJS(chrome.extension.getURL('lib/underscore.js'));
        injectJS(chrome.extension.getURL('lib/FileSaver.js'));
        injectJS(chrome.extension.getURL('injected.js'));
    }

    function injectD3Check() {
        console.log("injecting d3 checker");
        injectJS(chrome.extension.getURL('d3check.js'));
    }

})();
