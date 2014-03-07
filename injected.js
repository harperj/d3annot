var visInjector = {
  injectJS: function(url) {
    var script = document.createElement('script');
    script.type = "text/javascript";
    script.src = url;
    (document.body || document.head || document.documentElement).appendChild(script);
  },

  addAnnotationBar: function() {
    $(document.body).append("<div class=\"sideBar boxLeft\"><p id=\"demop\"></p><div><textarea id=\"demo\" /></div> <a href=\"#\" id=\"submitLink\">Submit</a></div>");
    $("#submitLink").on("click", function() {
      $("#demop").text($("#demo")[0].value.replace("\n", "<br />"));
    });
  },

  findD3Listener: function(event_type) {
    return function(elem, index) {
      return elem.indexOf("__on" + event_type) > -1
    };
  },

  highlightHoveredElement: function(e) {
    jQuery(".custom-menu").hide(100);
    var elem = e.target || e.srcElement;
    if (prevElement != null) {
      prevElement.classList.remove("mouseOn");
    }
    elem.classList.add("mouseOn");
    prevElement = elem;
  },

  findEventListener: function(elem, event_type, orig_event) {
    var listener = null;

    if (d3.select(elem).on(event_type)) {
      console.log("Found d3 listener.");
      listener = d3.select(elem).on(event_type);
    } else {
      var elem_attributes = Object.keys(elem);
      var listeners = elem_attributes.filter(visInjector.findD3Listener(event_type));
      if (listeners.length > 0) {
        //Found 'harder to find' d3 listener
        listener = elem[listeners[0]];
      }
    }

    try {
      listener.call(elem, elem.__data__);
      console.log("success!");
    } catch (type_error) {
      console.log(type_error);
      // reached error state, try a different argument type
      try {
        console.log(orig_event);
        listener.call(elem, orig_event, orig_event);
        console.log("success!");
      } catch (type_error) {
        console.log(type_error);
        return null;
      }
    }

    return listener;
  },

  linkHoveredElement: function(e) {
    var elem = e.target || e.srcElement;
    console.log(Object.keys(elem));
		
		console.log(e.screenX);
		console.log(e.screenY);
		console.log(e.clientY);

    d3.select(elemToLink).on('mouseover', function(event) {
      var evt = document.createEvent("MouseEvents");
      evt.initMouseEvent("mouseover", true, true, window, 0,
        e.screenX, e.screenY, e.clientX, e.clientY,
        false, false, false, false, 0, null);
      elem.dispatchEvent(evt);
    });

    d3.select(elemToLink).on('mouseout', function(event) {
      var evt = document.createEvent("MouseEvents");
      evt.initMouseEvent("mouseout", true, true, window, 0,
        e.screenX, e.screenY, e.clientX, e.clientY,
        false, false, false, false, 0, null);
      elem.dispatchEvent(evt);
    });

    jQuery(document).off('mousemove', visInjector.highlightHoveredElement);
    d3.selectAll(".mouseOn").classed("mouseOn", false);
    jQuery(document).unbind('click', visInjector.linkHoveredElement);
  },

  linkHoveredElementClick: function(e) {
    var elem = e.target || e.srcElement;

    d3.select(elemToLink).on('click', function(event) {
      var evt = document.createEvent("MouseEvents");
      evt.initMouseEvent("click", true, true, window, 0,
        e.screenX, e.screenY, e.clientX, e.clientY,
        false, false, false, false, 0, null);
      elem.dispatchEvent(evt);
    });

    jQuery(document).off('mousemove', visInjector.highlightHoveredElement);
    d3.selectAll(".mouseOn").classed("mouseOn", false);
    jQuery(document).unbind('click', visInjector.linkHoveredElementClick);
  },

  extractClassHoveredElement: function(e) {
    if (d3.select(e)[0][0].classList.length == 0) {
      console.log("Empty class list");
    } else {
      console.log("class list not empty");
    }
  },

  extractTagHoveredElement: function(e) {
    // Save data from tag selector to a JSON file
    // visInjector.saveDataJSON(e.tagName);

    // Send data to content script
    //visInjector.showDataInOverlay(e.tagName);
		
		visInjector.exportDataToPlugin(e.tagName);
  },

  showDataInOverlay: function(selector) {
    var elems = d3.selectAll(selector);

    var overlay = $('<div id=\'overlay\'></div>');
		var elems_generated = [];
		var content = $('<table id="extracted_content" style="border:1px solid black; font:11pt;"></table>');
		var foot = $('<tfoot></tfoot>');
		last_set = []
		elems.each(function(datum, i) {
			if (i < 100) { 
			if (datum instanceof Object) {
				for (prop in datum) {
					// if we didn't find the object
					if ($.inArray(prop, last_set) == -1) {
						last_set = Object.keys(datum);
						console.log(Object.keys(datum));
						console.log("new schema");
						
						var head = $('<thead></thead>');
						var row = $('<tr></tr>');
						//for (var i = 0; i < last_set.length; ++i) {
						for (var i = 0; i < 2; ++i) {
							$(row).append($('<th style="font:11pt;">' + last_set[i] + '</th>'));
						}
						$(row).append($('<th>selector</th>'));
						
						head.append(row);
						content.append(head);
						
						break;
					}
				}
				
				var callback_gen = function(elem, event_type) {
					return function(event) {
						var client_rect = $(elem)[0].getBoundingClientRect();
						var bbox = $(elem).offset();
						
			      var evt = document.createEvent("MouseEvents");
						
			      evt.initMouseEvent(event_type, true, true, window, 0,
			        (bbox.left+bbox.right)/2, (bbox.top+bbox.bottom)/2, (client_rect.left+client_rect.right)/2, (client_rect.top+client_rect.bottom)/2,
			        false, false, false, false, 0, null);
						elem.dispatchEvent(evt);
					};
				}
				
				var row = $('<tr></tr>');
				//for (var i = 0; i < last_set.length; ++i) {
				for (var i = 0; i < 2	; ++i) {
					var col = $('<td style="border-left:1px solid black; font-size:8pt;">' + datum[last_set[i]] + '</td>');
					$(row).append(col);
				}
				
				// Y VALUE PICKER
				var div = $('<div id="slider'+i+'"></div>');
				$(div).slider();
				$(div).on("slidechange", (function(elem) {
				  return function(event,ui) {
					  var translate = elem.getTransformToElement();
						console.log(translate);
						console.log($(div).slider("value"));
						var move_val = $(div).slider("value") - 50;
						d3.select(elem).attr("transform", "translate("+translate.e+","+(translate.f+move_val)+")");
					};
				})(this));
				
				var col = $('<td style="border-left:1px solid black; font-size:8pt;"></td>');
				$(col).append(div);
				$(row).append(col);
				
				// COLOR PICKER
				var inp = $('<input type="text">');
				var col = $('<td style="border-left:1px solid black; font-size:8pt;"></td>');
				$(col).append(inp);
				var color = this.getAttributeNS(null,'fill');
				if (color === "") {
					color = $(this).css('color');
				}
				jQuery(inp).spectrum({
					color: color,
					move: (function(elem) {
						return function(color) {
							var rgb = color.toRgb();
							d3.select(elem).attr("fill", "rgb("+rgb.r+","+rgb.g+","+rgb.b+")");
							d3.select(elem).style({'fill': "rgb("+rgb.r+","+rgb.g+","+rgb.b+")"})
							console.log(elem);
						}
					})(this)
				});
				$(row).append(col);
				
				// ALL COLOR PICKER
				inp = $('<input type="text">');
				col = $('<td style="border-left:1px solid black; font-size:8pt;"></td>');
				$(col).append(inp);
				jQuery(inp).spectrum({
					move: (function(elem) {
						return function(color) {
							var rgb = color.toRgb();
							d3.selectAll(selector).attr("fill", "rgb("+rgb.r+","+rgb.g+","+rgb.b+")");
							d3.selectAll(selector).style({'fill': "rgb("+rgb.r+","+rgb.g+","+rgb.b+")"})
							console.log(elem);
						}
					})(this)
				});
				$(row).append(col);
				
				
				$(row).on('mouseover', callback_gen(this, "mouseover"));
				$(row).on('mouseout', callback_gen(this, "mouseout"));
				$(foot).append(row);
			}
			}
			
			
			content.append(foot);
			
			// var completeStyle = window.getComputedStyle(this, null).cssText;
			// var newNode = $.clone(this);
			// console.log(completeStyle);
			// newNode.style.cssText = completeStyle;
			// $(content).append(newNode);
		});
		console.log(content);
		$(overlay).append(content);
		console.log(overlay);
    $(overlay).dialog();
		//$("#extracted_content").dataTable();
  },

  exportDataToPlugin: function(selector) {
		var data = []
		console.log(selector);
		d3.selectAll(selector).each(function(d, i) {
			var item = {};
			item.d3Data = d3.select(this).node().__data__;
			console.log(item.d3Data);
			item.nodeText = this.outerHTML;
			item.cssText = window.getComputedStyle(this, null).cssText;
			data.push(item);
		});
		// console.log(data);
		// data = d3.selectAll(selector).data();
		// console.log(data);
		// data.nodes = [];
		// var nodes = $(selector);
		// $.each(nodes, function(index, node) {
		// 	data.nodes.push(node, window.getComputedStyle(this, null).cssText);
		// });
    var evt = document.createEvent("CustomEvent");
    evt.initCustomEvent("dataExportEvent", true, true, data);
    document.dispatchEvent(evt);
  },

  extractHoveredElement: function(e) {
    var elem = e.target || e.srcElement;

    var elem_children = jQuery(elem).find('*');
    visInjector.saveDataJSON(elem_children);

    jQuery(document).off('mousemove', visInjector.highlightHoveredElement);
    d3.selectAll(".mouseOn").classed("mouseOn", false);
    jQuery(document).unbind('click', visInjector.extractHoveredElement);
  },

  saveDataJSON: function(selector) {
    var blob = new Blob([JSON.stringify(d3.selectAll(selector).data(), undefined, 2)], {
      type: "text/json;charset=" + document.characterSet
    });
    saveAs(blob, "extracted_data.json");
  }

}

