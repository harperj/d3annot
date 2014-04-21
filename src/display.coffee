# compares whether two arrays contain the same values
unorderedEquals = (arr1, arr2) -> (_.difference(arr1, arr2).length == 0) and (_.difference(arr2, arr1).length == 0)

class VisConnector
	constructor: ->
		chrome.runtime.onMessage.addListener (message, sender, sendResponse) =>
			if message.type == "syn"
				@initConnection(sender.tab.id)
				@dataSets = @processPayload(message.payload)
				@tableViews = []
				$.each @dataSets, (i, dataSet) =>
					dataSet.dataTypes = @inferTypes(dataSet.d3Data)
					dataSet.visTypes = @inferTypes(dataSet.visData)
					dataSet.mappings = getMappings(dataSet)
				angularScope = angular.element($('body')).scope()
				angularScope.$apply =>
					#angularScope.mappings = getMappings(@dataSets[0])
					angularScope.dataSets = @dataSets
					
			if message.type == "addData"
				console.log "Your data has arrived ;-)"
				newDataSets = @processPayload(message.payload)
				$.each newDataSets, (i, dataSet) =>
					dataSet.dataTypes = @inferTypes(dataSet.d3Data)
					dataSet.visTypes = @inferTypes(dataSet.visData)
					dataSet.mappings = getMappings(dataSet)
					@dataSets.push(dataSet)
				
				angularScope = angular.element($('body')).scope()
				angularScope.$apply =>
					for dataSet in newDataSets
						angularScope.dataSets.push(newDataSets)
					
			#else if message.type == "markUpdate"
				#newMarkInfo = 
				#	'tag': message.payload.nodeText
				#	'css': message.payload.cssText
				#	'bbox': message.payload.bbox
				#angularScope = angular.element($('body')).scope()
				#angularScope.$apply =>
				#	#console.log "applying mark update for id: #{message.payload.id}"
				#	for dataSet, index in angularScope.dataSets
				#		markIndex = dataSet['ids'].indexOf(message.payload.id)
				#		if markIndex != -1
				#			#console.log "applying mark update, markIndex=#{markIndex}"
				#			#angularScope.dataSets[index]['node'][markIndex] = newMarkInfo
				#			continue
							
			setupModal()
		
	initConnection: (tabId) =>
		@port = chrome.tabs.connect tabId, {name: 'd3annot'}
	
	sendUpdate: (message) =>
		@port.postMessage(message)
	
	getDataSetTable: (dataSetId) =>
		return @tableViews[dataSetId].dataTable

	inferTypes: (dataObj) ->
		dataTypes = {}
		for dataAttr of dataObj
			dataTypes[dataAttr] = @inferDataColType(dataObj[dataAttr])
			if dataTypes[dataAttr] == "numeric"
				newCol = _.map(dataObj[dataAttr], (d) -> +parseFloat(d).toFixed(3))
				dataObj[dataAttr] = newCol
		return dataTypes
		
	inferDataColType: (colData) ->
		isNum = true
		isNull = true
		for row in colData
			if row
				isNull = false
			if isNaN(parseFloat(row))
				isNum = false
		if isNum
			return "numeric"
		else if isNull
			return "null"
		else
			return "nominal"
				
	# How will we handle nonexistant fields?
	extractVisData: (node, nodeText, cssText, bbox) ->
		visRow = {}
		nodeAttrs = {}
		$.each node.attributes, (j, attr) ->
			nodeAttrs[attr.name] = attr.value
		node.style.cssText = cssText
		
		newNode = prepareMarkForDisplay(nodeText, cssText)
		svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
		canvasWidth = 20
		svg.setAttribute("width", "20")
		svg.setAttribute("height", "20")
		$('body')[0].appendChild(svg)
		svg.appendChild(newNode)
		styleFill = d3.select(newNode).style('fill')
		styleStroke = d3.select(newNode).style('stroke')
		$(svg).remove()
		
		visRow["shape"] = node.tagName.toLowerCase()

		if !styleFill
			visRow["fill-color"] = nodeAttrs["fill"]			
		else
			visRow["fill-color"] = styleFill
		
		visRow["fill-color-lightness"] = d3.rgb(visRow["fill-color"]).hsl().l
			
		if !styleStroke
			visRow["stroke-color"] = nodeAttrs["stroke"]
		else
			visRow["stroke-color"] = styleStroke
			
		visRow["stroke-width"] = nodeAttrs["stroke-width"]
		visRow["x-position"] = bbox.x + (bbox.width / 2)
		visRow["y-position"] = bbox.y + (bbox.height / 2)
		
		if visRow["shape"] == "circle"
			visRow["width"] = 2 * parseFloat(nodeAttrs["r"])
			visRow["height"] = 2 * parseFloat(nodeAttrs["r"])
			visRow["area"] = Math.PI * parseFloat(nodeAttrs["r"]) * parseFloat(nodeAttrs["r"])
		else
			visRow["width"] = bbox.width
			visRow["height"] = bbox.height
			visRow["area"] = bbox.width * bbox.height
			
		return visRow
		
	extractVisSchema: (node) ->
		shape = node.tagName.toLowerCase()
		return {"shape": [], "fill-color": [], "stroke-color": [], \ 
							"stroke-width": [], "width": [], "height": [], "area": [], "x-position": [], "y-position": [],
							"fill-color-lightness": []}
		
	findSchema: (data, d3Data, tagName) ->
		thisSchema = null
		if d3Data instanceof Object
			thisSchema = Object.keys(d3Data)
			thisSchema.push("deconID")
		else
			thisSchema = ["string", "deconID"]
			if typeof d3Data is "number"
				thisSchema = ["number", "deconID"]
			
		#thisSchema.push(tagName)
		found = -1
		$.each data, (i, dataSet) ->

			if unorderedEquals(dataSet.schema, thisSchema)
				found = i
				return false
		return found
		
	checkForPathData: (data) ->
		newData = data
		#if geojson
		if "properties" in Object.keys(data)  and "geometry" in Object.keys(data)
			#the real data is in this properties field
			newData = _.extend(newData, data['properties'])
		else if "startAngle" in Object.keys(data) and "endAngle" in Object.keys(data)
			data = {}
			if data['data']
				newData = data['data']
			if data['value']
				newData['value'] = data['value']
		else
			newData = data
			
		if "geometry" in Object.keys(newData)
			newData = _.omit(newData, "geometry")
			
		return newData
		
	fixLinePaths: (payload) ->
		$.each payload, (i, obj) ->
			#console.log obj
			node = prepareMarkForDisplay(obj.nodeText, obj.cssText)
			# skip if not a path AND polyline
			if (node.tagName.toLowerCase() != 'path') 
				return true
				
			dataArray = null
			otherAttrs = {}
			if obj.d3Data instanceof Array
				dataArray = obj.d3Data
			else if obj.d3Data instanceof Object
				for attr, val of obj.d3Data
					if val instanceof Array
						dataArray = val
					else
						otherAttrs[attr] = val
				if dataArray == null
					return true
			else
				return true
			# get relevant data
			pathID = obj.id
			console.log dataArray
			console.log otherAttrs
			# add a new one for each
			for val, i in dataArray
				row = {}
				row.d3Data = val
				row.d3Data = _.extend(row.d3Data, otherAttrs)
				row.d3Data['lineID'] = i
				row.id = pathID
				row.nodeText = obj.nodeText
				row.cssText = obj.cssText
				row.isLinePoint = true
				row.bbox = obj.bbox
				
				payload.push(row)
				
			# remove obj from payload
			payload.splice(payload.indexOf(obj), 1)
			
	flattenData: (row) =>
		newRow = row
		for key, val of row
			if val instanceof Object
				newRow = _.extend(newRow, val)
				newRow = _.omit(newRow, key)
		return newRow
		
	processPayload: (payload) =>
		data = []
		schema_count = -1
		
		@fixLinePaths(payload)
	
		$.each payload, (i, obj) =>
			d3Data = @flattenData(obj.d3Data)
			node = prepareMarkForDisplay(obj.nodeText, obj.cssText)
			schema = -1
			
			# object types require some schema thought
			if d3Data instanceof Object
				
				if node.tagName.toLowerCase() == 'path'
						d3Data = @checkForPathData(d3Data)
				
				# check to see if we have a new schema	
				console.log d3Data
				schema = @findSchema(data, d3Data, node.tagName)
				console.log schema
				if schema == -1
					# if we find a property that isn't in a previous schema, create a new table.
					newSchema = Object.keys(d3Data)
					newSchema.push("deconID")
					# schema should also contain the tagname/shape
					#newSchema.push(node.tagName)
					schema_count++
					schema = schema_count
					data[schema] = {}
					data[schema].schema = newSchema
					# set the schema for data and visual attributes of this set
					data[schema].d3Data = {}
					data[schema].d3Data["deconID"] = []
					$.each Object.keys(d3Data), (j, key) ->
						data[schema].d3Data[key] = []
						
					data[schema].visData = @extractVisSchema(node)
					data[schema].visSchema = _.keys(data[schema].visData)
						
						
				# now let's add the data item to our structure
				$.each d3Data, (prop, val) ->
					data[schema].d3Data[prop].push(val)
				data[schema].d3Data["deconID"].push(obj.id)
			
			else
				if d3Data is undefined or d3Data is null
					return true
				# we just have a scalar data element
				type = "string"
				if typeof d3Data is "number"
					type = "number"
				schema = @findSchema(data, d3Data, node.tagName)
				if schema == -1
					schema_count++
					schema = schema_count
					data[schema] = {}
					data[schema].schema = [type, "deconID"]
					if type is "number"
						data[schema].d3Data = {"deconID": [obj.id], "number": [d3Data]}
					else if type is "string"
						data[schema].d3Data = {"deconID": [obj.id], "string": [d3Data]}
						
					data[schema].visData = @extractVisSchema(node)
					data[schema].visSchema = _.keys(data[schema].visData)
				else
					data[schema].d3Data[type].push(d3Data)
					data[schema].d3Data["deconID"].push(obj.id)
					
			
			# finally extract the visual attributes
			visRow = @extractVisData(node, obj.nodeText, obj.cssText, obj.bbox)
			if obj.isLinePoint
				visRow['shape'] = 'linePoint'
				node = prepareMarkForDisplay(obj.nodeText, obj.cssText)
				console.log "getting pt from line"
				console.log node
				console.log obj.d3Data['lineID']
				pts = getPointFromLine(node, obj.d3Data['lineID'])
				console.log pts
				
			$.each Object.keys(data[schema].visData), (j, key) ->
				data[schema].visData[key].push(visRow[key])
		
			# and add the node
			if data[schema].hasOwnProperty('node')
				data[schema]['node'].push({'tag': obj.nodeText, 'css': obj.cssText, 'bbox': obj.bbox})
			else
				data[schema]['node'] = [{'tag': obj.nodeText, 'css': obj.cssText, 'bbox': obj.bbox}]
		
			if data[schema].hasOwnProperty('ids')
				data[schema]['ids'].push(obj.id)
			else
				data[schema]['ids'] = [obj.id]
		
		$.each data, (i, dataSet) ->
			dataSet.numEls = dataSet.d3Data[dataSet.schema[0]].length
			
		return data


