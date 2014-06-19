"use strict";
(function () {
    var deconstructor;

    /** Binds right click to initiate deconstruction on the root SVG node. **/
    $(document).bind("contextmenu", function (event) {
        var ancestorSVG = $(event.target).closest("svg");
        if (ancestorSVG.length > 0) {
            event.preventDefault();
            return visDeconstruct(ancestorSVG);
        }
    });

    document.addEventListener("updateEvent", function(event) {
        var updateMessage = event.detail;
        deconstructor.updateNodes(updateMessage.ids, updateMessage.attr, updateMessage.val);
    });

    /**
     * Accepts a top level SVG node and deconstructs it by extracting data, marks, and the
     * mappings between them.
     * @param svgNode - Top level SVG node of a D3 visualization.
     */
    function visDeconstruct(svgNode) {
        var dataNodes = extractData(svgNode);
        var attrData = extractVisAttrs(dataNodes.nodes);
        var nodeAttrData = extractNodeAttrs(dataNodes.nodes);
        var schematizedData = schematize(dataNodes.data, dataNodes.ids, attrData, nodeAttrData);
        console.log(schematizedData);
        _.each(schematizedData, function(schema, i) {
            schematizedData[i].mappings = extractMappings(schema);
            extractMultiLinearMapping(schema);
        });

        deconstructor = new VisDeconstructor(svgNode, dataNodes.nodes, dataNodes.ids, schematizedData);

        console.log(schematizedData);



        // Now send a custom event with dataNodes to the content script
        var evt = document.createEvent("CustomEvent");
        evt.initCustomEvent("deconDataEvent", true, true, schematizedData);
        document.dispatchEvent(evt);
    }

    function extractNodeAttrs(nodes) {
        var nodeAttrs = [];
        _.each(nodes, function(node) {
            var attrData = {};
            for (var i = 0; i < node.attributes.length; ++i) {
                var attr = node.attributes[i];
                attrData[attr.name] = attr.value;
            }
            attrData.text = $(node).text();
            nodeAttrs.push(attrData);
        });
        return nodeAttrs;
    }

    /**
     * Given a schema object, returns a list of mappings between data and attribute values in the schema.
     * @param schema
     * @returns {Array}
     */
    function extractMappings (schema) {
        var schemaMappings = [];
        _.each(schema.schema, function (schemaItem) {
            var dataArray = schema.data[schemaItem];

            var attrNames = _.keys(schema.attrs);
            _.each(attrNames, function (attrName) {
                var attrArray = schema.attrs[attrName];
                var pairMapping = extractMapping(schemaItem, attrName, dataArray, attrArray);
                schemaMappings = schemaMappings.concat(pairMapping);

            });
        });

        var attrsWithLinearMapping = [];
        _.each(schemaMappings, function(schemaMapping) {
            if (schemaMapping.type === "linear") {
                attrsWithLinearMapping.push(schemaMapping.attr);
            }
        });
        var removed = 0;
        var numMappings = schemaMappings.length;
        for(var ind = 0; ind < numMappings; ++ind) {
            var schemaMapping = schemaMappings[ind-removed];
            var hasLinear = attrsWithLinearMapping.indexOf(schemaMapping.attr) !== -1;
            if(schemaMapping.type === 'nominal' && hasLinear) {
                schemaMappings.splice(ind-removed, 1);
                removed++;
            }
        }

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
                linearMapping.data = dataName;
                linearMapping.attr = attrName;
                schemaMappings.push(linearMapping);
            }
        }

        var nominalMapping;
        if(typeof attrArray[0] === "object") {
            /** @TODO Handle linear mappings on colors correctly. */
            /** @TODO Detect colors rather than all objects. */
            var colorStringArray = _.map(attrArray, function(color) {return "rgb(" + color.r +
                "," + color.g + "," + color.b + ")"});
            nominalMapping = extractNominalMapping(dataArray, colorStringArray);
            if (nominalMapping) {
                nominalMapping.type = 'nominal';
                nominalMapping.data = dataName;
                nominalMapping.attr = attrName;
                schemaMappings.push(nominalMapping);
                //console.log(nominalMapping);
            }
        }
        else {
            nominalMapping = extractNominalMapping(dataArray, attrArray);
            if (nominalMapping) {
                nominalMapping.type = 'nominal';
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

        _.each(_.keys(mapping), function(key) {
            mapping[key] = mapping[key][0];
        });

        return  {
            type: "nominal",
            params: mapping
        };
    }

    /**
     * Given a data array and attribute array, finds a linear mapping between them if it exists.
     * @param dataArray
     * @param attrArray
     * @returns {}
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
            var mapping = {
                type: 'linear'
            };
            var dataMin = _.min(dataArray);
            var dataMax = _.max(dataArray);
            mapping.params = {
                dataMin: dataMin,
                attrMin: linearRegressionLine(dataMin),
                dataMax: dataMax,
                attrMax: linearRegressionLine(dataMax)
            };
            return mapping;
        }
        return false;
    }

    function extractMultiLinearMapping(schema) {
        var numberFields = [];
        var numberAttrs = [];
        for (var field in schema.data) {
            if (typeof schema.data[field][0] === "number") {
                numberFields.push(field);
            }
        }
        for (var attr in schema.attrs) {
            if (typeof schema.attrs[attr][0] === "number") {
                numberAttrs.push(attr);
            }
        }

        _.each(numberAttrs, function(attr) {
            for (var i = 0; i < numberFields.length; ++i) {
                var combinations = k_combinations(numberFields, i);
                var mappings = [];
                _.each(combinations, function(fieldSet) {
                    var xMatData = [];
                    for(var i = 0; i < schema.data[numberFields[0]].length; ++i) {
                        var row = [1];
                        for(var j = 0; j < fieldSet.length; ++j) {
                            var fieldName = fieldSet[j];
                            row.push(schema.data[fieldName][i]);
                        }
                        xMatData.push(row);
                    }
                    //console.log(xMatData);
                    var xMatrix = $M(xMatData);
                    var yVector = $V(schema.attrs[attr]);
                    var coeffs = findCoefficients(xMatrix, yVector).elements;
                    var err = findRSquaredError(xMatrix, yVector, coeffs);
                    if (err > 0.98) {
                        var mapping;
                        if (i === 1) {
                            mapping = {
                                type: 'linear',
                                data: fieldSet[0],
                                attr: attr,
                                params: {
                                    dataMin: _.min(schema.data[fieldSet[0]]),
                                    dataMax: _.max(schema.data[fieldSet[0]]),
                                    attrMin: _.min(schema.attrs[attr]),
                                    attrMax: _.max(schema.attrs[attr])
                                }
                            };
                        }
                        else {
                            mapping = {
                                type: 'multilinear',
                                data: fieldSet,
                                attr: attr,
                                params: {

                                }
                            }
                        }
                        mappings.push(mapping);
                    }

                });
            }
        });
    }

    function findRSquaredError(xMatrix, yVector, coeffs) {
        var squaredError = 0;
        var sumSquares = 0;

        var sum = yVector.elements.reduce(function(a, b) { return a + b });
        var yAvg = sum / yVector.elements.length;

        for (var i = 1; i < yVector.elements.length+1; ++i) {
            var pred = 0;
            for (var j = 1; j < xMatrix.cols()+1; ++j) {
                pred += xMatrix.e(i, j) * coeffs[j-1];
            }
            squaredError += (yVector.e(i) - pred) * (yVector.e(i) - pred);
            sumSquares += (yVector.e(i) - yAvg) * (yVector.e(i) - yAvg);
        }

        return 1 - (squaredError / sumSquares);
    }

    /**
     * K-combinations
     *
     * Get k-sized combinations of elements in a set.
     *
     * Usage:
     *   k_combinations(set, k)
     *
     * Parameters:
     *   set: Array of objects of any type. They are treated as unique.
     *   k: size of combinations to search for.
     *
     * Return:
     *   Array of found combinations, size of a combination is k.
     *
     * Examples:
     *
     *   k_combinations([1, 2, 3], 1)
     *   -> [[1], [2], [3]]
     *
     *   k_combinations([1, 2, 3], 2)
     *   -> [[1,2], [1,3], [2, 3]
     *
     *   k_combinations([1, 2, 3], 3)
     *   -> [[1, 2, 3]]
     *
     *   k_combinations([1, 2, 3], 4)
     *   -> []
     *
     *   k_combinations([1, 2, 3], 0)
     *   -> []
     *
     *   k_combinations([1, 2, 3], -1)
     *   -> []
     *
     *   k_combinations([], 0)
     *   -> []
     */
    function k_combinations(set, k) {
        var i, j, combs, head, tailcombs;

        if (k > set.length || k <= 0) {
            return [];
        }

        if (k == set.length) {
            return [set];
        }

        if (k == 1) {
            combs = [];
            for (i = 0; i < set.length; i++) {
                combs.push([set[i]]);
            }
            return combs;
        }

        // Assert {1 < k < set.length}

        combs = [];
        for (i = 0; i < set.length - k + 1; i++) {
            head = set.slice(i, i+1);
            tailcombs = k_combinations(set.slice(i + 1), k - 1);
            for (j = 0; j < tailcombs.length; j++) {
                combs.push(head.concat(tailcombs[j]));
            }
        }
        return combs;
    }

    /**
     * Combinations
     *
     * Get all possible combinations of elements in a set.
     *
     * Usage:
     *   combinations(set)
     *
     * Examples:
     *
     *   combinations([1, 2, 3])
     *   -> [[1],[2],[3],[1,2],[1,3],[2,3],[1,2,3]]
     *
     *   combinations([1])
     *   -> [[1]]
     */
    function combinations(set) {
        var k, i, combs, k_combs;
        combs = [];

        // Calculate all non-empty k-combinations
        for (k = 1; k <= set.length; k++) {
            k_combs = k_combinations(set, k);
            for (i = 0; i < k_combs.length; i++) {
                combs.push(k_combs[i]);
            }
        }
        return combs;
    }

    function findCoefficients(xMatrix, yVector) {
        var xTrans = xMatrix.transpose();
        return xTrans.multiply(xMatrix).inverse().multiply(xTrans).multiply(yVector);
    }

    /**
     * Groups nodes by 'schema', the data type or set of data types contained in their D3-bound data.
     * @returns {Array} - Array of schemas, each containing a list of information about mark-generating SVG nodes
     * @param data
     * @param ids
     * @param attrs
     */
    function schematize (data, ids, attrs, nodeAttrs) {
        var dataSchemas = [];
        for (var i = 0; i < data.length; ++i) {
            var currSchema = _.keys(data[i]);

            var foundSchema = false;
            for (var j = 0; j < dataSchemas.length; ++j) {
                if (_.intersection(currSchema, dataSchemas[j].schema).length == currSchema.length) {
                    foundSchema = true;
                    dataSchemas[j].ids.push(ids[i]);
                    dataSchemas[j].nodeAttrs.push(nodeAttrs[i]);

                    _.each(data[i], function(val, attr) {
                        dataSchemas[j].data[attr].push(val);
                    });
                    _.each(attrs[i], function(val, attr) {
                        dataSchemas[j].attrs[attr].push(val);
                    });
                    break;
                }
            }

            if (!foundSchema) {
                var newSchema = {
                    schema: currSchema,
                    ids: [ids[i]],
                    data: {},
                    attrs: {},
                    nodeAttrs: [nodeAttrs[i]]
                };
                _.each(data[i], function(val, attr) {
                    newSchema.data[attr] = [val];
                });
                _.each(attrs[i], function(val, attr) {
                    newSchema.attrs[attr] = [val];
                });

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
        var markGeneratingTags = ["circle", "ellipse", "rect", "path", "polygon", "text", "line"];

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

        for (var i = 0; i < style.length; ++i) {
            var prop = style[i];
            styleObject[prop] = style.getPropertyValue(prop);
        }

        styleObject["vector-effect"] = "non-scaling-stroke";
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