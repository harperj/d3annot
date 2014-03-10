chrome.runtime.onMessage.addListener (message, sender, sendResponse) ->
	if message.type == "syn"
		data = processPayload(message.payload)
		console.log data
		buildTable(data)
		#initConnection(sender.tab.id)
		
processPayload = (payload) ->
	data = []
	schema_count = -1
	last_schema = []
	
	$.each payload, (i, obj) ->
		d3Data = obj.d3Data
		node = $(obj.nodeText)[0]
		
		# skip non-object data
		unless d3Data instanceof Object
			return true
		
		# check to see if we have a new schema	
		$.each d3Data, (prop, val) ->
			# if we find a property that isn't in our previous schema, create a new table.
			if $.inArray(prop, last_schema) == -1
				# set up the number of elements for the last schema, before moving on
				unless schema_count == -1
					data[schema_count].numEls = data[schema_count][last_schema[0]].length
				last_schema = Object.keys(d3Data)
				schema_count++
				data[schema_count] = {}
				
				# set the schema for data and visual attributes of this set
				data[schema_count].d3Schema = Object.keys(d3Data)
				data[schema_count].visAttr = []
				$.each node.attributes, (j, attr) ->
					unless attr.name == "style"
						data[schema_count].visAttr.push attr.name
						
				return false;
		
		# now let's add the data item to our structure
		$.each d3Data, (prop, val) ->
			if data[schema_count].hasOwnProperty(prop)
				data[schema_count][prop].push(val)
			else
				data[schema_count][prop] = [val]
		
		# finally extract the visual attributes
		$.each node.attributes, (j, attr) ->
			unless attr.name == "style"
				if data[schema_count].hasOwnProperty(attr.name)
					data[schema_count][attr.name].push(attr.value)
				else
					data[schema_count][attr.name] = [attr.value]
		
		# and add the node
		if data[schema_count].hasOwnProperty('node')
			data[schema_count]['node'].push(prepareMarkForDisplay(node, obj.cssText));
		else
			data[schema_count]['node'] = [prepareMarkForDisplay(node, obj.cssText)];
			
		
	data[schema_count].numEls = data[schema_count][last_schema[0]].length
	return data
		
prepareMarkForDisplay = (node, cssText) ->
	node.style.cssText = cssText
	tagName = $(node).prop("tagName").toLowerCase()  #lower case b/c jquery inconsistency
	
	# circle case
	if tagName == "circle" or tagName == "ellipse"
		d3.select(node).attr "cx", 50
		d3.select(node).attr "cy", 50
		return node
	return null
	
		
initConnection = (tabId) ->
	port = chrome.tabs.connect tabId, {name: 'd3annot'}
	
buildTable = (data) ->
	# for each schema...
	$.each data, (i, dataSet) ->
		content = $ '<table id="extracted_content" class="dataTable"></table>'
		foot = $ '<tfoot></tfoot>'
		head = $ '<thead></thead>'
		
		# build a table
		hrow = $ '<tr></tr>'
		for prop in dataSet.d3Schema
			th = $ '<th>' + prop + '</th>'
			$(hrow).append th
		for attr in dataSet.visAttr
			th = $ '<th>' + attr + '</th>'
			$(hrow).append th
			
		# add a final header for the mark
		unless dataSet['node'] == null
			$(hrow).append $ '<th>Mark</th>'
		
		$(head).append hrow
		$(content).append head
		
		for ind in [0..(dataSet.numEls-1)]
			row = $ '<tr></tr>'
			for prop in dataSet.d3Schema
				td = $ '<td>' + dataSet[prop][ind] + '</td>'
				$(row).append td
				
			for attr in dataSet.visAttr
				td = $ '<td>' + dataSet[attr][ind] + '</td>'
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
		$('body').append content
		
		$('#extracted_content tr').click () ->
			$(@).toggleClass 'row_selected'
			
		dataTable = $('#extracted_content').dataTable {
			"bPaginate": false
		}
			
		$('svg').each () ->
			$(@).html $(@).html()
		
		