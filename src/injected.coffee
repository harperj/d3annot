prevElement = null
elemToLink = null
lastNode = null
num_links = 0

class VisUpdater
	constructor: ->
		
		
	extractDataFromSelection: (selection) =>
		data = []
		id_counter = 0
		elem_map = []
		console.log selection
		selection.each (d, i) ->
			item = {}
			console.log this.tagName
			if this.tagName in ['g', 'svg']
				return true
				
			item.id = id_counter
			id_counter++;
			elem_map.push( "current": d3.select(this).node() )
			item.d3Data = d3.select(this).node().__data__
			item.nodeText = this.outerHTML
			item.cssText = window.getComputedStyle(this, null).cssText
			data.push(item)
		@elem_map = elem_map
		return data
		
	exportDataToVis: (data) ->
		@data = data
		@exportDataToVis(@data)
		
	exportSelectorDataToVis: (selector) ->
		@data = @extractDataFromSelection(d3.selectAll(selector))
		@exportDataToVis(@data)
		
	exportDataToVis: (data) ->
		evt = document.createEvent "CustomEvent"
		evt.initCustomEvent("dataExportEvent", true, true, data)
		document.dispatchEvent(evt)
		
	getUpdatedClone: (id, attr, val) ->
		clone = $(@elem_map[id]["current"]).clone(true)[0]
		if attr is "radius"
			attr = "r"
		else if attr is "color"
			attr = "fill"
		d3.select(clone).attr(attr, val);
		return clone
		
	update: (updateData) =>
		newNodes = []
		if updateData.attr != "shape"
			for id in updateData.nodes
				newNode = @getUpdatedClone(id, updateData.attr, updateData.val)
				newNodes.push(newNode)
		for i in [0..newNodes.length-1]
			oldNodeData = @elem_map[updateData.nodes[i]]
			console.log oldNodeData
			if not oldNodeData.hasOwnProperty("orig")
				oldNodeData["orig"] = oldNodeData["current"]
				oldNodeData["current"] = newNodes[i]
				$(oldNodeData["orig"]).parent().append(newNodes[i])
				$(newNodes[i]).html($(newNodes[i]).html())
				$(oldNodeData["orig"]).hide()
			else
				$(oldNodeData["current"]).remove()
				oldNodeData["current"] = newNodes[i] 
				$(oldNodeData["orig"]).parent().append(newNodes[i])
				
				
visUpdater = new VisUpdater()
document.addEventListener 'visUpdateEvent', (event) ->
	console.log event
	visUpdater.update(event.detail)

extractHoveredElement = (elem) ->
	elem = elem.target or elem.srcElement
	elem_children = $(elem).find('*')
	visUpdater.exportDataToVis(visUpdater.extractDataFromSelection(d3.selectAll(elem_children)))
	d3.selectAll('.mouseOn').classed("mouseOn", false)
	$(document).unbind('click', extractHoveredElement)
	
saveDataJSON = (selector) ->
	data = d3.selectAll(selector).data()
	dataString = JSON.stringify(data, undefined, 2)
	blob = new Blob([dataString],
		type: "text/json;charset=" + document.characterSet)
	saveAs(blob, "extracted_data.json")

rightClickMenu = $("<ul class='custom-menu'>
		<li data-action='extract_tag'>Extract data by tag</li>
		<li data-action='extract_container'>Extract data by container</li>
	</ul>")
rightClickMenu.appendTo("body").hide()

$(document).bind "contextmenu", (event) ->
	event.preventDefault()
	lastNode = event.target
	$(".custom-menu").toggle(100).css
		display: "inline"
		top: event.pageY + "px"
		left: event.pageX + "px"

$(document).on "click", (event) ->
	$(".custom-menu").hide(100)

###
($ ".custom-menu li").on "mouseover", (event) ->
	if (($ this).attr "data-action") == "extract_tag"
		(d3.selectAll lastNode.tagName).classed "mouseOn", true
###
	
	
$(".custom-menu li").click (event) ->
	event.stopPropagation()
	switch $(this).attr "data-action"
		when "extract_tag" then visUpdater.exportSelectorDataToVis(lastNode.tagName)
		when "extract_container" then $(document).bind('click', extractHoveredElement)