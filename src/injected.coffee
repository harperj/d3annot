prevElement = null
elemToLink = null
lastNode = null
num_links = 0


getPointFromLine = (node, ind) ->
	segList = node.animatedPathSegList
	console.log "made it here"
	return [segList[ind].x, segList[ind].y]

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

getRootSVG = (node) ->
	while node and node.tagName != 'svg'
		node = node.parentNode
	return node

class VisUpdater
	constructor: ->
		
		
	extractDataFromSelection: (selection) =>
		data = []
		@id_counter = 0
		elem_map = []
		selection = selection[0]
		for node in selection
			item = {}
			#console.log this.tagName.toLowerCase()
			unless node.tagName in ["rect", "circle", "path", "line", "polygon", "text"]
				continue
			#else if this.tagName.toLowerCase() in ['path']
			#	parseLinePath(this.getAttribute('d'))
			if node.parentElement.tagName.toLowerCase() is 'clippath'
				continue
				
			if node instanceof SVGElement
				item.id = @id_counter
				@id_counter++;
				item.d3Data = node.__data__
				item.nodeText = node.outerHTML
				item.cssText = window.getComputedStyle(node, null).cssText
				item.bbox = transformedBoundingBox(node, null)
				item.bbox = {height: item.bbox.height, width: item.bbox.width, x: item.bbox.x, y: item.bbox.y}
				elem_map.push
					"current": node
					"currentBBox": transformedBoundingBox(node)
				data.push(item)
				
		#console.log data
		@elem_map = elem_map
		return data
		
	exportSelectorDataToVis: (selector) ->
		console.log "exporting selector data to vis"
		@data = @extractDataFromSelection(d3.selectAll(selector))
		console.log @data
		@exportDataToVis(@data)
		
	addDataToVis: (data) ->
		evt = document.createEvent "CustomEvent"
		evt.initCustomEvent("addDataEvent", true, true, data)
		document.dispatchEvent(evt)
		
	exportDataToVis: (data) ->
		evt = document.createEvent "CustomEvent"
		evt.initCustomEvent("dataExportEvent", true, true, data)
		#console.log evt
		document.dispatchEvent(evt)
		
	makeLine: (msg) ->
		nodeIds = msg.ids
		d = ""
		baseNode = null
		for nodeId,i in nodeIds
			node = @elem_map[nodeId]["current"]
			svgNode = getRootSVG(@elem_map[nodeId]["current"])
			bbox = node.getBBox()
			if i == 0
				baseNode = node
				d = d.concat("M")
				d = d.concat("#{bbox.x},#{bbox.y}")
			else
				transform = node.getTransformToElement(baseNode)
				pt = svgNode.createSVGPoint()
				pt.x = bbox.x + (bbox.width / 2)
				pt.y = bbox.y + (bbox.height / 2)
				pt = pt.matrixTransform(transform)
				d = d.concat("L#{pt.x},#{pt.y}")
			
		newLine = document.createElementNS("http://www.w3.org/2000/svg", "path")
		newLine.setAttribute("d", d)
		baseNode.parentNode.appendChild(newLine)
		
	breakLine: (data) ->
		lineId = data.id
		ptShape = data.shape
		lineNode = @elem_map[lineId]["current"]
		svg = getRootSVG(@elem_map[lineId]["current"])
		
		dataArray = null
		otherAttrs = {}
		if lineNode.__data__ instanceof Array
			dataArray = lineNode.__data__
		else if lineNode.__data__ instanceof Object
			for attr, val of lineNode.__data__
				if val instanceof Array
					dataArray = val
				else
					otherAttrs[attr] = val
		
		segList = lineNode.animatedPathSegList
		#console.log "made it here"
		newDataSet = []
		for seg, i in lineNode.animatedPathSegList
			ptNode = getNodeFromShape(ptShape)
			lineNode.parentNode.appendChild(ptNode)
			translate = svg.createSVGTransform()
			translate.setTranslate(seg.x, seg.y)
			ptNode.transform.baseVal.appendItem(translate)
			newElem = {}
			newElem.id = @id_counter
			@id_counter++;
			
			newElem.d3Data = dataArray[i]
			for attr, val of otherAttrs
				newElem.d3Data[attr] = val
			
			newElem.nodeText = ptNode.outerHTML
			newElem.cssText = window.getComputedStyle(ptNode, null).cssText
			newElem.bbox = transformedBoundingBox(ptNode)
			newElem.bbox = {height: newElem.bbox.height, width: newElem.bbox.width, x: newElem.bbox.x, y: newElem.bbox.y}
			@elem_map.push
				"current": ptNode
				"currentBBox": transformedBoundingBox(ptNode)
			newDataSet.push(newElem)
		
		@addDataToVis(newDataSet)
		$(lineNode).remove()
		
	getUpdatedClone: (id, attr, val) ->
		currentBBox = @elem_map[id]["currentBBox"]
		parentNode = @elem_map[id]["current"].parentElement
		svg = getRootSVG(@elem_map[id]["current"])
		clone = null
		currentTag = @elem_map[id]["current"].tagName.toLowerCase()
		
		
		
		if attr is "shape"
			clone = getNodeFromShape(val)
		else if currentTag is "polygon"
			clone = getNodeFromShape(currentTag, @elem_map[id]["current"].getAttribute("points"))
		else if currentTag is "path"
			clone = getNodeFromShape(currentTag, @elem_map[id]["current"].getAttribute("d"))
		else
			clone = getNodeFromShape(currentTag)
			
		# fix for lines, they need a size before bboxing
		for currAttr in @elem_map[id]["current"].attributes
			if currAttr.name in ["x1", "y1", "x2", "y2", "dy"]
				clone.setAttribute(currAttr.name, currAttr.value)
		
		#if we are a text node we need to fill in the text before taking size
		if $(@elem_map[id]["current"]).text() != ""
			clone.textContent = $(@elem_map[id]["current"]).text()
			
		parentNode.appendChild(clone)
		bbox = transformedBoundingBox(clone, svg)
		#console.log bbox
		#console.log clone
		
		for currAttr in @elem_map[id]["current"].attributes
			if not (currAttr.name in ["width", "height", "id", "cx", "cy", "x", 
				"y", "r", "transform", "points", "requiredFeatures", "systemLanguage", 
				"requiredExtensions", "vector-effect"])
				clone.setAttribute(currAttr.name, currAttr.value)
		clone.setAttribute("vector-effect", "non-scaling-stroke")

		if attr is "fill-color"
			attr = "fill"
			d3.select(clone).style("fill", val)			
		else if attr is "stroke-color"
			attr = "stroke"
			d3.select(clone).style(attr, val)
		else if not (attr in ["x-position", "y-position", "shape", "width", "height"])
			d3.select(clone).attr(attr, val)

		# Current elements might have translation in attributes.  
		# If so we need to move the translation into an actual transform.
		
		parentOffset = [0, 0]
		if currentTag is "circle"
			cx = parseFloat(d3.select(@elem_map[id]["current"]).attr("cx"))
			cy = parseFloat(d3.select(@elem_map[id]["current"]).attr("cy"))
			if cx then parentOffset[0] = cx
			if cy then parentOffset[1] = cy
		else if currentTag in ["rect", "text"]
			x = parseFloat(d3.select(@elem_map[id]["current"]).attr("x"))
			y = parseFloat(d3.select(@elem_map[id]["current"]).attr("y"))
			if x then parentOffset[0] = x
			if y then parentOffset[1] = y

		# Done handling attributes.  Now translation, then scaling.
		currentX = @elem_map[id]["currentBBox"].x
		currentY = @elem_map[id]["currentBBox"].y
		currentCenterX = currentX + (@elem_map[id]["currentBBox"].width / 2)
		currentCenterY = currentY + (@elem_map[id]["currentBBox"].height / 2)
		cloneWidth = bbox.width
		cloneHeight = bbox.height
		currentWidth = @elem_map[id]["currentBBox"].width
		currentHeight = @elem_map[id]["currentBBox"].height
		
		translate = svg.createSVGTransform()
		parentTrans = @elem_map[id]["current"].getTransformToElement(svg)
		trans = clone.getTransformToElement(svg)
			
		if clone.tagName.toLowerCase() in ["circle", "polygon"] and
		not (currentTag in ["circle", "polygon"])
			#console.log "applying offset"
			centerOffsetX = currentWidth / 2
			centerOffsetY = currentHeight / 2
			#console.log "current transform: #{parentTrans.e-trans.e+parentOffset[0]+centerOffsetX} , #{parentTrans.f-trans.f+parentOffset[1]+centerOffsetY}"
			translate.setTranslate(parentTrans.e-trans.e+parentOffset[0]+centerOffsetX, parentTrans.f-trans.f+parentOffset[1]+centerOffsetY)
		else if not (clone.tagName.toLowerCase() in ["circle", "polygon"]) and
		currentTag in ["circle", "polygon"]
			#console.log "applying offset"
			centerOffsetX = currentWidth / 2
			centerOffsetY = currentHeight / 2
			#console.log "current transform: #{parentTrans.e-trans.e+parentOffset[0]-centerOffsetX} , #{parentTrans.f-trans.f+parentOffset[1]-centerOffsetY}"
			translate.setTranslate(parentTrans.e-trans.e+parentOffset[0]-centerOffsetX, parentTrans.f-trans.f+parentOffset[1]-centerOffsetY)
		else
			#console.log "current transform: #{parentTrans.e-trans.e+parentOffset[0]} , #{parentTrans.f-trans.f+parentOffset[1]}"
			translate.setTranslate(parentTrans.e-trans.e+parentOffset[0], parentTrans.f-trans.f+parentOffset[1])
			
		clone.transform.baseVal.appendItem(translate)
		
		
		# We'll do another translation based on our change to the position if necessary
		if attr is "x-position"
			newX = parseFloat(val)
			xtranslate = svg.createSVGTransform()
			xtranslate.setTranslate(newX-currentCenterX, 0)
			clone.transform.baseVal.appendItem(xtranslate)
		else if attr is "y-position"
			newY = parseFloat(val)
			ytranslate = svg.createSVGTransform()
			ytranslate.setTranslate(0, newY-currentCenterY)
			clone.transform.baseVal.appendItem(ytranslate)	
		
			
		scale = svg.createSVGTransform()
		if bbox.width == 0
			cloneWidth = 1
		if bbox.height == 0
			cloneHeight = 1
		if currentWidth == 0
			currentWidth = 1
		if currentHeight == 0
			currentHeight = 1
			

		if attr is "width"
			newWidth = parseFloat(val)
			#console.log cloneWidth
			scale.setScale((newWidth / cloneWidth), (currentHeight / cloneHeight))
			offCenterTranslate = svg.createSVGTransform()
			unless currentTag in ["circle", "polygon"]
				newCenterX = currentX + newWidth / 2
				offCenterTranslate.setTranslate(currentCenterX - newCenterX, 0)
				clone.transform.baseVal.appendItem(offCenterTranslate)			
		else if attr is "height"
			newHeight = parseFloat(val)
			scaleFactor = newHeight / cloneHeight
			scale.setScale(currentWidth / cloneWidth, scaleFactor)	
			offCenterTranslate = svg.createSVGTransform()
			unless currentTag in ["circle", "polygon"]
				newCenterY = currentY + newHeight / 2
				offCenterTranslate.setTranslate(0, currentCenterY - newCenterY)
				clone.transform.baseVal.appendItem(offCenterTranslate)										
		else 
			scale.setScale(currentWidth / cloneWidth, currentHeight / cloneHeight)
		clone.transform.baseVal.appendItem(scale)

		@elem_map[id]["currentBBox"] = transformedBoundingBox(clone, svg)
		return clone	
		
	update: (updateData) =>
		newNodes = []
		for id in updateData.nodes
			newNode = @getUpdatedClone(id, updateData.attr, updateData.val)
			newNodes.push(newNode)
			
			@returnNodeToTable(newNode, id)
			
		for i in [0..newNodes.length-1]
			oldNodeData = @elem_map[updateData.nodes[i]]
			if not oldNodeData.hasOwnProperty("orig")
				@elem_map[updateData.nodes[i]]["orig"] = @elem_map[updateData.nodes[i]]["current"]
				$(@elem_map[updateData.nodes[i]]["orig"]).hide()
				@elem_map[updateData.nodes[i]]["current"] = newNodes[i]
			else
				$(@elem_map[updateData.nodes[i]]["current"]).remove()
				@elem_map[updateData.nodes[i]]["current"] = newNodes[i] 
		
	returnNodeToTable: (node, id) =>
		bbox = transformedBoundingBox(node)
		message = 
			nodeText: node.outerHTML
			cssText: window.getComputedStyle(node, null).cssText
			bbox: {height: bbox.height, width: bbox.width, x: bbox.x, y: bbox.y}
			id: id
		evt = document.createEvent "CustomEvent"
		evt.initCustomEvent("markUpdateEvent", true, true, message)
		document.dispatchEvent(evt)	
		
