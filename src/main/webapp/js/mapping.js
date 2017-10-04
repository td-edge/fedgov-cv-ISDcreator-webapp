/**
 * Created by lewisstet on 2/25/2015.
 * Updated 3/2017 by martzth
 */

/**
 * DEFINE GLOBAL VARIABLES
 */
    var map;
    var vectors, lanes, laneMarkers, box, laneConnections, errors;
    var fromProjection, toProjection;
    var temp_lat, temp_lon, selected_marker, selected_layer;
    var intersection_url = '//api.geonames.org/findNearestIntersectionJSON';
    var elevation_url = 'https://dev.virtualearth.net/REST/v1/Elevation/List?points=';
    var sharedWith_object = '';
    var typeAttribute_object = '';
    var typeAttributeName = '';
    var typeAttributeNameSaved = '';
    var sharedWith = [];
    var typeAttribute = [];
    var laneTypeOptions = [];
    var nodeLaneWidth = [];
    var signalPhase, stateConfidence, laneNum, laneType, approachType, intersectionID, approachID, intersectionType;
    var nodeObject = [];
    var revisionNum = 0;

    var bingResolutions = [156543.03390625, 78271.516953125, 39135.7584765625,
        19567.87923828125, 9783.939619140625, 4891.9698095703125,
        2445.9849047851562, 1222.9924523925781, 611.4962261962891,
        305.74811309814453, 152.87405654907226, 76.43702827453613,
        38.218514137268066, 19.109257068634033, 9.554628534317017,
        4.777314267158508, 2.388657133579254, 1.194328566789627,
        0.5971642833948135, 0.29858214169740677, 0.14929107084870338,
        0.07464553542435169];
    var bingServerResolutions = [156543.03390625, 78271.516953125, 39135.7584765625,
        19567.87923828125, 9783.939619140625, 4891.9698095703125,
        2445.9849047851562, 1222.9924523925781, 611.4962261962891,
        305.74811309814453, 152.87405654907226, 76.43702827453613,
        38.218514137268066, 19.109257068634033, 9.554628534317017,
        4.777314267158508, 2.388657133579254, 1.194328566789627,
        0.5971642833948135, 0.29858214169740677];


/**
 * Define functions that must bind on load
 */

