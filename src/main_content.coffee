document.addEventListener 'dataExportEvent', (event) ->
	data = event.detail
	chrome.runtime.sendMessage {type: "init"}, (response) ->
		chrome.runtime.sendMessage {type: "syn", payload: data}
		
chrome.runtime.onConnect.addListener (port) ->
	console.assert (port.name == "d3annot")
	port.onMessage.addListener displayResponse
	
createReplacement = (node) ->
	square = (document.createElementNS "http://www.w3.org/2000/svg", "rect")
	console.log node
	$.each node.attributes, (j, attr) ->
		#if attr.name == "cx"
		square.setAttribute "x", -parseFloat(d3.select(node).attr("r"))
		#else if attr.name == "cy"
		square.setAttribute "y", -parseFloat(d3.select(node).attr("r"))
		if attr.name == "r"
			square.setAttribute "width", 2*parseFloat(attr.value)
			square.setAttribute "height", 2*parseFloat(attr.value)
		else square.setAttribute attr.name, attr.value
		
		square.__data__ = node.__data__;
	return square
	
displayResponse = (msg) ->
	console.log msg
	if msg.type == "circleTrans"
		($ 'circle').each () ->			
			$(@).parent().append(createReplacement(@))
			$(@).hide()
			#$(@).hide()
			#console.log(square)
		#$('svg').each () ->
			#$(@).html($(@).html())
	
injectJS = (url) ->
	script = (document.createElement 'script')
	script.type = 'text/javascript'
	script.src = url
	document.body.appendChild script
	
injectCSS = (url) ->
	link = (document.createElement 'link')
	link.rel = "stylesheet"
	link.href = url
	document.body.appendChild link

doInject = () ->
	console.log "injecting"
	injectJS (chrome.extension.getURL('injected.js'));

waitToInject = () ->
	setTimeout doInject, 5
	
injectJS (chrome.extension.getURL 'lib/jquery.js')
injectJS (chrome.extension.getURL 'lib/FileSaver.js')
# wait to inject final script so that dependencies will be picked up first
waitToInject()