getPointFromLine = (node, ind) ->
	segList = node.animatedPathSegList
	console.log "made it here"
	return [segList[ind].x, segList[ind].y]

getBBoxWithoutCanvas = (node) ->
	svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
	svg.appendChild(node)
	$('body')[0].appendChild(svg)
	bbox = node.getBBox()
	svg.remove()
	return bbox

getMappings = (dataSet) ->
	mappings = {}
		
	for dataAttr of dataSet.d3Data
		for visAttr of dataSet.visData
			## TODO: REMOVE AFTER DEADLINE
			if visAttr is "fill-color-lightness"
				continue
				
			mapping = getMapping(dataAttr, visAttr, dataSet)
			if mapping
				#console.log ("Found mapping between: " + dataAttr + " and " + visAttr)
				if mappings.hasOwnProperty(dataAttr)
					mappings[dataAttr].push([visAttr, mapping])
				else
					mappings[dataAttr] = [[visAttr, mapping]]
	
	#now that we have all mappings, filter out nominal for which there is also a linear
	visAttrsWithLinear = []
	for dataAttr, visAttrs of mappings
		for visAttrMap in visAttrs
			if visAttrMap[1].hasOwnProperty('isNumericMapping')
				if not (visAttrMap[0] in visAttrsWithLinear)
					if visAttrMap[0] is 'area'
						visAttrsWithLinear.push('width')
						visAttrsWithLinear.push('height')
					visAttrsWithLinear.push(visAttrMap[0])
	
	#console.log "linear maps: #{visAttrsWithLinear}"
	
	for dataAttr, visAttrs of mappings
		removed = 0
		for ind in [0..visAttrs.length-1]
			console.log visAttrs
			visAttrMap = visAttrs[ind-removed]
			if !visAttrMap[1].hasOwnProperty('isNumericMapping') and 
			visAttrMap[0] in visAttrsWithLinear
				console.log "removing..."
				console.log visAttrMap
				visAttrs.splice(ind-removed, 1)
				++removed;
	
	return mappings
	
