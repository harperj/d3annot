document.addEventListener 'dataExportEvent', (event) ->
	data = event.detail
	chrome.runtime.sendMessage {type: "init"}, (response) ->
		chrome.runtime.sendMessage {type: "syn", payload: data}
		
chrome.runtime.onConnect.addListener (port) ->
	console.assert (port.name == "d3annot")
	port.onMessage.addListener displayResponse
	
displayResponse = (msg) ->
	console.log msg.message
	
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
	
injectJS (chrome.extension.getURL 'lib/jquery.min.js')
injectJS (chrome.extension.getURL 'lib/FileSaver.js')
# wait to inject final script so that dependencies will be picked up first
waitToInject()