function init() {
	// cannot call http service from our https deployed application:
	// making call to backend to do GET for us if not deployed on localhost
	if( host.indexOf("localhost") == -1 ) {
		intersection_url = '/' + proj_name + '/builder/geonames/findNearestIntersectionJSON'
	}

    //Set initial status of various form elements
    $('.phases').hide();
    $('.lane_type_attributes select').hide();
	$("#lane_num_check").hide();
	$("#lane_type_check").hide();
    
    $('[data-toggle="tooltip"]').tooltip();


    /*********************************************************************************************************************/
    /**
     * Purpose: create map object which will house bing map tiles
     * @params  openlayers2
     * @event setting all the parameters -> will note certain areas
     *
     * Note: each layer is defined in this section, and layers interact with the sidebar
     * by showing/hiding DOM elements. Also, all data is loaded into the forms via these feature objects
     */

	map = new OpenLayers.Map('map', {
        allOverlays: false,
        fractionalZoom: true,
        controls: [
            new OpenLayers.Control.Navigation({
                dragPanOptions: {
                    enableKinetic: true
                }
            }),
            new OpenLayers.Control.LayerSwitcher(),
            new OpenLayers.Control.Zoom({
                zoomInId: "customZoomIn",
                zoomOutId: "customZoomOut"
            })
        ]});
    fromProjection = new OpenLayers.Projection("EPSG:4326");   // Transform from WGS 1984
    toProjection   = new OpenLayers.Projection("EPSG:3857"); // to Spherical Mercator Projection

    //Sets the standard viewport to Detroit unless overwritten by cookie
    var view_lat = 42.3373873;
    var view_lon = -83.051308;
    var view_zoom = 19;
    if (getCookie("isd_latitude") !== ""){
        view_lat = getCookie("isd_latitude")
    }
    if (getCookie("isd_longitude") !== ""){
        view_lon = getCookie("isd_longitude")
    }
    if (getCookie("isd_zoom") !== ""){
        view_zoom = getCookie("isd_zoom")
    }
    if (getCookie("isd_node_offsets") !== ""){
        $('#node_offsets').val(getCookie("isd_node_offsets"));
    }

    //Set cookie anytime map is moved
    map.events.register("moveend", map, function() {
        var center_point = map.getCenter();
        var center_lonlat = new OpenLayers.LonLat(center_point.lon,center_point.lat).transform(toProjection, fromProjection)
        setCookie("isd_latitude", center_lonlat.lat, 365);
        setCookie("isd_longitude", center_lonlat.lon, 365);
        setCookie("isd_zoom", map.getZoom(), 365);
        $('#zoomLevel .zoom').text(map.getZoom());
    });

    /* Establish bing layer types - zoom is defined using the zoom level and resolutions. sever resolutions is
     a smaller array because bing only has so many tile sets. once we pass those, we use the resolutions array for fractional zoom.
     http://stackoverflow.com/questions/42396112/magnifying-tiles-in-openlayers-2-or-increasing-maxzoom-without-distorting-projec*/

    var road = new OpenLayers.Layer.Bing({
        name: "Road",
        key: apiKey,
        type: "Road",
        numZoomLevels: 22,
        resolutions: bingResolutions,
        serverResolutions: bingServerResolutions,
        transitionEffect: 'resize'
    });
    var hybrid = new OpenLayers.Layer.Bing({
        name: "Hybrid",
        key: apiKey,
        type: "AerialWithLabels",
        numZoomLevels: 22,
        resolutions: bingResolutions,
        serverResolutions: bingServerResolutions,
        transitionEffect: 'resize'
    });
    var aerial = new OpenLayers.Layer.Bing({
        name: "Aerial",
        key: apiKey,
        type: "Aerial",
        numZoomLevels: 22,
        resolutions: bingResolutions,
        serverResolutions: bingServerResolutions,
        transitionEffect: 'resize'
    });


    //Create style maps for the lanes
    var laneDefault = {
    		strokeColor: "#FF9900",
    		fillColor: "#FF9900",
            strokeOpacity: 1,
            strokeWidth: 4,
            fillOpacity: .9,
            pointRadius: 6,
            label: "${getLabel}",
            fontFamily: "Arial",
            fontSize: "8px",
            cursor: "pointer"
        };
    
    var barDefault = {
    		strokeColor: "#FF0000",
    		fillColor: "#FF0000",
            strokeOpacity: 1,
            strokeWidth: 3,
            fillOpacity: 0,
            pointRadius: 2
        };
    
    var vectorDefault = {
    		strokeColor: "#FF9900",
    		fillColor: "#FF9900",
            strokeOpacity: 1,
            strokeWidth: 1,
            fillOpacity: 0,
            pointRadius: 1
        };

    var connectionsDefault = {
        strokeColor: "#0000FF",
        fillColor: "#0000FF",
        strokeOpacity: 1,
        strokeWidth: 1,
        fillOpacity:.5,
        pointRadius: 6,
        graphicName: "triangle",
        rotation: "${angle}"
    };
    
    var context = null;
    
    var laneStyleMap = new OpenLayers.StyleMap({
        "default": new OpenLayers.Style(laneDefault, {context: {
            getLabel: function(feature) {
                if (feature.attributes.laneNumber) {
                    return feature.attributes.laneNumber;
                } else {
                    return '';
                }
            }
        }})
    });
    
    var barStyleMap = new OpenLayers.StyleMap({
        "default": new OpenLayers.Style(barDefault, {context:context})
    });

    var vectorStyleMap = new OpenLayers.StyleMap({
        "default": new OpenLayers.Style(vectorDefault, {context: context})
    });

    var connectionsStyleMap = new OpenLayers.StyleMap({
        "default": new OpenLayers.Style(connectionsDefault, {context: context})
    });

    
    //Create new layers for images
    lanes = new OpenLayers.Layer.Vector("Lane Layer", {
		eventListeners:{
	        'featureselected':function(evt){
	        	if (deleteMode){
	        		deleteMarker(this, evt.feature);
	        	}
	        }
		}, styleMap: laneStyleMap
    });
    
    $('#shared_with').multiselect({
        onChange: function(option, checked){
            updateSharedWith()
        },
        maxHeight: 200,
        buttonText: function(options, select) {
            if (options.length === 0) {
                return 'Select Shared With Type'
            } else if (options.length > 1) {
                return options.length + ' selected';
            } else {
                var labels = [];
                options.each(function() {
                    if ($(this).attr('label') !== undefined) {
                        labels.push($(this).attr('label'));
                    }
                    else {
                        labels.push($(this).html());
                    }
                });
                return labels.join(', ') + '';
            }
        }
    });
    
    
    $(".lane_type ul li").each(function() { laneTypeOptions.push($(this).text()) });
    
    box = new OpenLayers.Layer.Vector("Stop Bar Layer", {
		eventListeners:{
	        'featureselected':function(evt){
	        	selected_marker = evt.feature;
	        	if (deleteMode){
	        		deleteMarker(this, selected_marker);
	        	} else {
                    $(".lane-info-tab").find('a:contains("Lane Info")').text('Approach Info');
                    $(".lane-info-tab").find('a:contains("Marker Info")').text('Approach Info');
                    $('#lane-info-tab').addClass('active');
                    $('#spat-info-tab').removeClass('active');
                    $('.spat-info-tab').removeClass('active');
                    $('.spat-info-tab').hide();
                    $('#intersection-info-tab').removeClass('active');
                    $('.intersection-info-tab').removeClass('active');
                    $('.intersection-info-tab').hide();
                    $('#connection-tab').removeClass('active');
                    $('.connection-tab').removeClass('active');
                    $('.connection-tab').hide();
	        		$("#lat").prop('readonly', false);
	        		$("#long").prop('readonly', false);
	        		$("#elev").prop('readonly', false);
                    $('.btnDone').prop('disabled', false);
	        		//---------------------------------------
		        	$(".selection-panel").text('Approach Configuration');
		        	$("#lane_attributes").hide();
		        	$(".lane_type_attributes").hide();
		        	$(".lane_number").hide();
		        	$(".lat").hide();
		        	$(".long").hide();
		        	$(".verified_lat").hide();
		        	$(".verified_long").hide();
		        	$(".intersection").hide();
		        	$(".elev").hide();
		        	$(".verified_elev").hide();
		        	$(".lane_width").hide();
		        	$(".lane_type").hide();
                    $(".intersection_type").hide();
                    $(".revision").hide();
                    $(".master_lane_width").hide();
                    $(".intersection_name").hide();
                    $(".shared_with").hide();
		        	//----------------------------------------
		        	$(".approach_type").show();
                    $(".approach_name").show();
                    $('#approach_name li').show();
                    for (i=0; i < box.features.length; i++){
                        var usedNum = box.features[i].attributes.approachID;
                        $('.approach_name li:contains(' + usedNum + ')').hide();
                    }
		        	//----------------------------------------
		        	$("#approach_title").val(selected_marker.attributes.approach);
		        	$("#attributes").show();	        	
		        	selected_layer = this;
	        	}
	        	
                if (! selected_marker.attributes.approachType) {
                    approachType = null;
                    $('#approach_type .dropdown-toggle').html("Select an Approach Type <span class='caret'></span>");
                } else {
                    approachType = selected_marker.attributes.approachType;
                    $('#approach_type .dropdown-toggle').html(selected_marker.attributes.approachType + " <span class='caret'></span>");
                }
                
                if (! selected_marker.attributes.approachID) {
                    approachID = null;
                    $('#approach_name .dropdown-toggle').html("Select an Approach ID <span class='caret'></span>");
                } else {
                    approachID = selected_marker.attributes.approachID;
                    $('#approach_name .dropdown-toggle').html(selected_marker.attributes.approachID + " <span class='caret'></span>");
                }
                
	        },
        	'featureunselected':function(evt){
        		$("#attributes").hide();
        		selected_marker = null;
	        }
		},
    	styleMap: barStyleMap
    });

    laneMarkers = new OpenLayers.Layer.Vector("Lane Marker Layer", {
		eventListeners:{
	        'featureselected':function(evt){
	        	selected_marker = evt.feature;
	        	$(".selection-panel").text('Lane Configuration');
				console.log("selected: ", selected_marker)

                // delete marker and return
	        	if (deleteMode){
	        		deleteMarker(this, selected_marker);
	        		 return false;
	        	} else {
	        		updateLaneFeatureLocation( selected_marker );
	        	}

                $('#lane_number li').show();
                for (i=0; i < lanes.features.length; i++){
                    var usedNum = lanes.features[i].attributes.laneNumber;
                    $('.lane_number li:contains(' + usedNum + ')').hide();
                }
                $(".lane-info-tab").find('a:contains("Marker Info")').text('Lane Info');
                $(".lane-info-tab").find('a:contains("Approach Info")').text('Lane Info');
                $('#lane-info-tab').addClass('active');
                $('#spat-info-tab').removeClass('active');
                $('.spat-info-tab').removeClass('active');
                $('.spat-info-tab').hide();
                $('#intersection-info-tab').removeClass('active');
                $('.intersection-info-tab').removeClass('active');
                $('.intersection-info-tab').hide();
                $('#connection-tab').removeClass('active');
                $('.connection-tab').removeClass('active');
                $('.connection-tab').hide();
				$("#lat").prop('readonly', false);
        		$("#long").prop('readonly', false);
        		$("#elev").prop('readonly', false);
                $('.btnDone').prop('disabled', false);
                $(".lane_type_attributes").hide();
                $(".lane_type_attributes btn-group").hide();
                $("label[for='lane_type_attributes']").hide();
	        	$(".verified_lat").hide();
	        	$(".verified_long").hide();
	        	$(".verified_elev").hide();
	        	$(".approach_type").hide();
	        	$(".intersection").hide();
                $(".intersection_type").hide();
                $(".revision").hide();
                $('.phases').hide();
                $(".master_lane_width").hide();
                $(".intersection_name").hide();
                $(".approach_name").hide();
                $(".shared_with").hide();
				//-------------------------------------
	        	$(".lat").show();
	        	$(".long").show();
	        	$(".elev").show();
	        	$(".spat_label").show();
	        	$(".lane_width").show();
		
        		if ( selected_marker.attributes.number == 0 ) {
        			updateDisplayedLaneAttributes( selected_marker );
                    rebuildConnections(selected_marker.attributes.connections);
		        	$("#lane_attributes").show();
		        	$(".lane_type").show();
		        	$(".lane_number").show();
                    $('.spat-info-tab').show();
                    $('.connection-tab').show();
                    $(".shared_with").show();
        		} else {
		        	$("#lane_attributes").hide();
		        	$(".lane_type").hide();
		        	$(".lane_number").hide();
        		}
        		
        		selected_layer = this;

                if(lanes.features[selected_marker.attributes.lane].attributes.laneWidth){
                    nodeLaneWidth = lanes.features[selected_marker.attributes.lane].attributes.laneWidth;
                }

        		if (! nodeLaneWidth[selected_marker.attributes.number]){
        			$("#lane_width").val("0");
        		} else {
        			$("#lane_width").val(nodeLaneWidth[selected_marker.attributes.number]);
        		}
        		
        		if (! selected_marker.attributes.elevation.value){
        			$("#elev").val("");
        		} else {
        			$("#elev").val(selected_marker.attributes.elevation.value);
        		}
        		     		
                if (! selected_marker.attributes.signalPhase) {
                    signalPhase = null;
                    $('#phase .dropdown-toggle').html("Select a Signal Phase <span class='caret'></span>");
                } else {
                    signalPhase = selected_marker.attributes.signalPhase;
                    $('#phase .dropdown-toggle').html(selected_marker.attributes.signalPhase + " <span class='caret'></span>");
                    $('#phase' + selected_marker.attributes.signalPhase.substring(1, 2)).show();
                }
        		
        		if (! selected_marker.attributes.stateConfidence) {
                    stateConfidence = null;
                    $('#confidence .dropdown-toggle').html("Select a Confidence <span class='caret'></span>");
                } else {
                    stateConfidence = selected_marker.attributes.stateConfidence;
                    $('#confidence .dropdown-toggle').html(selected_marker.attributes.stateConfidence + " <span class='caret'></span>");
                }

                if (! selected_marker.attributes.laneNumber) {
                    laneNum = null;
                    $('#lane_number .dropdown-toggle').html("Select a Lane Number <span class='caret'></span>");
                } else {
                    laneNum = selected_marker.attributes.laneNumber;
                    $('#lane_number .dropdown-toggle').html(selected_marker.attributes.laneNumber + " <span class='caret'></span>");
                }
                
                if (! selected_marker.attributes.laneType) {
                    laneType = null;
                    $('#lane_type .dropdown-toggle').html("Select a Lane Type <span class='caret'></span>");
                } else if ( selected_marker.attributes.number == 0 ) {
                    laneType = selected_marker.attributes.laneType;
                    $('#lane_type .dropdown-toggle').html(selected_marker.attributes.laneType + " <span class='caret'></span>");
                    toggleLaneTypeAttributes(selected_marker.attributes.laneType);
                }

                
            	$('#shared_with').multiselect('deselectAll', false);
            	$("#shared_with").multiselect("refresh");
                               
                if (selected_marker.attributes.sharedWith) {
                	$('#shared_with').multiselect('select', selected_marker.attributes.sharedWith);
                	$("#shared_with").multiselect("refresh");
                }
                
                if (selected_marker.attributes.typeAttribute && selected_marker.attributes.laneType) {
                	$('#' + selected_marker.attributes.laneType + '_type_attributes').multiselect('select', selected_marker.attributes.typeAttribute);
                	$('#' + selected_marker.attributes.laneType + '_type_attributes').multiselect("refresh");
                } 

                if (! selected_marker.attributes.spatRevision){
                	$('#spat_revision').val(1);
                } else {
                	$('#spat_revision').val(selected_marker.attributes.spatRevision);
                }
                
                $('#signal_group_id').val(selected_marker.attributes.signalGroupID);
                $('#start_time').val(selected_marker.attributes.startTime);
                $('#min_end_time').val(selected_marker.attributes.minEndTime);
                $('#max_end_time').val(selected_marker.attributes.maxEndTime);
                $('#likely_time').val(selected_marker.attributes.likelyTime);
                $('#next_time').val(selected_marker.attributes.nextTime);              
                
	            temp_lat = selected_marker.attributes.LonLat.lat;
	            temp_lon = selected_marker.attributes.LonLat.lon;
	            populateAttributeWindow(temp_lat, temp_lon);
	            $("#attributes").show();

                for(var attrConnection in selected_marker.attributes.connections) {
                    if (selected_marker.attributes.connections.hasOwnProperty(attrConnection) && selected_marker.attributes.number == 0){
                        var connection = selected_marker.attributes.connections[attrConnection];
                        var start_point;
                        var end_point;

                        for (var i = 0; i < lanes.features.length; i++) {
                            var lanefeature = lanes.features[i];

                            if (lanefeature.attributes.laneNumber && lanefeature.attributes.laneNumber !== undefined) {
                                if (parseInt(lanefeature.attributes.laneNumber) === parseInt(connection.fromLane)) {
                                    start_point = new OpenLayers.Geometry.Point(lanefeature.geometry.components[0].x, lanefeature.geometry.components[0].y);
                                } else if (parseInt(lanefeature.attributes.laneNumber) === parseInt(connection.toLane)) {
                                    end_point = new OpenLayers.Geometry.Point(lanefeature.geometry.components[0].x, lanefeature.geometry.components[0].y);
                                }
                            }
                        }
                        var angleDeg = 0;
                        if(typeof start_point !== 'undefined') {
                            //Q III
                            if (start_point.x > end_point.x && start_point.y > end_point.y) {
                                angleDeg = 270 - (Math.atan2(start_point.y - end_point.y, start_point.x - end_point.x) * 180 / Math.PI);
                            }
                            //Q IV
                            if (start_point.x > end_point.x && start_point.y < end_point.y) {
                                angleDeg = 270 - (Math.atan2(start_point.y - end_point.y, start_point.x - end_point.x) * 180 / Math.PI);
                            }
                            //Q II
                            if (start_point.x < end_point.x && start_point.y > end_point.y) {
                                angleDeg = 90 - (Math.atan2(end_point.y - start_point.y, end_point.x - start_point.x) * 180 / Math.PI);
                            }
                            //Q I
                            if (start_point.x < end_point.x && start_point.y < end_point.y) {
                                angleDeg = 90 - (Math.atan2(end_point.y - start_point.y, end_point.x - start_point.x) * 180 / Math.PI);
                            }

                            var xlen = end_point.x - start_point.x;
                            var ylen = end_point.y - start_point.y;
                            var hlen = Math.sqrt(Math.pow(xlen, 2) + Math.pow(ylen, 2));
                            var smallerLen = hlen - 1;
                            var ratio = smallerLen / hlen;
                            var smallerXLen = xlen * ratio;
                            var smallerYLen = ylen * ratio;
                            var smallerX = start_point.x + smallerXLen;
                            var smallerY = start_point.y + smallerYLen;

                            laneConnections.addFeatures([new OpenLayers.Feature.Vector(new OpenLayers.Geometry.LineString([start_point, end_point]))]);
                            laneConnections.addFeatures([new OpenLayers.Feature.Vector(new OpenLayers.Geometry.Point(smallerX, smallerY), {angle: angleDeg})]);
                        }
                    }
                }
	        },
	        'featureunselected':function(evt){
	        	$("#attributes").hide();
				resetLaneAttributes();
	            selected_marker = null;
                laneConnections.removeAllFeatures();
	        }
		},
		styleMap: laneStyleMap
    });

    laneConnections = new OpenLayers.Layer.Vector("Connection Layer", {
        eventListeners:{
            'featureadded':function(evt){
            }
        }, styleMap: connectionsStyleMap
    });
    
    vectors = new OpenLayers.Layer.Vector("Vector Layer",{
		eventListeners:{
			'featureadded' : function (evt) {
				selected_marker = evt.feature;
				updateFeatureLocation(evt.feature);
			},
	        'featureselected':function(evt){
	        	selected_marker = evt.feature;
	        	if (deleteMode){
	        		deleteMarker(this, selected_marker);
	        	} else {
	        		updateFeatureLocation( selected_marker );
	        	}
	        },
	        'featureunselected':function(evt){
	        	$("#attributes").hide();
	        	selected_marker = null;
	        }
		}, styleMap: vectorStyleMap
    });

    errors = new OpenLayers.Layer.Markers("Error Layer");


    var updateDisplay = function( event ) { // 5
        $('.measurement').text( (event.measure).toFixed(3) + ' ' + event.units );
        copyTextToClipboard((event.measure).toFixed(3));
    };


    //Controls for the lane layer to draw and modify
    controls = {
            line: new OpenLayers.Control.DrawFeature(lanes,
                        OpenLayers.Handler.Path, {featureAdded: onFeatureAdded}),
            modify: new OpenLayers.Control.ModifyFeature(lanes),
            drag: dragHandler(),
            bar: new OpenLayers.Control.DrawFeature(box,
                    OpenLayers.Handler.RegularPolygon, {
                        handlerOptions: {
                            sides: 4,
                            irregular: true
                        }
                    }),
            edit: new OpenLayers.Control.ModifyFeature(box),
            del: new OpenLayers.Control.SelectFeature([lanes, vectors, box], {toggle: false, autoActivate:true}),
            none: new OpenLayers.Control.SelectFeature([laneMarkers, box, vectors], {toggle:true, autoActivate:true}),
            measure: new OpenLayers.Control.Measure(
                    OpenLayers.Handler.Path, {
                        persist: true,
                        immediate: true,
                        geodesic: true,
                        displaySystem: 'metric',
                        eventListeners: {
                            'measurepartial': updateDisplay
                        }
                    })
        };
    
	controls.edit.mode = OpenLayers.Control.ModifyFeature.DRAG | OpenLayers.Control.ModifyFeature.RESIZE | OpenLayers.Control.ModifyFeature.ROTATE;

	for(var key in controls) {
		map.addControl(controls[key]);
	}

    map.events.register("moveend", map, tileAge);
    
    map.addLayers([aerial, road, hybrid, laneConnections, box, laneMarkers, lanes, vectors, errors]);
    try {
        var location = new OpenLayers.LonLat(view_lon, view_lat);
        location.transform(new OpenLayers.Projection("EPSG:4326"), map.getProjectionObject());
        map.setCenter(location, view_zoom);
    }
    catch (err) {
        console.log("No vectors to reset view");
    }

    $('#OpenLayers_Control_MinimizeDiv_innerImage').attr('src', "img/layer-switcher-minimize.png");
    $('#OpenLayers_Control_MaximizeDiv_innerImage').attr('src', "img/layer-switcher-maximize.png");

    //Init toggle switches for the layers

}