var prevElement = null;
var elemToLink = null;
var lastSelection = null;
var lastNode = null;
var num_links = 0;


jQuery("<ul class='custom-menu'><li data-action='link'>Link selection (mouseover)</li><li data-action='link_click'>Link selection with click</li><li data-action='extract'>Extract data by class</li><li data-action='extract_tag'>Extract data by tag</li><li data-action='extract_container'>Extract data by container</li></ul>")
  .appendTo("body")
  .hide();

jQuery(document).bind("contextmenu", function(event) {
  lastNode = event.target;
  var sel = document.getSelection();
  lastSelection = sel.getRangeAt(0);
  //if (sel.type == "Range" && sel.baseNode instanceof Text) {
  event.preventDefault();
  jQuery(".custom-menu")
    .toggle(100)
    .css({
      display: "inline",
      top: event.pageY + "px",
      left: event.pageX + "px"
    });

});

jQuery(document).on("click", function(event) {
  jQuery(".custom-menu").hide(100);
});

jQuery(".custom-menu li").on("mouseover", function(event) {
  if (jQuery(this).attr("data-action") == "extract_tag") {
    d3.selectAll(lastNode.tagName).classed("mouseOn", true);
  }
});

jQuery(".custom-menu li").on("mouseout", function(event) {
  if (jQuery(this).attr("data-action") == "extract_tag") {
    d3.selectAll(lastNode.tagName).classed("mouseOn", false);
  }
});