getMapping = (dataAttr, visAttr, dataSet) ->
	dataAttrType = dataSet.dataTypes[dataAttr]
	visAttrType = dataSet.visTypes[visAttr]
	dataAttrCol = dataSet.d3Data[dataAttr]
	visAttrCol = dataSet.visData[visAttr]
	if dataAttrType is "null" or visAttrType is "null"
		# null data, don't even check
		return false
	else if not(dataAttrType is visAttrType) or 
	(dataAttrType is "nominal")
		# nominal
		return getMappingNominal(dataAttrCol, visAttrCol, dataSet['ids'])
	else
		# quantitative/numeric
		#console.log "#{dataAttr} -- #{visAttr}"
		return getMappingNumeric(dataAttrCol, visAttrCol, dataSet['ids'])
	return null
			
getMappingNominal = (col1, col2, ids) ->
	mapping = {}
	mapping_ids = {}
	for row1, index in col1
		if mapping.hasOwnProperty(row1)
			mapping[row1].push(col2[index])
			mapping_ids[row1].push(ids[index])
		else
			mapping[row1] = [col2[index]]
			mapping_ids[row1] = [ids[index]]
	for val of mapping
		mapping[val] = _.uniq(mapping[val])
		if mapping[val].length > 1
			return false
	mappedVals = _.flatten(_.values(mapping))
	if _.uniq(mappedVals).length < mappedVals.length
		return false
	for attr of mapping
		mapping[attr] = [mapping[attr], mapping_ids[attr]]
	return mapping
	
hasMappingNominal = (col1, col2) ->
	return if getMappingNominal(col1, col2) then true else false
	