/*********************************************************************************************************************/
/**
 * Purpose: copies measurement to clipboard
 * @params  measurement value
 * @event copy
 */

function copyTextToClipboard(text) {
    var textArea = document.createElement("textarea");

    //
    // *** This styling is an extra step which is likely not required. ***
    //
    // Why is it here? To ensure:
    // 1. the element is able to have focus and selection.
    // 2. if element was to flash render it has minimal visual impact.
    // 3. less flakyness with selection and copying which **might** occur if
    //    the textarea element is not visible.
    //
    // The likelihood is the element won't even render, not even a flash,
    // so some of these are just precautions. However in IE the element
    // is visible whilst the popup box asking the user for permission for
    // the web page to copy to the clipboard.
    //

    // Place in top-left corner of screen regardless of scroll position.
    textArea.style.position = 'fixed';
    textArea.style.top = 0;
    textArea.style.left = 0;

    // Ensure it has a small width and height. Setting to 1px / 1em
    // doesn't work as this gives a negative w/h on some browsers.
    textArea.style.width = '2em';
    textArea.style.height = '2em';

    // We don't need padding, reducing the size if it does flash render.
    textArea.style.padding = 0;

    // Clean up any borders.
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';

    // Avoid flash of white box if rendered for any reason.
    textArea.style.background = 'transparent';


    textArea.value = text;

    document.body.appendChild(textArea);

    textArea.select();

    try {
        var successful = document.execCommand('copy');
        var msg = successful ? 'successful' : 'unsuccessful';
        console.log('Copying text command was ' + msg);
    } catch (err) {
        console.log('Oops, unable to copy');
    }

    document.body.removeChild(textArea);
}

