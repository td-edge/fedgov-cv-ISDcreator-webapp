/**
 * Created by lewisstet on 2/25/2015.
 * Updated 3/2017 by martzth
 */


/**
 * DEFINE GLOBAL VARIABLES
 */

	var GEOJSON_PARSER = new OpenLayers.Format.GeoJSON();


/**
 * Purpose: saves map object as geojson
 * @params  feature objects
 * @event compiles layer data into object
 */

function saveMap()
{
	$('#revision_modal').modal('show')
	
	$('#revision_modal .btn').click(function(event){
		if(($('#revision_num').val()).match(/^\d+$/)){
			
		    for ( var f = 0; f < vectors.features.length; f++) {
		        if (vectors.features[f].attributes.marker.name == "Reference Point Marker") {
					revisionNum = $('#revision_num').val();
					vectors.features[f].attributes.revisionNum = revisionNum;
		        }
		    }
		    
			var layers = {
					"vectors" : GEOJSON_PARSER.write(vectors.features, true),
					"box" : GEOJSON_PARSER.write(box.features, true),
					"lanes" : GEOJSON_PARSER.write(lanes.features, true),
					"laneMarkers" : GEOJSON_PARSER.write(laneMarkers.features, true)
				};
	
				saveFile( layers )
		} else {
			alert("Must enter a number value.");
			return false;
		}
	});
}


/**
 * Purpose: saves compiled object as geojson file
 * @params  map object
 * @event saves as geojson and loads save menu option
 */

function saveFile( data )
{
	var textToWrite = JSON.stringify( data );
	var textFileAsBlob = new Blob([textToWrite], {type:'text/plain'});

	var fileNameToSaveAs;
	var referenceExists = false;

	for ( var f = 0; f < vectors.features.length; f++) {
		var feature = vectors.features[f];
		if (feature.attributes.marker.name == "Reference Point Marker") {
			if (feature.attributes.intersectionID){
				referenceExists = true;
			}
		}
	}

	if (!referenceExists){
		alert("Cannot save parent without valid and saved reference point");
		return;
	}

	if (selected == "parent") {
		fileNameToSaveAs = "ISD_" + intersectionID + "_parent_r" + revisionNum + ".geojson"
	}
	if (selected == "child"){
		fileNameToSaveAs = "ISD_" + intersectionID + "_child_r" + revisionNum + ".geojson"
	}

	var downloadLink = document.createElement("a");
	downloadLink.download = fileNameToSaveAs;
	//downloadLink.innerHTML = "Download File";
	if (window.webkitURL != null){
		// Chrome allows the link to be clicked
		// without actually adding it to the DOM.
		downloadLink.href = window.webkitURL.createObjectURL(textFileAsBlob);
	}
	else{
		// Firefox requires the link to be added to the DOM
		// before it can be clicked.
		try {
			downloadLink.href = window.URL.createObjectURL(textFileAsBlob);
			downloadLink.onclick = destroyClickedElement;
			downloadLink.style.display = "none";
			document.body.appendChild(downloadLink);
		}
		catch( e ){
			console.log("error saving firefox file")
		}
		// IE 10+
		try {
			window.navigator.msSaveBlob(textFileAsBlob, fileNameToSaveAs);
		}
		catch(e){
			console.log("error saving IE file")
		}
	}

	try {
		downloadLink.click();
	}
	catch(e) {
		console.log("Unable to click the download link.  Are you using IE?")
	}

	document.body.removeChild(downloadLink);
}


/**
 * Purpose: loads map objects from geojson
 * @params  saved object
 * @event rebuilds markers on map
 */

