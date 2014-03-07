var dat = {};
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
	if (message.type == "syn") {
		loadData(message.payload);
		dat = message.payload;
		console.log(message.payload);
		//processPayload(message.payload);
		initConnection(sender.tab.id);
	}
});

function processPayload(payload) {
	data = [];
	var schema_count = -1;
	var last_schema = [];
	
	for (var i = 0; i < payload.length; ++i) {
		console.log(i);
		// check to see if we have a new schema
		if (payload[i].d3Data instanceof Object) {
			for (prop in payload[i].d3Data) {
				// if we find a property that isn't in our previous schema, create a new table.
				if ($.inArray(prop, last_schema) == -1) {
					last_schema = Object.keys(payload[i].d3Data);
					schema_count++;
					data[schema_count] = {};
					data[schema_count].d3Schema = Object.keys(payload[i].d3Data);
					break;
				}
			}
			
			for (prop in payload[i].d3Data) {
				if (data[schema_count].hasOwnProperty(prop)) {
					data[schema_count][prop].push(payload[i].d3Data[prop]);
				}
				else {
					data[schema_count][prop] = [payload[i].d3Data[prop]];
				}
			}
			
			var node = $(payload[i].nodeText)[0];
			var r = parseFloat(d3.select(node).attr("cx"));
			if (data[schema_count].hasOwnProperty("cx")) {
				data[schema_count]["cx"].push(r);
			}
			else {
				data[schema_count]["cx"] = [r];
			}
			
		}
	}
	dat = data;
		
}

function initConnection(tabId) {
	var port = chrome.tabs.connect(tabId, {name: 'd3annot'});
}

function makeSVG(tag, attrs) {
	var el= document.createElementNS('http://www.w3.org/2000/svg', tag);
	for (var k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}

function loadData(payload) {
	var data = payload;
	var last_schema = [];
	var content = $('<table id="extracted_content" style="border:1px solid black; font:11pt;"></table>');
	var foot = $('<tfoot></tfoot>');
	console.log("test");
	console.log(data.length);
	for (var i = 0; i < data.length; ++i) {
		// check to see if we have a new schema
		if (data[i].d3Data instanceof Object) {
			for (prop in data[i].d3Data) {
				// if we find a property that isn't in our previous schema, create a new table.
				if ($.inArray(prop, last_schema) == -1) {
					last_schema = Object.keys(data[i].d3Data);

					console.log("new schema");
					var head = createHeader(last_schema);
					content.append(head);
					break;
				}
			}
		
			// we are sure to have a header now.  let's create the current row
			var row = $('<tr></tr>');
			for (var j = 0; j < last_schema.length; ++j) {
				if (i === 62) console.log(data[i]);
				var col = $('<td style="border-left:1px solid black; font-size:8pt;">' + data[i].d3Data[last_schema[j]] + '</td>');
				$(row).append(col);
			}
			var col = $('<td style="border-left:1px solid black; font-size:8pt; width:100px; height:100px;"></td>');
			var svg = $('<svg width="100" height="100"></svg>');
			
			var el = updateElForTable(data[i].nodeText, data[i].cssText);
			
			if (el != null) $(svg).append(el);
			$(col).append(svg);
			$(row).append(col);
			content.append(row);
		}
	}
	$('body').append(content);
	$("body").html($("body").html());
}

function updateElForTable(nodeText, cssText) {
	var el = $(nodeText)[0];
	console.log(el.attributes);
	var tagName = $(el).prop("tagName").toLowerCase(); // lower case because difference jQuery versions behave differently
	// circle case
	if (tagName == "circle" || tagName == "ellipse") {
		d3.select(el).attr("cx", 50);
		d3.select(el).attr("cy", 50);
		el.style.cssText = cssText;
		return el;
	}
	else {
		return null;
	}
}

function createHeader(properties) {
	var head = $('<thead></thead>');
	var row = $('<tr></tr>');
	for (var i = 0; i < properties.length; ++i) {
		$(row).append($('<th style="font:11pt;">' + properties[i] + '</th>'));
	}
	head.append(row);
	return head;
}