/**
 * Purpose: removes features from the map
 * @params  map layers and features
 * @event remove features and all of it's metadata
 */

function Clear(){
	var r = confirm("Clear and reset all of the map features?");
	if (r == true) {
		lanes.destroyFeatures();
		laneMarkers.destroyFeatures();
		vectors.destroyFeatures();
		box.destroyFeatures();
		errors.destroyFeatures();
	}

    $('#open').show();
    $("#map-type").text("");
    $("#builder, #drawLanes, #editLanes, #measureLanes, #drawStopBar, #editStopBar, #deleteMarker, #approachControlLabel, #laneControlLabel, #measureControlLabel, #dragSigns").hide();
}

function deleteMarker(layer, feature) {
    try {
        if (selected == "child" && (feature.attributes.marker.name == "Verified Point Marker" || feature.attributes.marker.name == "Reference Point Marker")) {
            alert("Cannot delete a reference point in a child map.")
        } else {
            $("#attributes").hide();
            layer.removeFeatures(feature);
        }
    } catch (err){
        $("#attributes").hide();
        layer.removeFeatures(feature);
    }
}


/*********************************************************************************************************************/
/**
 * Purpose: toggle control of all the layers and modal windows
 * @params  click events and the corresponding feature type
 * @event loads help or the drawing control with a specific element in mind
 */