jQuery(".custom-menu li").click(function(event) {
  event.stopPropagation();
  // This is the triggered action name
  if (jQuery(this).attr("data-action") == "link") {
    var wrapper_elem = document.createElement("span");
    jQuery(wrapper_elem).addClass("storylink");
    lastSelection.surroundContents(wrapper_elem);
    elemToLink = wrapper_elem;

    jQuery(document).on('mousemove', visInjector.highlightHoveredElement);
    jQuery(document).bind('click', visInjector.linkHoveredElement);
  }

  if (jQuery(this).attr("data-action") == "link_click") {
    var wrapper_elem = document.createElement("span");
    jQuery(wrapper_elem).addClass("storylink");
    lastSelection.surroundContents(wrapper_elem);
    elemToLink = wrapper_elem;

    jQuery(document).on('mousemove', visInjector.highlightHoveredElement);
    jQuery(document).bind('click', visInjector.linkHoveredElementClick);
  } else if (jQuery(this).attr("data-action") == "extract") {
    visInjector.extractClassHoveredElement(lastNode);
  } else if (jQuery(this).attr("data-action") == "extract_tag") {
    visInjector.extractTagHoveredElement(lastNode);
  } else if (jQuery(this).attr("data-action") == "extract_container") {
    jQuery(document).on('mousemove', visInjector.highlightHoveredElement);
    jQuery(document).bind('click', visInjector.extractHoveredElement);
  }
});
