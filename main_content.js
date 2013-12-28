
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

        if (x >= x1 
            && y >= y1 
            && x + w <= x2 
            && y + h <= y2) {
            // this element fits inside the selection rectangle
            elements.push($this.get(0));
        }
    });
    return elements;
}

function injectJS(url) {
	var script = document.createElement('script');
	script.type = "text/javascript";
	script.src = url;
	document.body.appendChild(script);
}

injectJS(chrome.extension.getURL('lib/jquery.min.js'));
injectJS(chrome.extension.getURL('FileSaver.js'));
function waitToInject() {
	setTimeout(doInject, 5);
}

function doInject() {
	console.log("injecting");
	injectJS(chrome.extension.getURL('injected.js'));
}

waitToInject();