function toggleControlsOn(state) {
	if( state == 'help'){
		$("#instructions_modal").modal('show');
	} else {
	$("#instructions_modal").modal('hide');
	toggleControl(state);
        if( state == 'modify' || state == 'del') {
            laneMarkers.destroyFeatures();
            controls.del.unselectAll();
        } else {
            onFeatureAdded();
        }
    }
}

function toggleControl(element) {
    for(key in controls) {
        var control = controls[key];
        if(element == key) {
            control.activate();
        } else {
            control.deactivate();
            $('.measurement').text('');
        }
    }
}

function unselectFeature( feature ) {

	resetLaneAttributes()

	if( feature.layer != null ) {
		console.log("unselecting ", feature)
		controls.none.unselect( feature );
	}
}

//this is just chillin' not sure what it's for :-/
var tmp = 0;

/*********************************************************************************************************************/
/**
 * Purpose: dot functions that bind the metadata to the feature object
 * @params  the feature and it's metadata
 * @event creates variables attached to the feature object and store the values
 */

function onFeatureAdded(){

	laneMarkers.destroyFeatures();
	var ft = lanes.features;
	for(var i=0; i< ft.length; i++){
        if (typeof lanes.features[i].attributes.elevation == 'undefined'){
            lanes.features[i].attributes.elevation = [];
        }
        if (typeof lanes.features[i].attributes.laneWidth == 'undefined'){
            lanes.features[i].attributes.laneWidth = [];
        }
        var max = lanes.features[i].geometry.getVertices().length;
        var nodeElevations = (lanes.features[i].attributes.elevation).slice(0);
        var nodeLaneWidths = (lanes.features[i].attributes.laneWidth).slice(0);
		for(j=0; j< max; j++){
			var dot = new OpenLayers.Feature.Vector(new OpenLayers.Geometry.Point(lanes.features[i].geometry.getVertices()[j].x, lanes.features[i].geometry.getVertices()[j].y));
            var latlon = new OpenLayers.LonLat(dot.geometry.x, dot.geometry.y).transform(toProjection, fromProjection);


            if (typeof lanes.features[i].attributes.laneWidth[j] == 'undefined'){
                lanes.features[i].attributes.laneWidth[j] = 0;
            }

            if (typeof lanes.features[i].attributes.elevation[j] == 'undefined'){
                lanes.features[i].attributes.elevation[j] = {'value': -9999, 'edited': false, 'latlon': latlon};
            }

            for (k = 0; k < nodeElevations.length; k++) {
                var latMatch = ((nodeElevations[k].latlon.lat).toString().match(/^-?\d+(?:\.\d{0,11})?/)[0] === (latlon.lat).toString().match(/^-?\d+(?:\.\d{0,11})?/)[0]);
                var lonMatch = ((nodeElevations[k].latlon.lon).toString().match(/^-?\d+(?:\.\d{0,11})?/)[0] === (latlon.lon).toString().match(/^-?\d+(?:\.\d{0,11})?/)[0]);
                if(!latMatch && !lonMatch) {
                    lanes.features[i].attributes.laneWidth[j] = 0
                } else {
                    lanes.features[i].attributes.laneWidth[j] = nodeLaneWidths[k];
                    if(nodeElevations[k].edited) {
                        lanes.features[i].attributes.elevation[j] = nodeElevations[k];
                        buildDots(i, j, dot, latlon);
                        break;
                    }
                }
            }
            if (!lanes.features[i].attributes.elevation[j].edited || !latMatch || !lonMatch){
                getElevation(dot, latlon, i, j, function(elev, i, j, latlon, dot){
                    lanes.features[i].attributes.elevation[j] = {'value': elev, 'edited': true, 'latlon': latlon};
                    buildDots(i, j, dot, latlon);
                });
            }

		}
	}
}

function buildDots(i, j, dot, latlon){

    dot.attributes={"lane": i, "number": j, "LatLon": latlon,
        "laneNumber": lanes.features[i].attributes.laneNumber, "laneWidth": lanes.features[i].attributes.laneWidth, "laneType": lanes.features[i].attributes.laneType, "sharedWith": lanes.features[i].attributes.sharedWith,
        "stateConfidence": lanes.features[i].attributes.stateConfidence, "spatRevision": lanes.features[i].attributes.spatRevision, "signalGroupID": lanes.features[i].attributes.signalGroupID, "lane_attributes": lanes.features[i].attributes.lane_attributes,
        "startTime": lanes.features[i].attributes.startTime, "minEndTime": lanes.features[i].attributes.minEndTime, "maxEndTime": lanes.features[i].attributes.maxEndTime,
        "likelyTime": lanes.features[i].attributes.likelyTime, "nextTime": lanes.features[i].attributes.nextTime, "signalPhase": lanes.features[i].attributes.signalPhase, "typeAttribute": lanes.features[i].attributes.typeAttribute,
        "connections": lanes.features[i].attributes.connections, "elevation": lanes.features[i].attributes.elevation[j]
    };
    laneMarkers.addFeatures(dot);

}


/*********************************************************************************************************************/
/**
 * Purpose: drag handler for the vector layer
 * @params  the feature and it's metadata
 * @event creates variables attached to the feature object and store the values
 */

function dragHandler () {
	var selectFeature = new OpenLayers.Control.SelectFeature(vectors,{
		toggle:true
	});

    return new OpenLayers.Control.DragFeature(vectors, {
		autoActivate: true,
		clickFeature: function(feature) {
			selectFeature.clickFeature(feature);
		},
		clickoutFeature: function(feature) {
			selectFeature.clickoutFeature(feature);
		},
		onStart: function(feature){
			selected_marker = feature;
		},
        onComplete: function() {
            console.log("dragged: ", this.feature);
			updateFeatureLocation( this.feature )
        }
    });
}


/*********************************************************************************************************************/
/**
 * Purpose: creates sidebar element for the individual roadsigns
 * @params  the feature and it's metadata
 * @event loads the sidebar and all of the metadata into the forms
 */