function loadMap( data )
{
	var vectorLayerAsOL = GEOJSON_PARSER.read(data.vectors);
	var stopLayerAsOL = GEOJSON_PARSER.read(data.box);
	var lanesLayerAsOL = GEOJSON_PARSER.read(data.lanes);
	var laneMarkersLayerAsOL = GEOJSON_PARSER.read(data.laneMarkers);

	vectors.addFeatures(vectorLayerAsOL);
	box.addFeatures(stopLayerAsOL);
	lanes.addFeatures(lanesLayerAsOL);
	laneMarkers.addFeatures(laneMarkersLayerAsOL);

	var feat = vectors.features;
	for(var a = 0; a < feat.length; a++){
		var iconAddress = feat[a].attributes.marker.img_src;
		feat[a].style = {externalGraphic: iconAddress, graphicHeight: 50, graphicWidth: 50, graphicYOffset: -50};
        if (vectors.features[a].attributes.marker.name == "Reference Point Marker") {
			intersectionID = vectors.features[a].attributes.intersectionID;
        }
	};

	var ft = lanes.features;
	for(var i=0; i< ft.length; i++) {
		if(typeof lanes.features[i].attributes.elevation == 'string') {
			var temp = lanes.features[i].attributes.elevation;
			lanes.features[i].attributes.elevation = [];
			for (j = 0; j < lanes.features[i].geometry.getVertices().length; j++) {
				var dot = new OpenLayers.Feature.Vector(new OpenLayers.Geometry.Point(lanes.features[i].geometry.getVertices()[j].x, lanes.features[i].geometry.getVertices()[j].y));
				var latlon = new OpenLayers.LonLat(dot.geometry.x, dot.geometry.y).transform(toProjection, fromProjection);
				lanes.features[i].attributes.elevation[j] = ({'value': temp, 'edited': false, 'latlon': latlon});
			}
		}
	}
	
	try {
		var center = new OpenLayers.LonLat(feat[0].attributes.LonLat.lon,feat[0].attributes.LonLat.lat);
		center.transform(new OpenLayers.Projection("EPSG:4326"), map.getProjectionObject());
		var view_zoom = 18;
		if (getCookie("isd_zoom") !== ""){
			view_zoom = getCookie("isd_zoom");
		}
		map.setCenter(center,view_zoom);
		unselectFeature( feat[0] )
	}
	catch (err){
		console.log("No vectors to reset view");
	}
	
	vectors.redraw();
	
	$("#dragSigns").click();
	$("#dragSigns").click();
	
    toggleControlsOn('modify');
    toggleControlsOn('none');
}


/**
 * Purpose: loads file
 * @params  -
 * @event clears map and then opens modal to choose file
 */

function loadFile() {
    if (lanes.features.length != 0 || laneMarkers.features.length != 0 || vectors.features.length != 0 || box.features.length != 0) {
        var c = confirm("Loading a new map will clear all current work. Continue?");
    } else {
        c = true;
    }

    if (c == true) {
        lanes.destroyFeatures();
        laneMarkers.destroyFeatures();
        vectors.destroyFeatures();
        box.destroyFeatures();
		errors.clearMarkers();

        var ua = window.navigator.userAgent;
        var msie10 = ua.indexOf('MSIE ');
        var msie11 = ua.indexOf('Trident/');
        var msie12 = ua.indexOf('Edge/');

        if (msie10 > 0 || msie11 > 0 || msie12 > 0) {
            $('#open_file_modal').modal('show');
            $('#fileToLoad2').one('change', onChange);
        }
        else {
            $('#fileToLoad').click();
            $('#fileToLoad').one('change', onChange);
        }
    }
}

function onChange(event) {
	var reader = new FileReader();
	reader.onload = onReaderLoad;
	reader.readAsText(event.target.files[0]);
}

function onReaderLoad(event){
	var data = JSON.parse(event.target.result);
	loadMap( data )
	$('#open_file_modal').modal('hide');
}

function destroyClickedElement(event){
	document.body.removeChild(event.target);
}


/**
 * Purpose: misc functions that may not be used?
 * to be @deprecate?
 */

function changeLatLonName(name){
	if (name < 0){
		name = 0xFFFFFFFF + name + 1
	}

	name = name.toString(16).toUpperCase();
	name = parseInt(name, 16).toString(2);
	name = name.substr(name.length -20);
	name = name.substr(0, 13);

	return name;
}

function changeElevName(name){
	if (name < 0){
		name = 0xFFFFFFFF + name + 1
	}

	name = name.toString(16).toUpperCase();

	if (name.length == 1 || name.length == 3){
		name = "0" + name
	}

	name = parseInt(name, 16).toString(2);
	name = name.substr(name.length -7);
	name = name.substr(0, 6);

	return name;
}

