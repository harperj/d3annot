"use strict";
(function () {

    /** Binds right click to initiate deconstruction on the root SVG node. **/
    $(document).bind("contextmenu", function (event) {
        var ancestorSVG = $(event.target).closest("svg");
        if (ancestorSVG.length > 0) {
            event.preventDefault();
            return visDeconstruct(ancestorSVG);
        }
    });

    /**
     * Accepts a top level SVG node and deconstructs it by extracting data, marks, and the
     * mappings between them.
     * @param svgNode - Top level SVG node of a D3 visualization.
     */
    function visDeconstruct(svgNode) {
        var dataNodes = extractData(svgNode);
        var attrData = extractVisAttrs(dataNodes.nodes);
        var schematizedData = schematize(dataNodes.data, dataNodes.ids, attrData);

        console.log(schematizedData);

        _.each(schematizedData, function(schema, i) {
            schematizedData[i].mappings = extractMappings(schema);
        });

        // Now send a custom event with dataNodes to the content script
        var evt = document.createEvent("CustomEvent");
        evt.initCustomEvent("deconData", true, true, dataNodes);
        document.dispatchEvent(evt);
    }

    function extractMappings (schema) {
        if (typeof schema.schema !== "object") {
            return;
        }

        var schemaMappings = [];

        _.each(schema.schema, function(schemaItem) {
            var dataArray = _.map(schema.nodes, function(node) {
                return node.data[schemaItem];
            });

            var attrNames = _.keys(schema.nodes[0].attrs);

            _.each(attrNames, function(attrName) {
                var attrArray = _.map(schema.nodes, function(node) {
                    return node.attrs[attrName];
                });

                if (typeof dataArray[0] === "number" && typeof attrArray[0] === "number") {
                    var linearMapping = extractLinearMapping(dataArray, attrArray);
                }
                else if(typeof attrArray[0] === "color") {

                }

            });
        });
    }

    function extractLinearMapping() {

    }

    /**
     * Groups nodes by 'schema', the data type or set of data types contained in their D3-bound data.
     * @returns {Array} - Array of schemas, each containing a list of information about mark-generating SVG nodes
     * @param data
     * @param ids
     * @param attrs
     */
    function schematize (data, ids, attrs) {
        var dataSchemas = [];
        for (var i = 0; i < data.length; ++i) {
            var nodeObj = {
                data: data[i],
                id: ids[i],
                attrs: attrs[i]
            };

            var currSchema;
            if (typeof data[i] === "object") {
                currSchema = _.keys(data[i]);
            }
            else if (typeof data[i] === "number") {
                currSchema = "number";
            }
            else {
                currSchema = "string";
            }

            var foundSchema = false;
            for (var j = 0; j < dataSchemas.length; ++j) {
                if (dataSchemas[j].schema === currSchema) {
                    foundSchema = true;
                    dataSchemas[j].nodes.push(nodeObj);
                    break;
                }
                else if (typeof currSchema === "object") {
                    // If their intersection is the same length, they have the same elements
                    if (_.intersection(currSchema, dataSchemas[j].schema).length == currSchema.length) {
                        foundSchema = true;
                        dataSchemas[j].nodes.push(nodeObj);
                        break;
                    }
                }
            }

            if (!foundSchema) {
                var newSchema = {
                    schema: currSchema,
                    nodes: [nodeObj]
                };
                dataSchemas.push(newSchema);
            }
        }

        return dataSchemas;
    }

    function extractData(svgNode) {
        var svgChildren = $(svgNode).find('*');
        var data = [];
        var nodes = [];
        var ids = [];

        /** List of tag names which generate marks in SVG and are accepted by our system. **/
        var markGeneratingTags = ["circle", "ellipse", "rect", "path", "polygon", "text"];

        for (var i = 0; i < svgChildren.length; ++i) {
            var node = svgChildren[i];
            if (node.__data__ && _.contains(markGeneratingTags, node.tagName.toLowerCase())) {
                var nodeData = node.__data__;
                nodeData.deconID = i;

                data.push(nodeData);
                nodes.push(node);
                ids.push(i);
            }
        }

        data = fixTypes(data);
        return {data: data, nodes: nodes, ids: ids};
    }

    function extractVisAttrs (nodes) {
        var visAttrData = [];

        for (var i = 0; i < nodes.length; ++i) {
            var node = nodes[i];
            var style = extractStyle(node);
            style.shape = node.tagName;

            var boundingBox = transformedBoundingBox(node);
            style.xPosition = boundingBox.x + (boundingBox.width / 2);
            style.yPosition = boundingBox.y + (boundingBox.height / 2);
            style.width = boundingBox.width;
            style.height = boundingBox.height;

            visAttrData.push(style);
        }
        visAttrData = fixTypes(visAttrData);
        return visAttrData;
    }

    /**
     * All style and some data attributes are extracted as strings, though some are number data or
     * colors, a more complex type in reality.  This function parses those types and
     * replaces the strings with the appropriate data types.
     * @param objArray - Array of objects
     * @returns {*} - objArray object with updated data types
     */
    function fixTypes (objArray) {

        var fieldType = {};
        var rgbRegex = /^rgb\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})\)$/;
        var object, property, rgbChannels;

        // Find the most specific type for each style attribute
        for (var i = 0; i < objArray.length; ++i) {
            object = objArray[i];
            if (typeof object !== "object") {
                continue;
            }

            for (property in object) {
                if (object.hasOwnProperty(property)) {
                    rgbChannels = rgbRegex.exec(object[property]);
                    // If this is our first pass, set it to whatever we see
                    if (!fieldType.hasOwnProperty(property)) {
                        if (!isNaN(+object[property])) {
                            // This is a number
                            fieldType[property] = "number";
                        }
                        else if (rgbChannels) {
                            fieldType[property] = "color";
                        }
                        else {
                            fieldType[property] = "string";
                        }
                    }
                    // In the future, generalize to string if not all match number/color
                    else {
                        if (fieldType[property] === "number" && isNaN(+object[property])) {
                            fieldType[property] = "string";
                        }
                        else if (fieldType[property] === "color" && !rgbChannels) {
                            fieldType[property] = "string";
                        }
                    }
                }
            }
        }

        // Now based on the types found we need to change the JS datatypes as necessary
        for (var j = 0; j < objArray.length; ++j) {
            object = objArray[j];
            for (var attr in object) {
                if (object.hasOwnProperty(attr)) {
                    if (fieldType[attr] === "number") {
                        object[attr] = +object[attr];
                    }
                    else if (fieldType[attr] === "color") {
                        rgbChannels = rgbRegex.exec(object[attr]);
                        object[attr] = {
                            r: parseFloat(rgbChannels[1]),
                            g: parseFloat(rgbChannels[2]),
                            b: parseFloat(rgbChannels[3])
                        }
                    }
                }
            }
        }


        return objArray;
    }

    function extractStyle (domNode) {
        var style = window.getComputedStyle(domNode, null);
        var styleObject = {};

        var camelize = function(a,b){
            return b.toUpperCase();
        };

        for (var i = 0; i < style.length; ++i) {
            var prop = style[i];
            var camelCaseProp = prop.replace(/\-([a-z])/g, camelize);
            styleObject[camelCaseProp] = style.getPropertyValue(prop);
        }

        return styleObject;
    }

    var transformedBoundingBox = function (el, to) {
        var bb = el.getBBox();
        var svg = el.ownerSVGElement;
        if (!to) {
            to = svg;
        }
        var m = el.getTransformToElement(to);
        var pts = [svg.createSVGPoint(), svg.createSVGPoint(), svg.createSVGPoint(), svg.createSVGPoint()];
        pts[0].x = bb.x;
        pts[0].y = bb.y;
        pts[1].x = bb.x + bb.width;
        pts[1].y = bb.y;
        pts[2].x = bb.x + bb.width;
        pts[2].y = bb.y + bb.height;
        pts[3].x = bb.x;
        pts[3].y = bb.y + bb.height;

        var xMin = Infinity;
        var xMax = -Infinity;
        var yMin = Infinity;
        var yMax = -Infinity;

        for (var i = 0; i < pts.length; i++) {
            var pt = pts[i];
            pt = pt.matrixTransform(m);
            xMin = Math.min(xMin, pt.x);
            xMax = Math.max(xMax, pt.x);
            yMin = Math.min(yMin, pt.y);
            yMax = Math.max(yMax, pt.y);
        }
        bb.x = xMin;
        bb.width = xMax - xMin;
        bb.y = yMin;
        bb.height = yMax - yMin;
        return bb;
    };

})();