function referencePointWindow(feature){
	$("#attributes").hide();
	//---------------------------------------
	$(".selection-panel").text('Reference Point Configuration');
    $(".lane-info-tab").find('a:contains("Lane Info")').text('Marker Info');
    $(".lane-info-tab").find('a:contains("Approach Info")').text('Marker Info');
    $('#lane-info-tab').addClass('active');
    $('#spat-info-tab').removeClass('active');
    $('.spat-info-tab').removeClass('active');
    $('.spat-info-tab').hide();
    $('#intersection-info-tab').removeClass('active');
    $('.intersection-info-tab').removeClass('active');
    $('.intersection-info-tab').hide();
    $('#connection-tab').removeClass('active');
    $('.connection-tab').removeClass('active');
    $('.connection-tab').hide();
	$("#lat").prop('readonly', false);
	$("#long").prop('readonly', false);
	$("#elev").prop('readonly', false);
	$("#lane_attributes").hide();
	$(".lane_type_attributes").hide();
	$(".lane_number").hide();
	$(".lane_width").hide();
	$(".lane_type").hide();
	$(".approach_type").hide();
	$(".verified_lat").hide();
	$(".verified_long").hide();
	$(".verified_elev").hide();
    $(".approach_name").hide();
    $(".shared_with").hide();
	//----------------------------------------
	$(".lat").show();
	$(".long").show();
	$(".intersection").show();
	$(".elev").show();
    $(".intersection_type").show();
    $(".revision").show();
    $(".master_lane_width").show();
    $(".intersection_name").show();
    if (selected == "child"){
    	$('.intersection-info-tab').show();
        $(".velocity").show();
    }
	//----------------------------------------
	if(feature.attributes.marker.name != "Reference Point Marker"){
		$(".selection-panel").text('Verified Point Configuration');
		$("#lat").prop('readonly', true);
		$("#long").prop('readonly', true);
		$("#elev").prop('readonly', true);
		$(".intersection").hide();
        $(".intersection_type").hide();
    	$(".verified_lat").show();
    	$(".verified_long").show();
    	$(".verified_elev").show();
        $(".revision").hide();
        $(".master_lane_width").hide();
        $(".intersection_name").hide();
        $(".approach_name").hide();
        $('.intersection-info-tab').hide();
	}
	
	$('#revision').val(revisionNum);
	if (! selected_marker.attributes.elevation){
		$("#elev").val("");
	} else {
		$("#elev").val(selected_marker.attributes.elevation);
	}
	
	if (! selected_marker.attributes.verifiedElev){
		$("#verified_elev").val("");
	} else {
		$("#verified_elev").val(selected_marker.attributes.verifiedElev);
	}
	 
	selected_layer = this;
	if (! selected_marker.attributes.masterLaneWidth){
		$("#master_lane_width").val("366");
	} else {
		$("#master_lane_width").val(selected_marker.attributes.masterLaneWidth);
	}

    if (! selected_marker.attributes.layerID){
        $("#layer").val("1");
    } else {
        $("#layer").val(selected_marker.attributes.layerID);
    }

    if (selected_marker.attributes.intersectionName){
		$("#intersection_name").val(selected_marker.attributes.intersectionName);
	}

    if (selected == "child"){
        $('.btnDone').prop('disabled', true);
        $('.intersection-btn').prop('disabled', false);
        $('.btnClose').prop('readonly', false);
    } else {
        $('.btnDone').prop('disabled', false);
    }

   if (! selected_marker.attributes.intersectionType) {
        intersectionType = null;
        $('#intersection_type .dropdown-toggle').html("Select an Intersection Type <span class='caret'></span>");
    } else {
        intersectionType = selected_marker.attributes.intersectionType;
        $('#intersection_type .dropdown-toggle').html(selected_marker.attributes.intersectionType + " <span class='caret'></span>");
    }
   
   if (! selected_marker.attributes.speedLimitType) {
       removeSpeedForm();
       addSpeedForm();
   } else {
       rebuildSpeedForm(selected_marker.attributes.speedLimitType);
   }

	selected_layer = feature.layer;
	$("#attributes").show();
}


/**
 * Purpose: if lat/long is modified, it changes the location
 * @params  the feature and it's metadata
 * @event changes the location on the map by redrawing
 */

function updateFeatureLocation( feature ) {
	referencePointWindow(feature);
	feature.attributes.LonLat = (new OpenLayers.LonLat(feature.geometry.x, feature.geometry.y)).transform(toProjection, fromProjection);
	$('#long').val(feature.attributes.LonLat.lon);
	$('#lat').val(feature.attributes.LonLat.lat);
	populateRefWindow(feature, feature.attributes.LonLat.lat, feature.attributes.LonLat.lon);

    if (feature.attributes.marker.name == "Reference Point Marker") {
        if (!feature.attributes.intersectionID && !feature.attributes.intersectionIdEdit) {
            var tempLat = ((Math.abs(feature.attributes.LonLat.lat) % 1).toString().substr(3,3));
            var tempLon = ((Math.abs(feature.attributes.LonLat.lon) % 1).toString().substr(3,3));
            intersectionID = (((tempLat & 0xff) << 8) | (tempLon & 0xff)) >>> 0;
            $("#intersection").val(intersectionID);
        } else {
            intersectionID = feature.attributes.intersectionID;
            $("#intersection").val(feature.attributes.intersectionID);
        }
    }

    $("#intersection").on("propertychange change click keyup input paste", function(){
        if ($("#intersection").val() != intersectionID) {
            feature.attributes.intersectionIdEdit = true;
            feature.attributes.intersectionID = $("#intersection").val();
            intersectionID = $("#intersection").val();
        }
    });
}

function updateLaneFeatureLocation( feature ) {
	feature.attributes.LonLat = (new OpenLayers.LonLat(feature.geometry.x, feature.geometry.y)).transform(toProjection, fromProjection);
	$('#long').val(feature.attributes.LonLat.lon);
	$('#lat').val(feature.attributes.LonLat.lat);
	populateRefWindow(feature, feature.attributes.LonLat.lat, feature.attributes.LonLat.lon);
}

/*********************************************************************************************************************/
/**
 * Purpose: misc. functions that allow specific data to be visible a certain way
 * @params  -
 * @event varies
 *
 * Note: the ul/li select boxes should one da become select boxes with options, but the styling was hard to replicate
 * at first.
 */

$("#approach_type .dropdown-menu li a").click(function(){
	var selText = $(this).text();
	approachType = selText;
	$(this).parents('.btn-group').find('.dropdown-toggle').html(selText+' <span class="caret"></span>');
});

$("#intersection_type li a").click(function(){
    var selText = $(this).text();
    $(this).parents('.btn-group').find('.dropdown-toggle').html(selText+' <span class="caret"></span>');
    intersectionType = selText;
});

$("#phase .dropdown-menu li a").click(function(){
    var selText = $(this).text();
    signalPhase = selText;
    $(this).parents('.btn-group').find('.dropdown-toggle').html(selText+' <span class="caret"></span>');
    val = selText.substring(1,2);
    $('.phases').hide();
    $('#phase' + val).show();
});