getMappingNumeric = (col1, col2, ids) ->
	mapping = {}
	col1 = _.map(col1, (v) -> parseFloat(v))
	col2 = _.map(col2, (v) -> parseFloat(v))
	zipped = _.zip(col1, col2)
	linear_regression = ss.linear_regression().data(zipped)
	linear_regression_line = linear_regression.line()
	rSquared = ss.r_squared(zipped, linear_regression_line)
	#console.log rSquared
	if jStat.stdev(col1) is 0 or jStat.stdev(col2) is 0
		return false
	if rSquared > 0.99 and not(isNaN(rSquared))
		#console.log rSquared
		#console.log "#{linear_regression.m()} * x + #{linear_regression.b()}"
		#console.log "NUMERIC!"
		mapping.dataMin = _.min(col1)
		mapping.dataMinIndex = col1.indexOf(mapping.dataMin)
		mapping.dataMax = _.max(col1)
		mapping.dataMaxIndex = col1.indexOf(mapping.dataMax)
		mapping.visMin = col2[mapping.dataMinIndex]
		mapping.visMinIndex = mapping.dataMinIndex
		mapping.visMax = col2[mapping.dataMaxIndex]
		mapping.visMaxIndex = mapping.dataMaxIndex
		mapping.isNumericMapping = true
		mapping.ids = ids
		return mapping
	#else if not _.some(col2, (val) -> if val % 1 is 0 then true else false)
	return getMappingNominal(col1, col2, ids)

getSelectedSet = (dataSet) ->
	newDataSet = {}
	newDataSet.d3Data = {}
	newDataSet.visData = {}
	newDataSet.schema = dataSet.schema
	newDataSet.visSchema = dataSet.visSchema
	newDataSet.dataTypes = dataSet.dataTypes
	newDataSet.visTypes = dataSet.visTypes
	newDataSet.selections = []
	console.log dataSet.selections
	console.log dataSet['ids']

	
	for key of dataSet.d3Data
		newList = []
		for sel in dataSet.selections
			newList.push(dataSet.d3Data[key][sel])
		newDataSet.d3Data[key] = newList
	for key of dataSet.visData
		newList = []
		for sel in dataSet.selections
			newList.push(dataSet.visData[key][sel])
		newDataSet.visData[key] = newList
	for id in dataSet['ids']
		newList = []
		for sel in dataSet.selections
			newList.push(dataSet['ids'][sel])
		newDataSet['ids'] = newList
	for id in dataSet['ids']
		newList = []
		for sel in dataSet.selections
			newList.push(dataSet['node'][sel])
		newDataSet['node'] = newList
		newDataSet.numEls = newList.length
	newDataSet.mappings = getMappings(newDataSet)
			
	return newDataSet
	
removeSelectedSet = (dataSet) ->
	# reverse order sort
	sorted = dataSet.selections.sort((a,b) -> b-a)
	
	# then splice from each
	for sel in sorted
		for key of dataSet.d3Data
			dataSet.d3Data[key].splice(sel, 1)
		for key of dataSet.visData
			dataSet.visData[key].splice(sel, 1)
		dataSet['ids'].splice(sel, 1)
		dataSet['node'].splice(sel, 1)
	
	dataSet.mappings = getMappings(dataSet)
	dataSet.numEls = dataSet['ids'].length
	dataSet.selections = []
		

restylingApp = angular.module('restylingApp', [])

