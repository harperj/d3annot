class VisConnector
	constructor: () ->
		chrome.runtime.onMessage.addListener (message, sender, sendResponse) =>
			if message.type == "syn"
				@initConnection(sender.tab.id)
				@data = @processPayload(message.payload)
				#@getMappings()
				@tableView = new TableView(@data)
		
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
		
	processPayload: (payload) =>
		data = []
		schema_count = -1
		last_schema = []
	
		$.each payload, (i, obj) =>
			d3Data = obj.d3Data
			node = $(obj.nodeText)[0]
		
			# skip non-object data
			unless d3Data instanceof Object
				return true
		
			# check to see if we have a new schema	
			$.each d3Data, (prop, val) =>
				# if we find a property that isn't in our previous schema, create a new table.
				unless prop in last_schema
					# set up the number of elements for the last schema, before moving on
					unless schema_count == -1
						data[schema_count].numEls = data[schema_count][last_schema[0]].length
					last_schema = Object.keys(d3Data)
					# schema should also contain the tagname/shape
					last_schema.push(node.tagName)
					
					schema_count++
					data[schema_count] = {}
				
					# set the schema for data and visual attributes of this set
					data[schema_count].d3Data = {}
					$.each Object.keys(d3Data), (j, key) ->
						data[schema_count].d3Data[key] = []
						
					data[schema_count].visData = @extractVisSchema(node)

					return false;
		
			# now let's add the data item to our structure
			$.each d3Data, (prop, val) ->
				if data[schema_count].d3Data.hasOwnProperty(prop)
					data[schema_count].d3Data[prop].push(val)
				else
					data[schema_count].d3Data[prop] = [val]
		
			# finally extract the visual attributes
			visRow = @extractVisData(node, obj.cssText)
			$.each Object.keys(data[schema_count].visData), (j, key) ->
				data[schema_count].visData[key].push(visRow[key])
		
			# and add the node
			if data[schema_count].hasOwnProperty('node')
				data[schema_count]['node'].push(@prepareMarkForDisplay(node, obj.cssText));
			else
				data[schema_count]['node'] = [@prepareMarkForDisplay(node, obj.cssText)];
			
		
		data[schema_count].numEls = data[schema_count].d3Data[last_schema[0]].length
		return data
	
		
class TableView
	constructor: (data) ->
		@buildTable(data)
	
	buildTable: (data) ->
		# for each schema...
		$.each data, (i, dataSet) ->
			content_div = $ '<div class="container"></div>'
			content = $ '<table id="example" class="display"></table>'
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
		
			dataTable = $('#example').dataTable({
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