$("#confidence .dropdown-menu li a").click(function(){
    var selText = $(this).text();
    stateConfidence = selText;
    $(this).parents('.btn-group').find('.dropdown-toggle').html(selText+' <span class="caret"></span>');
});

$("#lane_number .dropdown-menu li a").click(function(){
    var selText = $(this).text();
    laneNum = selText;
    $(this).parents('.btn-group').find('.dropdown-toggle').html(selText+' <span class="caret"></span>');
});

$("#approach_name .dropdown-menu li a").click(function(){
    var selText = $(this).text();
    approachID = selText;
    $(this).parents('.btn-group').find('.dropdown-toggle').html(selText+' <span class="caret"></span>');
});

$("#lane_type .dropdown-menu li a").click(function(){
    var selText = $(this).text();
    laneType = selText;
    $(this).parents('.btn-group').find('.dropdown-toggle').html(selText+' <span class="caret"></span>');
    toggleLaneTypeAttributes(laneType);
});

function toggleLaneTypeAttributes(attribute, values){
	for (var i = 0; i < laneTypeOptions.length; i++) {
		$('.' + laneTypeOptions[i] + '_type_attributes').parent().hide();
	}
	
	updateTypeAttributes(attribute)
	
	if ( $('.' + attribute + '_type_attributes').length === 0 ){
	    $('#' + attribute + '_type_attributes').multiselect({
	        onChange: function(option, checked){
	            updateTypeAttributes(attribute)
	        },
	        maxHeight: 200,
	        buttonClass: attribute + '_type_attributes btn btn-default',
	        buttonText: function(options, select) {
	            if (options.length === 0) {
	                return 'Select '+ attribute + ' Type Attribute'
	            } else if (options.length > 1) {
	                return options.length + ' selected';
	            } else {
	                var labels = [];
	                options.each(function() {
	                    if ($(this).attr('label') !== undefined) {
	                        labels.push($(this).attr('label'));
	                    }
	                    else {
	                        labels.push($(this).html());
	                    }
	                });
	                return labels.join(', ') + '';
	            }
	        }
	    });
	}
	
	$('#' + attribute + '_type_attributes').multiselect('deselectAll', false);
    $('#' + attribute + '_type_attributes').multiselect("refresh");
    $('.' + attribute + '_type_attributes').parent().show();
    $("label[for='lane_type_attributes']").show();
    $(".lane_type_attributes").show();
}

function updateSharedWith(){
    sharedWith_object = $('#shared_with option:selected').map(function(a, item){return item.value;})
}

function updateTypeAttributes(attribute) {
	typeAttributeName = attribute;
	typeAttribute_object = $('#' + attribute + '_type_attributes option:selected').map(function(a, item){return item.value;})
}


/**
 * Purpose: populate reference point modal window
 * @params  the feature and it's metadata
 * @event loads the appropriate data - elevation is doen through ajax
 */

function populateAttributeWindow(temp_lat, temp_lon){
	$('#lat').val(temp_lat);
	$('#long').val(temp_lon);
}

function populateRefWindow(feature, lat, lon)
{
	
	$.ajax({
		type: 'GET',
		url: intersection_url,
		data: {
			lat: lat,
			lng: lon,
			username: geoNamesUserName
		},
		datatype: 'json',
		cache: false,
		success: function(result){
            if( result.intersection ) {
            	var name = result.intersection.street1 + " & " + result.intersection.street2
                $('#intersection_name').val(name);
                feature.attributes.intersectionName = name;
            } else {
                console.log("intersection not found");
                $('#intersection_name').val("Temporary Name");
            }
		}
	});

	var elev;

    $.ajax({
        url: elevation_url + lat + ',' + lon + '&key=' + apiKey,
        dataType: 'jsonp',
        jsonp: 'jsonp',
        cache: false,
        success: function(result){
            elev = result.resourceSets[0].resources[0].elevations[0];
            if (elev == null){
                elev = -9999; //any sea value is set to -9999 by default. This brings it back to sea level as we know it
            }
            if (! feature.attributes.elevation ) {
                $('#elev').val(elev);
            } else {
                if (feature.attributes.number > -1) {
                    if (!feature.attributes.elevation.value) {
                        $('#elev').val(elev);
                    }
                }
            }
            if (feature.attributes.verifiedElev){
                $('#verified_elev').val(feature.attributes.verifiedElev);
            } else {
                $('#verified_elev').val(elev);
            }
        }
    });
	
	if (feature.attributes.verifiedLat){
		$('#verified_lat').val(feature.attributes.verifiedLat);	
	} else {
		$('#verified_lat').val(lat);
	}
	if (feature.attributes.verifiedLon){
		$('#verified_long').val(feature.attributes.verifiedLon);
	} else {
		$('#verified_long').val(lon);
	}
	
}


/*********************************************************************************************************************/
/**
 * Purpose: validate the data and save the data to the feature
 * @params  the sidebar form elements
 * @event validates all the visible data using parsley js. If it is not accepted, it turns the form locations
 * with issues red, otherwise, it allows the data object to be created and saved to the feature
 */

