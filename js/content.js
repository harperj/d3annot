"use strict";

var restylingPort;
var alreadyInjected = false;

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
            if (!alreadyInjected) {
                // User clicked the page action for the first time, so we inject the main plugin script
                injectJS(chrome.extension.getURL('build/injected.js'));
                alreadyInjected = true;
                document.addEventListener('deconDataEvent', function(event) {
                    initRestylingInterface(event.detail);
                });
            }
            else {
                // we have already injected the script -- let's just let it know we want to deconstruct again
                var evt = document.createEvent("CustomEvent");
                evt.initCustomEvent("deconEvent", true, true);
                document.dispatchEvent(evt);
            }
        }
    });
}

function initRestylingInterface(visData) {
    //saveAs(new Blob([JSON.stringify(visData)]), "deconOutput.json");
    chrome.runtime.sendMessage({type: "initRestyling"}, function() {
        console.log("Initializing restyling interface.");
        console.log(visData);
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
    console.log(message);
    if (message.type === "update") {
        var evt = document.createEvent("CustomEvent");
        evt.initCustomEvent("updateEvent", true, true, message);
        document.dispatchEvent(evt);
    }
    else if (message.type === "create") {
        var evt = document.createEvent("CustomEvent");
        evt.initCustomEvent("createEvent", true, true, message);
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

function injectD3Check() {
    console.log("injecting d3 checker");
    injectJS(chrome.extension.getURL('js/d3check.js'));
}