restylingApp.controller 'MappingListCtrl', ($scope, orderByFilter) ->
	$scope._ = _
	$scope.currentDataSet = 0
	$scope.chosenMappings = null
	$scope.addMappingDialog = false
	$scope.addForm = { }
	
	$scope.numericTypesInForm = () ->
		visAttr = $scope.addForm.mapVisAttr
		dataAttr = $scope.addForm.mapDataAttr
		dataSet = $scope.dataSets[$scope.currentDataSet]
		#console.log dataSet.visTypes
		#console.log dataSet.dataTypes
		if dataSet.visTypes[visAttr] != 'numeric' or
		dataSet.dataTypes[dataAttr] != 'numeric'
			return false
		return true
		
	$scope.numericConstraint= () ->
		visAttr = $scope.addForm.mapVisAttr
		dataAttr = $scope.addForm.mapDataAttr
		dataSet = $scope.dataSets[$scope.currentDataSet]
		#console.log dataSet.visTypes
		#console.log dataSet.dataTypes
		if dataSet.visTypes[visAttr] != 'numeric' or
		dataSet.dataTypes[dataAttr] != 'numeric'
			return false
		return true
	
	$scope.addFormAction = (action) ->
		$scope.addForm.action = action
		if action == 'Nominal'
			uniqVals = _.uniq($scope.dataSets[$scope.currentDataSet].d3Data[$scope.addForm.mapDataAttr])
			$scope.addForm.nominalMapData = {}
			for uniqVal in uniqVals
				$scope.addForm.nominalMapData[uniqVal] = ''
		
	$scope.changeFormDataAttr = (attr = null) ->
		$scope.addForm.mapDataAttr = attr
		if $scope.addForm.action == 'Nominal'
			$scope.addFormAction('Nominal')

	$scope.clearAddForm = () ->
		$scope.addForm = { }
	
	$scope.removeMapping = (dataField, mappedAttr) ->
		dataSet = $scope.dataSets[$scope.currentDataSet]
		for mapping in dataSet.mappings[dataField]
			if mapping[0] == mappedAttr[0]
				ind = dataSet.mappings[dataField].indexOf(mapping)
				dataSet.mappings[dataField].splice(ind, 1)
				break
		
		for ind in [0..dataSet.visData[mappedAttr[0]]-1]
			dataSet.visData[mappedAttr[0]][ind] = dataSet.visData[mappedAttr[0]][0]
		
		$scope.updateVis(mappedAttr[0], dataSet.visData[mappedAttr[0]][0], dataSet['ids'])
	
	$scope.getSelections = ->
		sels = $scope.dataSets[$scope.currentDataSet].selections
		if (not sels) or sels.length == 0
			return $scope.dataSets[$scope.currentDataSet]['ids']
		else
			return sels
	
	$scope.updateVis = (attr, value, ids) ->
		message = 
			type: "update"
			attr: attr
			val: value
			nodes: ids
		window.connector.sendUpdate(message)
		$scope.updateData(message)
	
	$scope.submitValChange = ->
		$scope.updateVis($scope.addForm.changeAttr, 
			$scope.addForm.changedAttrValue,
			$scope.dataSets[$scope.currentDataSet]['ids'])
		
	$scope.updateData = (updateMessage) ->
		attr = updateMessage.attr
		val = updateMessage.val
		ids = updateMessage.nodes
		for id in ids
			dataSet = $scope.dataSets[$scope.currentDataSet]
			ind = dataSet['ids'].indexOf(id)
			if attr in ["x-position", "y-position", "width", "height"]
				val = parseFloat(val)
			dataSet.visData[attr][ind] = val
			#console.log "setting #{attr} to #{val}"
	
	$scope.setChosenMappings = ->
		$scope.addMappingDialog = false
		$scope.chosenMappings = $scope.dataSets[$scope.currentDataSet].mappings
		#console.log $scope.dataSets
		#console.log $scope.chosenMappings
	
	$scope.getIndexForDataVal = (attr, val) ->
		dataSet = $scope.dataSets[$scope.currentDataSet]
		return dataSet.d3Data[attr].indexOf(val)
		
	$scope.submitAttrClassChange = ($event, attrClass, attrName) ->
		if $event.keyCode is 13 #enter key
			dataSet = $scope.dataSets[$scope.currentDataSet]
			newVal = angular.element($event.target).val()
			inds = []
			
			for val, i in dataSet.visData[attrName]
				if val == attrClass
					inds.push(i)
					
			ids = _.map(inds, (ind) -> dataSet['ids'][ind])
			console.log ids
			uniqIds = _.uniq(ids)
			if uniqIds.length < ids.length
				# operation includes line pts
				if attrName == "shape"
					for id in uniqIds
						msg = 
							type: "breakLine"
							shape: newVal
							id: id
						window.connector.sendUpdate(msg)
					return
				else
					ids = uniqIds
					
			else if attrName is "shape" and newVal is "line"
				msg = 
					type: "makeLine"
					ids: ids
				window.connector.sendUpdate(msg)
				return
			
			$scope.updateVis(attrName, newVal, ids)
		
	$scope.submitNewLinearMapping = ($event) ->
		if $event.keyCode is 13
			data = $scope.dataSets[$scope.currentDataSet]
			dataAttr = $scope.addForm.mapDataAttr
			visAttr = $scope.addForm.mapVisAttr
			dataMin = _.min(data.d3Data[dataAttr])
			dataMax = _.max(data.d3Data[dataAttr])
			newMin = $scope.addForm.newMin
			newMax = $scope.addForm.newMax
			if visAttr is "fill-color" or visAttr is "stroke-color"
				line = d3.scale.linear()
					.domain([dataMin,dataMax])
					.range([newMin,newMax])
					.interpolate(d3.interpolateHcl)
				for ind in [0..data.numEls-1]
					dataVal = data.d3Data[dataAttr][ind]
					newAttrVal = line(dataVal)
					$scope.updateVis(visAttr, newAttrVal, [data['ids'][ind]])
					
			else if $scope.addForm.mapVisAttr is "fill-color-lightness"
				# line = (val, oldColor) ->
				# 	hslMin = d3.rgb(newMin).hsl()
				# 	hslMax = d3.rgb(newMax).hsl()
				# 	scaleL = d3.scale.linear()
				# 		.domain([dataMin,dataMax])
				# 		.range([hslMin.l, hslMax.l])
				# 	newColorLightness = scaleL(val)
				# 	oldColor = d3.rgb(oldColor).hsl()
				# 	newColor = d3.hsl(oldColor.h,oldColor.s, newColorLightness)
				# 	return newColor
				
				line = (val, oldColor) ->
					hslMin = d3.rgb(newMin).hsl()
					hslMax = d3.rgb(newMax).hsl()
					scaleL = d3.scale.linear()
						.domain([dataMin,dataMax])
						.range([hslMin.s, hslMax.s])
					newColorLightness = scaleL(val)
					oldColor = d3.rgb(oldColor).hsl()
					newColor = d3.hsl(oldColor.h,newColorLightness, oldColor.l)
					return newColor
					
				for ind in [0..data.numEls-1]
					dataVal = data.d3Data[dataAttr][ind]
					newAttrVal = line(dataVal, data.visData["fill-color"][ind])
					#console.log newAttrVal
					data.visData["fill-color-lightness"] = newAttrVal.l
					$scope.updateVis("fill-color", newAttrVal.rgb().toString(), [data['ids'][ind]])
				
				#	.interpolate(d3.interpolateHcl)
				# line = d3.scale.linear()
				# 	.domain([dataMin,dataMax])
				# 	.range([$scope.addForm.newMin, $scope.addForm.newMax])
				# 	.interpolate(d3.interpolateHcl)
			else
				newMin = [dataMin, parseFloat($scope.addForm.newMin)]
				newMax = [dataMax, parseFloat($scope.addForm.newMin)]
				regression = ss.linear_regression().data([newMin, newMax])
				line = regression.line()
				for ind in [0..data.numEls-1]
					#ind = data['ids'].indexOf(id)
					dataVal = data.d3Data[dataAttr][ind]
					newAttrVal = line(dataVal)
					$scope.updateVis(visAttr, newAttrVal, [data['ids'][ind]])
				
			mapping = {}
			mapping.dataMin = dataMin
			mapping.dataMinIndex = data.d3Data[dataAttr].indexOf(mapping.dataMin)
			mapping.dataMax = dataMax
			mapping.dataMaxIndex = data.d3Data[dataAttr].indexOf(mapping.dataMax)
			mapping.visMin = parseFloat($scope.addForm.newMin)
			mapping.visMax = parseFloat($scope.addForm.newMax)
			mapping.isNumericMapping = true
			mapping.ids = data['ids']
			data.mappings[dataAttr].push([visAttr, mapping])
	
	$scope.submitLinearMappingChange = ($event, dataAttr, mapping) ->
		if $event.keyCode is 13
			newMin = [mapping[1].dataMin, parseFloat(mapping[1].visMin)]
			newMax = [mapping[1].dataMax, parseFloat(mapping[1].visMax)]
			regression = ss.linear_regression().data([newMin, newMax])
			line = regression.line()
			currDataSet = $scope.dataSets[$scope.currentDataSet]
			for id in mapping[1].ids
				ind = currDataSet['ids'].indexOf(id)
				dataVal = currDataSet.d3Data[dataAttr][ind]
				newAttrVal = line(dataVal)
				$scope.updateVis(mapping[0], newAttrVal, [id])
	
	$scope.isMapped = (visAttr) ->
		dataSet = $scope.dataSets[$scope.currentDataSet]
		for dataField of dataSet.mappings
			for mapping in dataSet.mappings[dataField]
				if mapping[0] == visAttr
					return dataField
		return false
			
	$scope.formCreateNominalMapping = ($event, dataAttrName, dataAttrCat) ->
		if $event.keyCode is 13
			dataSet = $scope.dataSets[$scope.currentDataSet]
			mapping = {}
			for dataVal, attrVal of $scope.addForm.nominalMapData
				dataValIndices = []
				idx = dataSet.d3Data[dataAttrName].indexOf(dataVal)
				while idx != -1
					dataValIndices.push(idx)
					idx = dataSet.d3Data[dataAttrName].indexOf(dataVal, idx + 1)
				
				dataValIDs = []
				for ind in dataValIndices
					dataValIDs.push(dataSet['ids'][ind])
					
				mapping[dataVal] = [[attrVal], [dataValIDs]]
				$scope.updateVis($scope.addForm.mapVisAttr, attrVal, dataValIDs)
			
			for dataAttr, mappings of dataSet.mappings
				for map in mappings
					if map[0] is $scope.addForm.mapVisAttr
						dataSet.mappings[dataAttr].splice(dataSet.mappings[dataAttr].indexOf[map], 1)
			
			mapping = [$scope.addForm.mapVisAttr, mapping]
			dataSet.mappings[$scope.addForm.mapDataAttr].push(mapping)
			# console.log $scope.addForm.mapDataAttr
			# console.log mapping
			# console.log dataSet.mappings
			# 
			# console.log dataSet

	$scope.splitSelection = () ->
		dataSet = $scope.dataSets[$scope.currentDataSet]
		newSet = getSelectedSet(dataSet)
		# console.log newSet
		$scope.dataSets.push(newSet)
		removeSelectedSet(dataSet)
			
	$scope.submitNominalMappingChange = ($event, dataAttr, mappedAttr, mapped_to) ->
		if $event.keyCode is 13 #enter key
			newCategoryVal = angular.element($event.target).val()
			newIds = mapped_to[1]
			mapped_to[0][0] = newCategoryVal
			$scope.updateVis(mappedAttr, newCategoryVal, newIds)
			
	$scope.selectDataSet = (dataSet) ->
		$scope.currentDataSet = $scope.dataSets.indexOf(dataSet)
		$scope.clearAddForm()
		$scope.setChosenMappings()
		$scope.currentDialog = "viewMappingDialog"
		if $scope.dataSets[$scope.currentDataSet].selections and
		$scope.dataSets[$scope.currentDataSet].selections.length > 0
			$scope.selectedSet = getSelectedSet($scope.dataSets[$scope.currentDataSet])
		else
			$scope.selectedSet = $scope.dataSets[$scope.currentDataSet]
	
	$scope.nextIndex = 0
	$scope.getNextIndex = () ->
		return ++$scope.nextIndex
	
	
	$scope.getMappings = ->
		#$scope.currentMappings = []
		#if (not $scope.dataSets[$scope.currentDataSet].selections) or 
		#		$scope.dataSets[$scope.currentDataSet].selections.length == 0
		$scope.dataSets[$scope.currentDataSet].mappings = 
			getMappings($scope.dataSets[$scope.currentDataSet])
		###
		else
			selectedSet = getSelectedSet($scope.dataSets[$scope.currentDataSet])
			$scope.selectedSet = selectedSet
			$scope.dataSets[$scope.currentDataSet].mappings = 
				getMappings(selectedSet)
		###
	
	$scope.toggleSelect = (dataSet, elemIndex) ->
		if not dataSet.selections
			dataSet.selections = [elemIndex]
		else
			if elemIndex in dataSet.selections
				dataSet.selections = _.without(dataSet.selections, elemIndex)
			else
				dataSet.selections.push(elemIndex)
		if dataSet.selections and dataSet.selections.length > 0
			$scope.selectedSet = getSelectedSet(dataSet)
		else
			$scope.selectedSet = dataSet
		
	$scope.itemClass = (dataSet, elemIndex) ->
		if not dataSet.hasOwnProperty('selections')
			return undefined
			
		if elemIndex in dataSet.selections
			return 'selected'
		return undefined

