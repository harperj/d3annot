
// x1, y1 would be mouse coordinates onmousedown
// x2, y2 would be mouse coordinates onmouseup
// all coordinates are considered relative to the document
function rectangleSelect(selector, x1, y1, x2, y2) {
    var elements = [];
    jQuery(selector).each(function() {
        var $this = jQuery(this);
        var offset = $this.offset();
        var x = offset.left;
        var y = offset.top;
        var w = $this.width();
        var h = $this.height();

        if (x >= x1 &&
            y >= y1 &&
            x + w <= x2 && 
            y + h <= y2) {
            // this element fits inside the selection rectangle
            elements.push($this.get(0));
        }
    });
    return elements;
}


//This listener will relay data to the background page from the injected script
document.addEventListener('dataExportEvent', function (event) {
  var data = event.detail;
	// Send an init message to the background window to open the display
  chrome.runtime.sendMessage({type: "init"}, function(response) {
		// Send a sync message to the display, which will initialize a port
  	chrome.runtime.sendMessage({type: "syn", payload: data});
  });
});

chrome.runtime.onConnect.addListener(function(port) {
	console.assert(port.name == "d3annot");
	
	port.onMessage.addListener(displayResponse);
});

function displayResponse(msg) {
	console.log(msg.message);
}

function injectJS(url) {
  var script = document.createElement('script');
  script.type = "text/javascript";
  script.src = url;
  document.body.appendChild(script);
}

function injectCSS(url) {
	var link = document.createElement('link');
	link.rel = "stylesheet";
	link.href = url;
	document.body.appendChild(link);
}

injectCSS("//ajax.googleapis.com/ajax/libs/jqueryui/1.10.4/themes/smoothness/jquery-ui.css");
injectCSS('//ajax.aspnetcdn.com/ajax/jquery.dataTables/1.9.4/css/jquery.dataTables.css');
injectJS(chrome.extension.getURL('lib/jquery.min.js'));
injectJS(chrome.extension.getURL('lib/FileSaver.js'));
injectJS('http://ajax.googleapis.com/ajax/libs/jqueryui/1.10.4/jquery-ui.min.js');
injectJS(chrome.extension.getURL('lib/jquery.dataTables.min.js'));
injectJS(chrome.extension.getURL('lib/spectrum.js'));


function waitToInject() {
  setTimeout(doInject, 5);
}

function doInject() {
  console.log("injecting");
  injectJS(chrome.extension.getURL('injected.js'));
}

waitToInject();