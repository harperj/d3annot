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
					dataSet.mappings = @getMappings(dataSet)
				
				angularScope = angular.element($('body')).scope()
				angularScope.$apply =>
					angularScope.mappings = @dataSets[0].mappings
					angularScope.dataSets = @dataSets
		
	initConnection: (tabId) =>
		@port = chrome.tabs.connect tabId, {name: 'd3annot'}
	
	getDataSetTable: (dataSetId) =>
		return @tableViews[dataSetId].dataTable
	
	getDataSetMappings: (dataSetId) =>
		return @dataSets[dataSetId].mappings
	
	getMappings: (dataSet) =>
		mappings = {}
		for dataAttr of dataSet.d3Data
			for visAttr of dataSet.visData
				mapping = @getMapping(dataSet.dataTypes[dataAttr], dataSet.d3Data[dataAttr], \ 
									dataSet.visTypes[visAttr], dataSet.visData[visAttr])
				if mapping
					console.log ("Found mapping between: " + dataAttr + " and " + visAttr)
					if mappings.hasOwnProperty(dataAttr)
						mappings[dataAttr].push(visAttr)
					else
						mappings[dataAttr] = [visAttr]
		return mappings
	
	getMapping: (dataAttrType, dataAttrCol, visAttrType, visAttrCol) ->
		if dataAttrType is "null" or visAttrType is "null"
			# null data, don't even check
			return false
		else if not(dataAttrType is visAttrType) or 
		(dataAttrType is "nominal")
			# nominal
			return @hasMappingNominal(dataAttrCol, visAttrCol)
		else
			# quantitative/numeric
			return @hasMappingNumeric(dataAttrCol, visAttrCol) || @hasMappingNominal(dataAttrCol, visAttrCol)
			
	hasMappingNominal: (col1, col2) ->
		mapping = {}
		for row1, index in col1
			if mapping.hasOwnProperty(row1)
				mapping[row1].push(col2[index])
			else
				mapping[row1] = [col2[index]]
		for val of mapping
			mapping[val] = _.uniq(mapping[val])
			if mapping[val].length > 1
				return false
		mappedVals = _.flatten(_.values(mapping))
		if _.uniq(mappedVals).length < mappedVals.length
			return false
		return true
	
	hasMappingNumeric: (col1, col2) ->
		corrcoeff = jStat.corrcoeff(col1, col2)
		col1 = _.map(col1, (v) -> parseFloat(v))
		col2 = _.map(col2, (v) -> parseFloat(v))
		if jStat.stdev(col1) is 0 or jStat.stdev(col2) is 0
			return false
		if corrcoeff > 0.99 and not(isNaN(corrcoeff))
			return true
		return false
			
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
		
		visRow["shape"] = node.tagName.toLowerCase()
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
		shape = node.tagName.toLowerCase()
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
				data[schema]['node'].push(@prepareMarkForDisplay(node, obj.cssText))
			else
				data[schema]['node'] = [@prepareMarkForDisplay(node, obj.cssText)]
			
		
		$.each data, (i, dataSet) ->
			dataSet.numEls = dataSet.d3Data[dataSet.schema[0]].length
			
		return data
	

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
	if typeof(hexString) != "string"
		console.error "Got incorrect type in hexToRgb"
		return null
		
	if hexString.charAt(0) == "#"
		hexString = hexString.substring(1, 7)
	
	if hexString.length == 3
		hexString = hexString[0] + hexString[0] \
			+ hexString[1] + hexString[1] \
			+ hexString[2] + hexString[2]
	
	r = parseInt(hexString.substring(0, 2), 16)
	g = parseInt(hexString.substring(2, 4), 16)
	b = parseInt(hexString.substring(4, 6), 16)
	return [r, g, b]
		
isHexColorString = (hexString) ->
	rgb = hexToRgb(hexString)
	if rgb
		if rgb[0] and rgb[1] and rgb[2]
			return true
	false


getMappings = (dataSet) ->
	mappings = {}
	for dataAttr of dataSet.d3Data
		for visAttr of dataSet.visData
			mapping = getMapping(dataSet.dataTypes[dataAttr], dataSet.d3Data[dataAttr], \ 
								dataSet.visTypes[visAttr], dataSet.visData[visAttr])
			if mapping
				console.log ("Found mapping between: " + dataAttr + " and " + visAttr)
				if mappings.hasOwnProperty(dataAttr)
					mappings[dataAttr].push(visAttr)
				else
					mappings[dataAttr] = [visAttr]
	return mappings
	
getMapping = (dataAttrType, dataAttrCol, visAttrType, visAttrCol) ->
	if dataAttrType is "null" or visAttrType is "null"
		# null data, don't even check
		return false
	else if not(dataAttrType is visAttrType) or 
	(dataAttrType is "nominal")
		# nominal
		return hasMappingNominal(dataAttrCol, visAttrCol)
	else
		# quantitative/numeric
		return hasMappingNumeric(dataAttrCol, visAttrCol) or hasMappingNominal(dataAttrCol, visAttrCol)
			
hasMappingNominal = (col1, col2) ->
	mapping = {}
	for row1, index in col1
		if mapping.hasOwnProperty(row1)
			mapping[row1].push(col2[index])
		else
			mapping[row1] = [col2[index]]
	for val of mapping
		mapping[val] = _.uniq(mapping[val])
		if mapping[val].length > 1
			return false
	mappedVals = _.flatten(_.values(mapping))
	if _.uniq(mappedVals).length < mappedVals.length
		return false
	return true
	
hasMappingNumeric = (col1, col2) ->
	corrcoeff = jStat.corrcoeff(col1, col2)
	col1 = _.map(col1, (v) -> parseFloat(v))
	col2 = _.map(col2, (v) -> parseFloat(v))
	if jStat.stdev(col1) is 0 or jStat.stdev(col2) is 0
		return false
	if corrcoeff > 0.99 and not(isNaN(corrcoeff))
		return true
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
	
	return newDataSet

restylingApp = angular.module('restylingApp', [])

restylingApp.controller 'MappingListCtrl', ($scope) ->
	$scope._ = _
	$scope.mappings = 
		'dataAttr1': ['visAttr1', 'visAttr3']
		'dataAttr2': ['visAttr2']
	$scope.currentDataSet = 0
	
	$scope.getMappings = ->
		if (not $scope.dataSets[$scope.currentDataSet].selections) or 
				$scope.dataSets[$scope.currentDataSet].selections.length == 0
			console.log $scope.dataSets[$scope.currentDataSet]
			$scope.mappings = getMappings($scope.dataSets[$scope.currentDataSet])
		else
			selectedSet = getSelectedSet($scope.dataSets[$scope.currentDataSet])
			$scope.mappings = getMappings(selectedSet)
	
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

restylingApp.directive 'svgInject', ($compile) ->
	return link: (scope, element, attrs, controller) ->
		svg = angular.element('<svg width="100" height="100"></svg>')
		svg.append(scope.dataSet['node'][scope.i])
		element.append(svg)
		angular.element(element).html(angular.element(element).html())
		
$(document).ready () ->
	connector = new VisConnector()
	remappingForm = null
	window.connector = connector