prepareMarkForDisplay = (nodeText, cssText) ->
	htmlNode = $(nodeText)[0]
	svgNode = document.createElementNS("http://www.w3.org/2000/svg", htmlNode.tagName.toLowerCase());
	htmlNode.style.cssText = cssText
	tagName = $(htmlNode).prop("tagName").toLowerCase()  #lower case b/c jquery inconsistency
		
	for attr in htmlNode.attributes
		svgNode.setAttribute(attr.name, attr.value)
	svgNode.setAttribute("vector-effect","non-scaling-stroke")
	if $(htmlNode).text()
		svgNode.textContent = $(htmlNode).text()
	
	d3.select(svgNode).attr("transform", undefined)
	# circle case
	if tagName == "circle" or tagName == "ellipse"
		r = d3.select(svgNode).attr "r"
		d3.select(svgNode).attr "cx", 0
		d3.select(svgNode).attr "cy", 0
	else
		d3.select(svgNode).attr "x", 0
		d3.select(svgNode).attr "y", 0
	return svgNode
		

restylingApp.directive 'svgInject', ($compile) ->
	return {
		scope: {
			ind: '=ind',
			data: '=data'
		}
		link: (scope, element, attrs, controller) ->
			scope.$watch "data['node'][ind]", ((newValue, oldValue) -> 
				svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
				canvasWidth = 20
				svg.setAttribute("width", "20")
				svg.setAttribute("height", "20")
				$.each element[0].children, (e, i) ->
					$(this).remove()
				element[0].appendChild(svg)
				
				markInfo = scope.data['node'][scope.ind]

				maxWidth = _.max(scope.data.visData['width'])
				maxHeight = _.max(scope.data.visData['height'])
				mark = prepareMarkForDisplay(markInfo['tag'], markInfo['css'])
				#mark = prepareMarkFromVisData(scope.dataSet['node'].visData, scope.i)
				svg.appendChild(mark)
				scaleDimVal = maxHeight
				#maxNode = maxHeightNode
				if maxWidth > maxHeight
					#maxNode = maxWidthNode
					scaleDimVal = maxWidth
				
				newTranslate = svg.createSVGTransform()
				newTranslate.setTranslate(canvasWidth / 2, canvasWidth / 2)
				newScale = svg.createSVGTransform()
				newScale.setScale((canvasWidth-2) / scaleDimVal, (canvasWidth-2) / scaleDimVal)
				mark.transform.baseVal.appendItem(newTranslate)
				scaleNode(mark, scope.data.visData['width'][scope.ind], scope.data.visData['height'][scope.ind], svg)
				mark.transform.baseVal.appendItem(newScale)
				#d3.select(mark).attr("transform", newTranslate + newScale)
				), true
		}
