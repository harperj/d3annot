class VisRemapper
	constructor: ->
		# Listener for data export from injected script.
		document.addEventListener 'dataExportEvent', (event) =>
			@data = event.detail
			chrome.runtime.sendMessage type: "init", (response) =>
				chrome.runtime.sendMessage 
					type: "syn"
					payload: @data
		
		# Listener for mark data to update
		document.addEventListener 'markUpdateEvent', (event) =>
			payload = event.detail
			chrome.runtime.sendMessage
				type: "markUpdate"
				payload: payload
		
		chrome.runtime.onConnect.addListener (port) =>
			console.assert(port.name == "d3annot")
			port.onMessage.addListener(@displayResponse)
	
	displayResponse: (msg) ->
		console.log msg
		if msg.type == "update"
			evt = document.createEvent "CustomEvent"
			evt.initCustomEvent("visUpdateEvent", true, true, msg)
			document.dispatchEvent(evt)
		  
		


createReplacement = (node) ->
	square = document.createElementNS("http://www.w3.org/2000/svg", "rect")
	square.setAttribute("x", -parseFloat(d3.select(node).attr("r")))
	square.setAttribute("y", -parseFloat(d3.select(node).attr("r")))
	
	$.each node.attributes, (j, attr) ->
		if attr.name == "cx"
			square.setAttribute("x", parseFloat(attr.value) - parseFloat(d3.select(node).attr("r")))
		else if attr.name == "cy"
			square.setAttribute("y", parseFloat(attr.value) - parseFloat(d3.select(node).attr("r")))
		else if attr.name == "r"
			square.setAttribute("width", 2 * parseFloat(attr.value))
			square.setAttribute("height", 2 * parseFloat(attr.value))
		else
			square.setAttribute(attr.name, attr.value)
		square.__data__ = node.__data__;
	return square
	
injectJS = (url) ->
	script = document.createElement('script')
	script.type = 'text/javascript'
	script.src = url
	document.body.appendChild(script)
	
injectCSS = (url) ->
	link = document.createElement('link')
	link.rel = "stylesheet"
	link.href = url
	document.body.appendChild(link)

doInject = () ->
	console.log "injecting"
	injectJS(chrome.extension.getURL('injected.js'));

waitToInject = () ->
	setTimeout(doInject, 5)

$(document).ready ->
	remapper = new VisRemapper()	

injectJS(chrome.extension.getURL('lib/jquery.js'))
# wait to inject final script so that dependencies will be picked up first
waitToInject()