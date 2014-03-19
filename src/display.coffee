# compares whether two arrays contain the same values
unorderedEquals = (arr1, arr2) ->
	$(arr1).not(arr2).length == 0 && $(arr2).not(arr1).length == 0

class VisConnector
	constructor: () ->
		chrome.runtime.onMessage.addListener (message, sender, sendResponse) =>
			if message.type == "syn"
				@initConnection(sender.tab.id)
				@dataSets = @processPayload(message.payload)
				#@getMappings()
				@tableViews = []
				$.each @dataSets, (i, dataSet) =>
					@tableViews.push (new TableView(dataSet, i))
		
	initConnection: (tabId) ->
		@port = chrome.tabs.connect tabId, {name: 'd3annot'}
		
	getMappings: () =>
		$.each @data[0].visAttr, (i, visAttr) =>
			$.each @data[0].d3Schema, (j, dataAttr) =>
				console.log "(#{visAttr} - #{dataAttr})"
		
	circleTrans: () =>
		console.log "sending msg"
		@port.postMessage {type: "circleTrans"}
		
	prepareMarkForDisplay: (node, cssText) ->
		node.style.cssText = cssText
		tagName = $(node).prop("tagName").toLowerCase()  #lower case b/c jquery inconsistency
	
		# circle case
		if tagName == "circle" or tagName == "ellipse"
			d3.select(node).attr "cx", 50
			d3.select(node).attr "cy", 50
			return node
		return null
		
	# How will we handle nonexistant fields?
	extractVisData: (node, cssText) ->
		visRow = {}
		nodeAttrs = {}
		$.each node.attributes, (j, attr) ->
			nodeAttrs[attr.name] = attr.value
		
		visRow["shape"] = node.tagName.toLowerCase();
		visRow["color"] = nodeAttrs["fill"]
		visRow["stroke"] = nodeAttrs["stroke"]
		visRow["stroke-width"] = nodeAttrs["stroke-width"]
		if visRow["shape"] == "circle"
			#visRow["x-position"] = nodeAttrs["cx"]
			#visRow["y-position"] = nodeAttrs["cy"]
			visRow["radius"] = nodeAttrs["r"]
		else if visRow["shape"] == "rect"
			#visRow["x-position"] = nodeAttrs["x"]
			#visRow["y-position"] = nodeAttrs["y"]
			visRow["width"] = nodeAttrs["width"]
			visRow["height"] = nodeAttrs["height"]
		return visRow
		
	# This is a little hacky -- perhaps think about it a bit more later
	extractVisSchema: (node) ->
		shape = node.tagName.toLowerCase();
		if shape == "circle"
			return {"shape": [], "color": [], "stroke": [], \ 
								"stroke-width": [], "radius": []}
		else if shape == "rect"
			return {"shape": [], "color": [], "stroke": [], \ 
								"stroke-width": [], "width": [], "height": []}
		else
			return {"shape": [], "color": [], "stroke": [], \ 
								"stroke-width": [] }
		
	findSchema: (data, d3Data, tagName) ->
		thisSchema = Object.keys(d3Data)
		thisSchema.push(tagName)
		console.log data
		console.log thisSchema
		found = -1
		$.each data, (i, dataSet) ->
			if unorderedEquals(dataSet.schema, thisSchema)
				found = i
				return false
		return found
		
	processPayload: (payload) =>
		data = []
		schema_count = -1
		console.log payload
	
		$.each payload, (i, obj) =>
			d3Data = obj.d3Data
			node = $(obj.nodeText)[0]
			schema = -1
			
			# object types require some schema thought
			if d3Data instanceof Object
				# check to see if we have a new schema	
				schema = @findSchema(data, d3Data, node.tagName)
				if schema == -1
					# if we find a property that isn't in a previous schema, create a new table.
					newSchema = Object.keys(d3Data)
					# schema should also contain the tagname/shape
					newSchema.push(node.tagName)
					schema_count++
					schema = schema_count
					data[schema] = {}
					data[schema].schema = newSchema
					# set the schema for data and visual attributes of this set
					data[schema].d3Data = {}
					$.each Object.keys(d3Data), (j, key) ->
						data[schema].d3Data[key] = []
						
					data[schema].visData = @extractVisSchema(node)
						
				# now let's add the data item to our structure
				$.each d3Data, (prop, val) ->
					if data[schema].d3Data.hasOwnProperty(prop)
						data[schema].d3Data[prop].push(val)
					else
						data[schema].d3Data[prop] = [val]
			
			else
				unless d3Data
					return true
				# we just have a scalar data element
				schema_count++
				schema = schema_count
				data[schema] = {}
				data[schema].schema = ["scalar"]
				data[schema].d3Data = {"scalar": [d3Data]}
				data[schema].visData = @extractVisSchema(node)
		
			# finally extract the visual attributes
			visRow = @extractVisData(node, obj.cssText)
			$.each Object.keys(data[schema].visData), (j, key) ->
				data[schema].visData[key].push(visRow[key])
		
			# and add the node
			if data[schema].hasOwnProperty('node')
				data[schema]['node'].push(@prepareMarkForDisplay(node, obj.cssText));
			else
				data[schema]['node'] = [@prepareMarkForDisplay(node, obj.cssText)];
			
		
		$.each data, (i, dataSet) ->
			dataSet.numEls = dataSet.d3Data[dataSet.schema[0]].length
			
		return data
	
		
