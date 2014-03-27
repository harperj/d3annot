# compares whether two arrays contain the same values
unorderedEquals = (arr1, arr2) -> _.difference(arr1, arr2).length == 0

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
					angularScope.mappings = getMappings(@dataSets[0])
					angularScope.dataSets = @dataSets
		
	initConnection: (tabId) =>
		@port = chrome.tabs.connect tabId, {name: 'd3annot'}
	
	sendUpdate: (message) =>
		@port.postMessage(message)
	
	getDataSetTable: (dataSetId) =>
		return @tableViews[dataSetId].dataTable
	
	getDataSetMappings: (dataSetId) =>
		return @dataSets[dataSetId].mappings
			
	inferTypes: (dataObj) ->
		dataTypes = {}
		for dataAttr of dataObj
			dataTypes[dataAttr] = @inferDataColType(dataObj[dataAttr])
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
				
	circleTrans: =>
		@port.postMessage {type: "circleTrans"}
		
	# How will we handle nonexistant fields?
	extractVisData: (node, cssText, bbox) ->
		visRow = {}
		nodeAttrs = {}
		$.each node.attributes, (j, attr) ->
			nodeAttrs[attr.name] = attr.value
		
		visRow["shape"] = node.tagName.toLowerCase()
		visRow["color"] = nodeAttrs["fill"]
		visRow["stroke"] = nodeAttrs["stroke"]
		visRow["stroke-width"] = nodeAttrs["stroke-width"]
		visRow["x-position"] = bbox.x
		visRow["y-position"] = bbox.y
		if visRow["shape"] == "circle"
			visRow["radius"] = parseFloat(nodeAttrs["r"])
			visRow["area"] = parseFloat(nodeAttrs["r"])^2
		else
			visRow["width"] = bbox.width
			visRow["height"] = bbox.height
			visRow["area"] = bbox.width * bbox.height
			
		return visRow
		
	# This is a little hacky -- perhaps think about it a bit more later
	extractVisSchema: (node) ->
		shape = node.tagName.toLowerCase()
		if shape is "circle" 
			return {"shape": [], "color": [], "stroke": [], \ 
							"stroke-width": [], "radius": [], "area": [], "x-position": [], "y-position": []}
		else
			return {"shape": [], "color": [], "stroke": [], \ 
							"stroke-width": [], "width": [], "height": [], "area": [], "x-position": [], "y-position": []}
		
	findSchema: (data, d3Data, tagName) ->
		thisSchema = Object.keys(d3Data)
		thisSchema.push(tagName)
		found = -1
		$.each data, (i, dataSet) ->
			if unorderedEquals(dataSet.schema, thisSchema)
				found = i
				return false
		return found
		
	processPayload: (payload) =>
		data = []
		schema_count = -1
	
		$.each payload, (i, obj) =>
			d3Data = obj.d3Data
			node = prepareMarkForDisplay(obj.nodeText, obj.cssText)
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
			visRow = @extractVisData(node, obj.cssText, obj.bbox)
			$.each Object.keys(data[schema].visData), (j, key) ->
				data[schema].visData[key].push(visRow[key])
		
			# and add the node
			if data[schema].hasOwnProperty('node')
				data[schema]['node'].push({'tag': obj.nodeText, 'css': obj.cssText})
			else
				data[schema]['node'] = [{'tag': obj.nodeText, 'css': obj.cssText}]
		
			if data[schema].hasOwnProperty('ids')
				data[schema]['ids'].push(obj.id)
			else
				data[schema]['ids'] = [obj.id]
		
		$.each data, (i, dataSet) ->
			dataSet.numEls = dataSet.d3Data[dataSet.schema[0]].length
			
		return data

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
			mapping = getMapping(dataAttr, visAttr, dataSet)
			if mapping
				console.log ("Found mapping between: " + dataAttr + " and " + visAttr)
				if mappings.hasOwnProperty(dataAttr)
					mappings[dataAttr].push([visAttr, mapping])
				else
					mappings[dataAttr] = [[visAttr, mapping]]
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
	linear_regression_line = ss.linear_regression().data(zipped).line()
	rSquared = ss.r_squared(zipped, linear_regression_line)
	
	if jStat.stdev(col1) is 0 or jStat.stdev(col2) is 0
		return false
	if rSquared > 0.95 and not(isNaN(rSquared))
		console.log "NUMERIC!"
		mapping.dataMin = _.min(col1)
		mapping.dataMinIndex = col1.indexOf(mapping.dataMin)
		mapping.dataMax = _.max(col1)
		mapping.dataMaxIndex = col1.indexOf(mapping.dataMax)
		mapping.visMin = _.min(col2)
		mapping.visMinIndex = col2.indexOf(mapping.visMin)
		mapping.visMax = _.max(col2)
		mapping.visMaxIndex = col2.indexOf(mapping.visMax)
		mapping.isNumericMapping = true
		mapping.ids = ids
		return mapping
	else if not _.some(col2, (val) -> if val % 1 is 0 then true else false)
		return getMappingNominal(col1, col2, ids)
	return false