$(".btnDone").click(function(){
	
	$('#attributes').parsley().validate();

	if (selected_layer.name == "Lane Marker Layer" && selected_marker.attributes.number == 0){
		if ( laneType != null && laneNum != null){
			dropdownCheck = true;
		} else {
			dropdownCheck = false;
		}
	
		if (laneType == null){
			$("#lane_type_check").show();
		} else {
			$("#lane_type_check").hide();
		}
		if (laneNum == null){
			$("#lane_num_check").show();
		} else {
			$("#lane_num_check").hide();
		}
	} else {
		dropdownCheck = true;
	}
	
	if ( $(".parsley-errors-list li:visible").length === 0 && dropdownCheck === true) {
		
			setLaneAttributes();
			$("#attributes").hide();
			
			updateSharedWith();
			updateTypeAttributes(typeAttributeName);
            saveConnections();
			
	        sharedWith = [];
	        for(i = 0; i < sharedWith_object.length ; i++){
	        	sharedWith[i] = sharedWith_object[i]
	        }
	        
	        typeAttributeNameSaved = typeAttributeName;
	        typeAttribute = [];
	        for(i = 0; i < typeAttribute_object.length ; i++){
	        	typeAttribute[i] = typeAttribute_object[i]
	        }
		
			var move = new OpenLayers.LonLat($('#long').val(), $('#lat').val()).transform(fromProjection, toProjection)
		
			if (selected_layer.name == "Lane Marker Layer"){
				var vert = lanes.features[selected_marker.attributes.lane].geometry.components[selected_marker.attributes.number];
				vert.move(move.lon - vert.x, move.lat - vert.y);
				selected_marker.move(move);
				lanes.redraw();
				if ( selected_marker.attributes.number == 0 ) {
					selected_marker.attributes.spatRevision = $('#spat_revision').val();
					selected_marker.attributes.signalGroupID = $('#signal_group_id').val();
					selected_marker.attributes.startTime = $('#start_time').val();
					selected_marker.attributes.minEndTime = $('#min_end_time').val();
					selected_marker.attributes.maxEndTime = $('#max_end_time').val();
					selected_marker.attributes.likelyTime = $('#likely_time').val();
					selected_marker.attributes.nextTime = $('#next_time').val();
					selected_marker.attributes.sharedWith = sharedWith;
					selected_marker.attributes.typeAttribute = typeAttribute;

                        if (nodeObject != null) {
                            selected_marker.attributes.connections = nodeObject;
                            (lanes.features[selected_marker.attributes.lane]).attributes.connections = nodeObject;
                        }

	                    if (laneNum != null){
	                        selected_marker.attributes.laneNumber = laneNum;
	                        (lanes.features[selected_marker.attributes.lane]).attributes.laneNumber = laneNum;
	                    }
	                    if (laneType != null){
	                        selected_marker.attributes.laneType = laneType;
	                        (lanes.features[selected_marker.attributes.lane]).attributes.laneType = laneType;
	                    }
	                    if (stateConfidence != null){
	                        selected_marker.attributes.stateConfidence = stateConfidence;
	                        (lanes.features[selected_marker.attributes.lane]).attributes.stateConfidence = stateConfidence;
	                    }
	                    if (signalPhase != null){
	                        selected_marker.attributes.signalPhase = signalPhase;
	                        (lanes.features[selected_marker.attributes.lane]).attributes.signalPhase = signalPhase;
	                    }
	
					(lanes.features[selected_marker.attributes.lane]).attributes.spatRevision = $('#spat_revision').val();
					(lanes.features[selected_marker.attributes.lane]).attributes.signalGroupID = $('#signal_group_id').val();
					(lanes.features[selected_marker.attributes.lane]).attributes.startTime = $('#start_time').val();
					(lanes.features[selected_marker.attributes.lane]).attributes.minEndTime = $('#min_end_time').val();
					(lanes.features[selected_marker.attributes.lane]).attributes.maxEndTime = $('#max_end_time').val();
					(lanes.features[selected_marker.attributes.lane]).attributes.likelyTime = $('#likely_time').val();
					(lanes.features[selected_marker.attributes.lane]).attributes.nextTime = $('#next_time').val();
					(lanes.features[selected_marker.attributes.lane]).attributes.sharedWith = sharedWith;
					(lanes.features[selected_marker.attributes.lane]).attributes.typeAttribute = typeAttribute;
					(lanes.features[selected_marker.attributes.lane]).attributes.lane_attributes = selected_marker.attributes.lane_attributes;
				}
				selected_marker.attributes.LatLon = new OpenLayers.LonLat($('#long').val(), $('#lat').val());

                nodeLaneWidth[selected_marker.attributes.number] = $("#lane_width").val();
				(lanes.features[selected_marker.attributes.lane]).attributes.laneWidth = nodeLaneWidth;
                nodeLaneWidth = [];

                selected_marker.attributes.elevation = $('#elev').val();
                (lanes.features[selected_marker.attributes.lane]).attributes.elevation[selected_marker.attributes.number].value = $("#elev").val();
                (lanes.features[selected_marker.attributes.lane]).attributes.elevation[selected_marker.attributes.number].edited = true;

            }
			
			if (selected_layer.name == "Stop Bar Layer"){
				if (approachType != null){
					selected_marker.attributes.approachType = approachType;
				}
				
	            if (approachID != null){
	                selected_marker.attributes.approachID = approachID;
	            }
			}
			
			if (selected_layer.name == "Vector Layer"){
				if (selected == "child"){

                    selected_marker.attributes.speedLimitType = saveSpeedForm();
                    speedLimits = [];

				} else {
					selected_marker.move(move);
					if (selected_marker.attributes.marker.name == "Verified Point Marker"){
						selected_marker.attributes.verifiedLat = $("#verified_lat").val();
						selected_marker.attributes.verifiedLon = $("#verified_long").val();
						selected_marker.attributes.verifiedElev = $("#verified_elev").val();
						selected_marker.attributes.elevation = $("#elev").val();
					}
					if (selected_marker.attributes.marker.name == "Reference Point Marker"){
						selected_marker.attributes.intersectionName = $("#intersection_name").val();
						selected_marker.attributes.elevation = $("#elev").val();
		                selected_marker.attributes.intersectionType = intersectionType;
		                selected_marker.attributes.intersectionID = $("#intersection").val();
		                intersectionID = $("#intersection").val();
		                selected_marker.attributes.masterLaneWidth = $("#master_lane_width").val();
		                selected_marker.attributes.revisionNum = revisionNum;
                        selected_marker.attributes.layerID = $("#layer").val();
					}
				}
			}
			$('#attributes').parsley().reset();
			unselectFeature( selected_marker );
	}
    onFeatureAdded();
});


/*********************************************************************************************************************/
/**
 * Purpose: if cancel - prevents data from being stored
 * @params  the sidebar form elements
 * @event removes all form data and clears any temp objects that may be housing data so that next load can start clean
 * from the feature object
 */

$(".btnClose").click(function(){
	$("#attributes").hide();
    $('#shared_with').multiselect('deselectAll', false);
    $('#shared_with').multiselect('select', sharedWith);
	for (var i = 0; i < laneTypeOptions.length; i++) {
		if (laneTypeOptions[i] != typeAttributeNameSaved && $('.' + laneTypeOptions[i] + '_type_attributes').length !== 0) {
			$('#' + laneTypeOptions[i] + '_type_attributes').multiselect('deselectAll', false);
			$('#' + laneTypeOptions[i] + '_type_attributes').multiselect('refresh');
		}
	}
    removeSpeedForm();
	$('#attributes').parsley().reset();
    rebuildConnections([]);
	unselectFeature( selected_marker );
    $('input[name=include-spat]').attr('checked',false);
    $('.phases').hide();
    stateConfidence = null;
    signalPhase = null;
    laneNum = null;
    nodeLaneWidth = [];
    onFeatureAdded();
});


function getCookie(cname) {
    var name = cname + "=";
    var decodedCookie = decodeURIComponent(document.cookie);
    var ca = decodedCookie.split(';');
    for(var i = 0; i <ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}

function getElevation(dot, latlon, i, j, callback){

    $.ajax({
        url: elevation_url + latlon.lat + ',' + latlon.lon + '&key=' + apiKey,
        dataType: 'jsonp',
        jsonp: 'jsonp',
        cache: false,
        success: function(result){
            elev = result.resourceSets[0].resources[0].elevations[0];
            if (elev == null){
                elev = -9999; //any sea value is set to -9999 by default. This brings it back to sea level as we know it
            }
            callback(elev, i, j, latlon, dot);
        },
        error: function(error){
            callback(-9999, i, j, latlon, dot);
        }
    });
}