class TableView
	constructor: (dataSet, @index) ->
		@buildTable(dataSet)
	
	buildTable: (dataSet) =>
		content_div = $ '<div class="container"></div>'
		content = $ "<table id=\"example#{@index}\" class=\"display\"></table>"
		foot = $ '<tfoot></tfoot>'
		head = $ '<thead></thead>'
		
		# build a table
		hrow = $ '<tr></tr>'
		for prop of dataSet.d3Data
			th = $ '<th>' + prop + '</th>'
			$(hrow).append th
		for attr of dataSet.visData
			th = $ '<th>' + attr + '</th>'
			$(hrow).append th
			
		# add a final header for the mark
		unless dataSet['node'] == null
			$(hrow).append $ '<th>Mark</th>'
		
		$(head).append hrow
		$(content).append head
		
		for ind in [0..(dataSet.numEls-1)]
			row = $ '<tr></tr>'
			for prop of dataSet.d3Data
				td = $ '<td>' + dataSet.d3Data[prop][ind] + '</td>'
				$(row).append td
				
			for attr of dataSet.visData
				td = $ '<td>' + dataSet.visData[attr][ind] + '</td>'
				$(row).append td
				
			# add the mark
			console.log dataSet
			unless dataSet['node'] == null
				unless dataSet['node'][ind] == null
					td = $ '<td></td>'
					svg = $ '<svg width="100" height="100"></svg>'
					$(svg).append dataSet['node'][ind]
					$(td).append svg
					$(row).append td
			
			$(content).append row
		
		$(content).append foot
		$(content_div).append content
		$('body').append content_div
		
		dataTable = $("#example#{@index}").dataTable({
			"paging": false
		});
		$.each dataTable.fnSettings().aoColumns, (i, col) ->
			dataTable.fnSettings().aoColumns[i].bSortable = false;
			
		$('svg').each () ->
			$(@).html $(@).html()
	

###
 * Converts an RGB color value to HSL. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
 * Assumes r, g, and b are contained in the set [0, 255] and
 * returns h, s, and l in the set [0, 1].
 *
 * @param   Number  r       The red color value
 * @param   Number  g       The green color value
 * @param   Number  b       The blue color value
 * @return  Array           The HSL representation
###

rgbToHsl = (r, g, b) ->
	r /= 255
	g /= 255
	b /= 255
	max = Math.max r, g, b
	min = Math.min r, g, b
	h = (max + min) / 2
	s = (max + min) / 2
	l = (max + min) / 2
	
	# if achromatic
	if max == min
		h = 0
		s = 0
	else
		d = max - min
		s = if l > 0.5 then d / (2 - max - min) else d / (max + min)
		switch max
			when r then h = (g - b) / d + (if g < b then 7 else 0)
			when g then h = (b - r) / d + 2
			when b then h = (r - g) / d + 4
		
		h /= 6
	return [h, s, l]

hexToRgb = (hexString) ->
	if (typeof hexString) != "string"
		console.error "Got incorrect type in hexToRgb"
		return null
		
	if hexString.charAt(0) == "#"
		hexString = (hexString.substring 1, 7)
	
	if hexString.length == 3
		hexString = hexString[0] + hexString[0] \
			+ hexString[1] + hexString[1] \
			+ hexString[2] + hexString[2]
	
	r = (parseInt (hexString.substring 0, 2), 16)
	g = (parseInt (hexString.substring 2, 4), 16)
	b = (parseInt (hexString.substring 4, 6), 16)
	return [r, g, b]
		
window.hexToRgb = hexToRgb


($ document).ready () ->
	connector = new VisConnector()
	($ '#circleTrans').on 'click', () ->
		console.log(connector);
		connector.circleTrans()