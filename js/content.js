"use strict";

(function () {
    var restylingPort;

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
                document.addEventListener('deconDataEvent', function(event) {
                    initRestylingInterface(event.detail);
                });
            }
        });
    }

    function initRestylingInterface(visData) {
        //saveAs(new Blob([JSON.stringify(visData)]), "deconOutput.json");
        chrome.runtime.sendMessage({type: "initRestyling"}, function() {
            chrome.runtime.sendMessage({type: "restylingData", data: visData});
        });
        chrome.runtime.onConnect.addListener(function(port) {
            if (port.name !== "d3decon") {
                console.error("ERROR: Wrong port name.");
            }
            restylingPort = port;
            restylingPort.onMessage.addListener(restylingPortHandler)
        });
    }

    function restylingPortHandler(message) {
        if (message.type === "update") {
            console.log(message);
            var evt = document.createEvent("CustomEvent");
            evt.initCustomEvent("updateEvent", true, true, message);
            document.dispatchEvent(evt);
        }
        else {
            console.error("Unknown message received.");
        }
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
        injectJS(chrome.extension.getURL('lib/simple_statistics.js'));
        injectJS(chrome.extension.getURL('lib/sylvester.js'));
        injectJS(chrome.extension.getURL('js/VisUpdater.js'));
        injectJS(chrome.extension.getURL('js/VisDeconstruct.js'));
        injectJS(chrome.extension.getURL('js/injected.js'));
    }

    function injectD3Check() {
        console.log("injecting d3 checker");
        injectJS(chrome.extension.getURL('js/d3check.js'));
    }

    deconSetup();
})();