shapeSpecs = 
	"triangle": "-20,-17 0,17 20,-17"
	"star": "10,0, 4.045084971874736,2.938926261462366, 3.090169943749474,9.510565162951535, -1.545084971874737,4.755282581475767, -8.090169943749473,5.877852522924733, -5,6.12323399409214e-16, -8.090169943749473,-5.87785252292473, -1.5450849718747377,-4.755282581475767, 3.0901699437494727,-9.510565162951535, 4.045084971874736,-2.9389262614623664"
	"plus": "-1,-8 1,-8 1,-1 8,-1 8,1 1,1 1,8 -1,8 -1,1 -8,1 -8,-1 -1,-1"
	"diamond": "1,0 0,2 -1,0 0,-2"
				
getNodeFromShape = (val, currentPts = null) ->
	clone = null
	if val in ["triangle", "plus", "star", "diamond"]
		clone = document.createElementNS("http://www.w3.org/2000/svg", "polygon")
		if val is "triangle"
			clone.setAttribute("points", shapeSpecs["triangle"])
		else if val is "star"
			clone.setAttribute("points", shapeSpecs["star"])
		else if val is "plus"
			clone.setAttribute("points", shapeSpecs["plus"])
		else if val is "diamond"
			clone.setAttribute("points", shapeSpecs["diamond"])
	else if val is "rect"
		clone = document.createElementNS("http://www.w3.org/2000/svg", val)
		clone.setAttribute("width", 1)
		clone.setAttribute("height", 1)
	else if val is "circle"
		clone = document.createElementNS("http://www.w3.org/2000/svg", val)
		clone.setAttribute("r", 1)
	else if val is "polygon"
		clone = document.createElementNS("http://www.w3.org/2000/svg", "polygon")
		clone.setAttribute("points", currentPts)
	else if val is "path"
		clone = document.createElementNS("http://www.w3.org/2000/svg", val)
		clone.setAttribute("d", currentPts)
	else
		clone = document.createElementNS("http://www.w3.org/2000/svg", val)
	return clone
				
parseLinePath = (dString) ->
	if dString[0] != 'M'
		return
	sliceCount = 1
	
	rest = dString.slice(sliceCount)
	xVal = parseFloat(rest)
	if isNaN(xVal)
		return false	
	sliceCount += xVal.toString().length
	rest = dString.slice(sliceCount)
	if rest[0] != ","
		return false
	sliceCount++
	rest = dString.slice(sliceCount)
	yVal = parseFloat(rest)
	
	#console.log "#{xVal} , #{yVal}"

visUpdater = new VisUpdater()
document.addEventListener 'visUpdateEvent', (event) ->
	visUpdater.update(event.detail)
	
document.addEventListener 'breakLineEvent', (event) ->
	visUpdater.breakLine(event.detail)

document.addEventListener 'makeLineEvent', (event) ->
	visUpdater.makeLine(event.detail)

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

$(document).bind "contextmenu", (event) ->
	ancestorSVG = $(event.target).closest("svg")
	#console.log ancestorSVG
	if ancestorSVG.length > 0
		event.preventDefault()
		svgChildren = $(ancestorSVG).find('*')
		visUpdater.exportDataToVis(visUpdater.extractDataFromSelection(d3.selectAll(svgChildren)))