getSelectedSet = (dataSet) ->
	newDataSet = $.extend(true, {}, dataSet)
	for key of newDataSet.d3Data
		newList = []
		for sel in newDataSet.selections
			newList.push(newDataSet.d3Data[key][sel])
		newDataSet.d3Data[key] = newList
	for key of newDataSet.visData
		newList = []
		for sel in newDataSet.selections
			newList.push(newDataSet.visData[key][sel])
		newDataSet.visData[key] = newList
	for id in newDataSet['ids']
		newList = []
		for sel in newDataSet.selections
			newList.push(newDataSet['ids'][sel])
		newDataSet['ids'][key] = newList
	return newDataSet

restylingApp = angular.module('restylingApp', [])

restylingApp.controller 'MappingListCtrl', ($scope) ->
	$scope._ = _
	$scope.currentDataSet = 0
	$scope.chosenMappings = null
	$scope.addMappingDialog = false
	$scope.addForm = { }
	
	$scope.getSelections = ->
		sels = $scope.dataSets[$scope.currentDataSet].selections
		if (not sels) or sels.length == 0
			return $scope.dataSets[$scope.currentDataSet]['ids']
		else
			return sels
	
	$scope.submitValChange = ->
		message = 
			type: "update"
			attr: $scope.addForm.changeAttr
			val: $scope.addForm.changedAttrValue
			nodes: $scope.getSelections()
		window.connector.sendUpdate(message)
	
	$scope.setChosenMappings = ->
		$scope.addMappingDialog = false
		$scope.chosenMappings = $scope.dataSets[$scope.currentDataSet].mappings
		console.log $scope.dataSets
		console.log $scope.chosenMappings
	
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
				message = 
					type: "update"
					attr: mapping[0]
					val: newAttrVal
					nodes: [id]
				console.log message
				window.connector.sendUpdate(message)
			
	$scope.submitNominalMappingChange = ($event, dataAttr, mappedAttr, newIds) ->
		if $event.keyCode is 13 #enter key
			newCategoryVal = angular.element($event.target).val()
			message =
				type: "update"
				attr: mappedAttr
				val: newCategoryVal
				nodes: newIds
			window.connector.sendUpdate(message)
			
	$scope.selectDataSet = (dataSet) ->
		$scope.currentDataSet = $scope.dataSets.indexOf(dataSet)
	
	$scope.getMappings = ->
		$scope.currentMappings = []
		if (not $scope.dataSets[$scope.currentDataSet].selections) or 
				$scope.dataSets[$scope.currentDataSet].selections.length == 0
			$scope.dataSets[$scope.currentDataSet].mappings = 
				getMappings($scope.dataSets[$scope.currentDataSet])
		else
			selectedSet = getSelectedSet($scope.dataSets[$scope.currentDataSet])
			$scope.selectedSet = selectedSet
			$scope.dataSets[$scope.currentDataSet].mappings = 
				getMappings(selectedSet)
	
	$scope.toggleSelect = (dataSetIndex, elemIndex) ->
		if not $scope.dataSets[dataSetIndex].selections
			$scope.dataSets[dataSetIndex].selections = [elemIndex]
		else
			if elemIndex in $scope.dataSets[dataSetIndex].selections
				$scope.dataSets[dataSetIndex].selections = _.without($scope.dataSets[dataSetIndex].selections, elemIndex)
			else
				$scope.dataSets[dataSetIndex].selections.push(elemIndex)
		$scope.getMappings()
		
	$scope.itemClass = (dataSetIndex, elemIndex) ->
		if not $scope.dataSets[dataSetIndex].hasOwnProperty('selections')
			return undefined
			
		if elemIndex in $scope.dataSets[dataSetIndex].selections
			return 'selected'
		return undefined

prepareMarkForDisplay = (nodeText, cssText) ->
	htmlNode = $(nodeText)[0]
	svgNode = document.createElementNS("http://www.w3.org/2000/svg", htmlNode.tagName.toLowerCase());
	htmlNode.style.cssText = cssText
	tagName = $(htmlNode).prop("tagName").toLowerCase()  #lower case b/c jquery inconsistency
		
	for attr in htmlNode.attributes
		svgNode.setAttribute(attr.name, attr.value)
			
	# circle case
	if tagName == "circle" or tagName == "ellipse"
		d3.select(svgNode).attr "cx", 50
		d3.select(svgNode).attr "cy", 50
		r = d3.select(svgNode).attr "r"
	else
		d3.select(svgNode).attr "x", "0"
		d3.select(svgNode).attr "y", "0"
	return svgNode
		

restylingApp.directive 'svgInject', ($compile) ->
	return link: (scope, element, attrs, controller) ->
		svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
		svg.setAttribute("width", "50")
		svg.setAttribute("height", "50")
		element[0].appendChild(svg)
		markInfo = scope.dataSet['node'][scope.i]
		mark = prepareMarkForDisplay(markInfo['tag'], markInfo['css'])
		svg.appendChild(mark)
		bbox =  mark.getBBox()
		scaleDimVal = bbox.height
		if bbox.width > bbox.height
			scaleDimVal = bbox.width
		newTranslate = "translate(" + (-bbox.x) + "," + (-bbox.y) + ")"
		newScale = "scale(" + 40/scaleDimVal + "," + 40/scaleDimVal + ")"
		d3.select(mark).attr("transform", newScale + newTranslate)
		#angular.element(element).html(angular.element(element).html())
		
$(document).ready () ->
	connector = new VisConnector()
	remappingForm = null
	window.connector = connector