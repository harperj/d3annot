prevElement = null
elemToLink = null
lastNode = null
num_links = 0

extractTagHoveredElement = (elem) ->
	exportDataToPlugin elem.tagName
	
extractClassHoveredElement = (elem) ->
	if (d3.select e)[0][0].classList.length == 0
		console.log "Empty class list"
	else
		console.log "non-empty class list"
			
extractHoveredElement = (elem) ->
	elem = elem.target or elem.srcElement
	elem_children = ($ elem).find '*'
	saveDataJSON elem_children
	(d3.selectAll '.mouseOn').classed "mouseOn", false
	($ document).unbind 'click', extractHoveredElement
	
saveDataJSON = (selector) ->
	data = (d3.selectAll selector).data()
	blob = new Blob([(JSON.stringify data, undefined, 2)], {
		type: "text/json;charset=" + document.characterSet
	})
	saveAs blob, "extracted_data.json"

exportDataToPlugin = (selector) ->
	data = []
	id_counter = 0
	console.log selector
	(d3.selectAll selector).each (d, i) ->
		item = {}
		item.id = id_counter
		id_counter++;
		item.d3Data = (d3.select this).node().__data__
		item.nodeText = this.outerHTML
		item.cssText = (window.getComputedStyle this, null).cssText
		data.push item
	
	evt = document.createEvent "CustomEvent"
	evt.initCustomEvent "dataExportEvent", true, true, data
	document.dispatchEvent evt

rightClickMenu = ($ "<ul class='custom-menu'>
		<li data-action='extract'>Extract data by class</li>
		<li data-action='extract_tag'>Extract data by tag</li>
		<li data-action='extract_container'>Extract data by container</li>
	</ul>")
(rightClickMenu.appendTo "body").hide()

($ document).bind "contextmenu", (event) ->
	event.preventDefault()
	lastNode = event.target
	($ ".custom-menu").toggle(100).css {
		display: "inline"
		top: event.pageY + "px"
		left: event.pageX + "px"
	}

($ document).on "click", (event) ->
	($ ".custom-menu").hide 100

###
($ ".custom-menu li").on "mouseover", (event) ->
	if (($ this).attr "data-action") == "extract_tag"
		(d3.selectAll lastNode.tagName).classed "mouseOn", true
###
	
($ ".custom-menu li").click (event) ->
	event.stopPropagation()
	
	switch ($ this).attr "data-action"
		when "extract" then (extractClassHoveredElement lastNode)
		when "extract_tag" then (extractTagHoveredElement lastNode)
		when "extract_container" then (($ document).bind 'click', extractHoveredElement)