# Calculate the bounding box of an element with respect to its parent element
transformedBoundingBox = (el, to) ->
	bb = el.getBBox()
	svg = el.ownerSVGElement
	unless to
		to = svg
	m = el.getTransformToElement(to)
	
	# Create an array of all four points for the original bounding box
	pts = [
    svg.createSVGPoint(), svg.createSVGPoint(),
    svg.createSVGPoint(), svg.createSVGPoint()
	]
	
	pts[0].x=bb.x
	pts[0].y=bb.y
	pts[1].x=bb.x+bb.width
	pts[1].y=bb.y
	pts[2].x=bb.x+bb.width
	pts[2].y=bb.y+bb.height
	pts[3].x=bb.x
	pts[3].y=bb.y+bb.height;

  # Transform each into the space of the parent,
  # and calculate the min/max points from that.    
	xMin=Infinity
	xMax=-Infinity
	yMin=Infinity
	yMax=-Infinity
	for pt in pts
		pt = pt.matrixTransform(m)
		xMin = Math.min(xMin,pt.x)
		xMax = Math.max(xMax,pt.x)
		yMin = Math.min(yMin,pt.y)
		yMax = Math.max(yMax,pt.y)

  # Update the bounding box with the new values
	bb.x = xMin
	bb.width  = xMax-xMin
	bb.y = yMin
	bb.height = yMax-yMin
	return bb

