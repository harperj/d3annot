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

        _.each(schematizedData, function(schema, i) {
            schematizedData[i].mappings = extractMappings(schema);
        });

        //console.log(schematizedData);

        // Now send a custom event with dataNodes to the content script
        var evt = document.createEvent("CustomEvent");
        evt.initCustomEvent("deconDataEvent", true, true, schematizedData);
        document.dispatchEvent(evt);
    }

    /**
     * Given a schema object, returns a list of mappings between data and attribute values in the schema.
     * @param schema
     * @returns {Array}
     */
    function extractMappings (schema) {
        var schemaMappings = [];

        _.each(schema.schema, function (schemaItem) {
            var dataArray = _.map(schema.nodes, function (node) {
                return node.data[schemaItem];
            });

            var attrNames = _.keys(schema.nodes[0].attrs);
            _.each(attrNames, function (attrName) {
                var attrArray = _.map(schema.nodes, function (node) {
                    return node.attrs[attrName];
                });
                var pairMapping = extractMapping(schemaItem, attrName, dataArray, attrArray);
                schemaMappings = schemaMappings.concat(pairMapping);

            });
        });

        return schemaMappings;
    }

    /**
     * Given a data field and attribute name and value array, returns an array of
     * mappings between the field and attribute.
     * @param dataName
     * @param attrName
     * @param dataArray
     * @param attrArray
     * @returns {Array}
     */
    function extractMapping (dataName, attrName, dataArray, attrArray) {
        var schemaMappings = [];

        if (typeof dataArray[0] === "number" && typeof attrArray[0] === "number") {
            var linearMapping = extractLinearMapping(dataArray, attrArray);
            if (linearMapping) {
                linearMapping = {
                    type: "linear",
                    data: dataName,
                    attr: attrName
                };
                schemaMappings.push(linearMapping);
            }
        }

        if(typeof attrArray[0] === "object") {
            /** @TODO Handle linear mappings on colors correctly. */
            /** @TODO Detect colors rather than all objects. */
            var colorStringArray = _.map(attrArray, function(color) {return "rgb(" + color.r +
                "," + color.g + "," + color.b + ")"});
            var nominalMapping = extractNominalMapping(dataArray, colorStringArray);
            if (nominalMapping) {
                nominalMapping.data = dataName;
                nominalMapping.attr = attrName;
                schemaMappings.push(nominalMapping);
                //console.log(nominalMapping);
            }
        }
        else {
            var nominalMapping = extractNominalMapping(dataArray, attrArray);
            if (nominalMapping) {
                nominalMapping.data = dataName;
                nominalMapping.attr = attrName;
                schemaMappings.push(nominalMapping);
                //console.log(nominalMapping);
            }
        }

        return schemaMappings;
    }

    /**
     * Given a data array and attribute array, finds a nominal mapping between them if it exists.
     * @param dataArray
     * @param attrArray
     * @returns {*}
     */
    function extractNominalMapping(dataArray, attrArray) {

        var mapping = {};
        _.each(dataArray, function(dataVal, i) {
            if (mapping.hasOwnProperty(dataVal)) {
                mapping[dataVal].push(attrArray[i]);
            }
            else {
                mapping[dataVal] = [attrArray[i]];
            }
        });

        for (var dataVal in mapping) {
            mapping[dataVal] = _.uniq(mapping[dataVal]);
            if (mapping[dataVal].length > 1) {
                return false;
            }
        }

        var mappedVals = _.flatten(_.values(mapping));

        // If multiple attr values are in the range, no one-to-one
        if (_.uniq(mappedVals).length <  mappedVals.length) {
            return false;
        }

        // If it is a trivial mapping, don't save it
        if (_.keys(mapping).length === 1) {
            return false;
        }

        var mappingData = {
            type: "nominal",
            params: mapping
        }

        return mappingData;
    }

    /**
     * Given a data array and attribute array, finds a linear mapping between them if it exists.
     * @param dataArray
     * @param attrArray
     * @returns {boolean}
     */
    function extractLinearMapping(dataArray, attrArray) {
        var zippedData = _.zip(dataArray, attrArray);
        if (ss.standard_deviation(dataArray) === 0 || ss.standard_deviation(attrArray) === 0) {
            return false;
        }

        var linearRegression = ss.linear_regression().data(zippedData);
        var linearRegressionLine = linearRegression.line();
        var rSquared = ss.r_squared(zippedData, linearRegressionLine);
        if (rSquared > 0.98 && !isNaN(rSquared)) {
            return true;
        }
        return false;
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

            var currSchema = _.keys(data[i]);

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

    /**
     * Given a root SVG element, returns all of the mark generating SVG nodes bound to data,
     * the data they are bound to, and their order in the DOM traversal ('id').
     * @param svgNode
     * @returns {{data: Array, nodes: Array, ids: Array}}
     */
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

                if (typeof nodeData === "number") {
                    nodeData = {number: nodeData};
                }
                else if (typeof nodeData !== "object") {
                    nodeData = {string: nodeData};
                }
                nodeData.deconID = i;
                data.push(nodeData);
                nodes.push(node);
                ids.push(i);
            }
        }

        data = fixTypes(data);
        return {data: data, nodes: nodes, ids: ids};
    }

    /**
     * Extracts the style and positional properties for each of a list of nodes, placing each node's in
     * attributes in a Javascript object.
     * @param nodes
     * @returns {Array}
     */
    function extractVisAttrs (nodes) {
        var visAttrData = [];

        for (var i = 0; i < nodes.length; ++i) {
            var node = nodes[i];
            var style = extractStyle(node);
            style.shape = node.tagName;

            var boundingBox = transformedBoundingBox(node);
            style.xPosition = boundingBox.x + (boundingBox.width / 2);
            style.yPosition = boundingBox.y + (boundingBox.height / 2);
            style.area = boundingBox.width * boundingBox.height;
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

    /**
     * Finds the CSS style properties for a DOM node.
     * @param domNode
     * @returns {{}}
     */
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