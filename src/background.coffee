chrome.runtime.onMessage.addListener (message, sender, sendResponse) -> 
	if message.type == "init"
		chrome.windows.create({url : chrome.extension.getURL('display.html')})
		sendResponse({ })