window.transformedBoundingBox = transformedBoundingBox

scaleNode = (node, width, height, svg) ->
	scale = svg.createSVGTransform()
	bbox = window.transformedBoundingBox(node)
	
	#console.log bbox
	widthScale = width / bbox.width
	heightScale = height / bbox.height
	if width == 0
		widthScale = 1
	else if bbox.width == 0
		widthScale = width
	if height == 0
		heightScale = 1
	else if bbox.height == 0
		heightScale = height
		
	scale.setScale(widthScale, heightScale)
	
	node.transform.baseVal.appendItem(scale)
	bbox = window.transformedBoundingBox(node)

updateNode = (origNode, origBBox, attr, val) ->
	parentNode = origNode.parentElement
	svg = getRootSVG(origNode)
	clone = null
	currentTag = origNode.tagName.toLowerCase()
	
	if attr is "shape"
		clone = getNodeFromShape(val)
	else if currentTag is "polygon"
		clone = getNodeFromShape(currentTag, origNode.getAttribute("points"))
	else
		clone = getNodeFromShape(currentTag)
		
	parentNode.appendChild(clone)
	bbox = transformedBoundingBox(clone, svg)
	#console.log bbox
	#console.log clone
	
	for currAttr in origNode.attributes
		if not (currAttr.name in ["id", "cx", "cy", "x", "y", "r", "transform", "points", "requiredFeatures", "systemLanguage", "requiredExtensions", "vector-effect"])
			clone.setAttribute(currAttr.name, currAttr.value)
	clone.setAttribute("vector-effect", "non-scaling-stroke")

	if attr is "fill-color"
		attr = "fill"
		d3.select(clone).style("fill", val)			
	else if not (attr in ["x-position", "y-position", "shape", "width", "height"])
		d3.select(clone).attr(attr, val)
	
	translate = svg.createSVGTransform()
	parentTrans = origNode.getTransformToElement(svg)
	trans = clone.getTransformToElement(svg)
	parentOffset = [0, 0]
	if currentTag is "circle"
		cx = parseFloat(d3.select(origNode).attr("cx"))
		cy = parseFloat(d3.select(origNode).attr("cy"))
		if cx then parentOffset[0] = cx
		if cy then parentOffset[1] = cy
	else if currentTag is "rect"
		x = parseFloat(d3.select(origNode).attr("x"))
		y = parseFloat(d3.select(origNode).attr("y"))
		if x then parentOffset[0] = x
		if y then parentOffset[1] = y
	translate.setTranslate(parentTrans.e-trans.e+parentOffset[0], parentTrans.f-trans.f+parentOffset[1])
	clone.transform.baseVal.appendItem(translate)
		
	if attr is "x-position"
		newX = parseFloat(val)
		xtranslate = svg.createSVGTransform()
		xtranslate.setTranslate(newX-origBBox.x, 0)
		clone.transform.baseVal.appendItem(xtranslate)
	else if attr is "y-position"
		newY = parseFloat(val)
		ytranslate = svg.createSVGTransform()
		ytranslate.setTranslate(0, newY-origBBox.y)
		clone.transform.baseVal.appendItem(ytranslate)
		
	scale = svg.createSVGTransform()
	if val is "circle"
		if origBBox.width < origBBox.height
			scale.setScale(origBBox.width / bbox.width,origBBox.width / bbox.width)
		else
			scale.setScale(origBBox.height / bbox.height,origBBox.height / bbox.height)
	else if attr is "width"
		newWidth = parseFloat(val)
		scale.setScale((newWidth / bbox.width), (origBBox.height / bbox.height))
	else if attr is "height"
		newHeight = parseFloat(val)
		scale.setScale((origBBox.width / bbox.width), (newHeight / bbox.height))			
	else 
		scale.setScale((origBBox.width / bbox.width), (origBBox.height / bbox.height))
	clone.transform.baseVal.appendItem(scale)
	
	#console.log clone
	

###		
prepareMarkFromVisData = (visData, i) ->
	newNode = document.createElementNS("http://www.w3.org/2000/svg", visData["shape"][i])
	d3.select(newNode).style("fill", visData["color"][i])
	d3.select(newNode).style("stroke", visData["stroke"][i])
	d3.select(newNode).attr("stroke-width", visData["stroke-width"][i])
	
	newTranslate = "translate(" + canvasWidth / 2 + "," + canvasWidth / 2 + ")"
	
	return {"shape": [], "color": [], "stroke": [], \ 
						"stroke-width": [], "width": [], "height": [], "area": [], "x-position": [], "y-position": []}
###
		
$(document).ready () ->
	connector = new VisConnector()
	remappingForm = null
	window.connector = connector
	
setupModal = () ->
	$('table').on 'contextmenu', (event) ->
		event.preventDefault()
		scope = angular.element(event.target).scope()
		#console.log scope.dataSet
		scope.$apply () ->
			#scope.currentDataSet = scope.dataSets.indexOf(dataSet)
			#scope.selectDataSet(scope.dataSet)
			scope.splitSelection()
			
		
		#$("#attrEditor").modal()