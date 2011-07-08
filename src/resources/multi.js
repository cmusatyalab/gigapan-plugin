$(function() {
    // state
    var CURRENT_GIGAPAN = new Object();
    var RESULTS_MAP = new Object();
    var HIGHLIGHTED_PINS = [];
    var LAST_RESULT_NUM = 0;
    var SERIAL = 0;
    var TOP = 60;
    var DOCUMENT_WIDTH = 0;
    var DOCUMENT_HEIGHT = 0;
    var PIN_DIM = [20, 29]

    // init methods
    build_frames();
    poll();

    function poll () {
	$.getJSON('/data', {desiredResult:LAST_RESULT_NUM,
			    serialNumber:SERIAL}, function(data) {
	    for (var i = 0; i < data.length; i++) {
		if (data[i].terminate) {
		    window.close();
		    return;
		} else if (data[i].highlight) {
		    HIGHLIGHTED_PINS = data[i].highlight;
		    SERIAL = data[i].serial;
		    $(".pin").attr('src', '/resources/pin.png');
		    if (HIGHLIGHTED_PINS.length > 0 &&
			CURRENT_GIGAPAN.id !== HIGHLIGHTED_PINS[0].gigapan_id) {
			focus_gigapan(HIGHLIGHTED_PINS[0].gigapan_id);
		    }
		    for (var j = 0; j < HIGHLIGHTED_PINS.length; j++) {
			$("#" + HIGHLIGHTED_PINS[j].result_id).attr('src'
					,'/resources/pin_selected.png');
		    }
		} else {
		    var result = data[i];
		    LAST_RESULT_NUM += 1;
		    if (RESULTS_MAP.hasOwnProperty(result.gigapan_id)) {
			RESULTS_MAP[result.gigapan_id].push(result);
			if (result.gigapan_id === CURRENT_GIGAPAN.id) {
			    draw_pin(result);
			}
		    } else {
			RESULTS_MAP[result.gigapan_id] = new Array();
			RESULTS_MAP[result.gigapan_id].push(result);
			draw_gigapan(result);
		    }
		    update_count(result.gigapan_id);
		}
	    }	       
	    return poll();
	});
    }

    function update_count(gigapan_id) {
	var count = RESULTS_MAP[gigapan_id].length;
	$('#' + gigapan_id + '_text').html(count + " results");
    }

    function draw_pin(result) {
	var coords = get_draw_coords(result);
	var index = $.inArray(result, HIGHLIGHTED_PINS);
	var imgurl = '/resources/pin.png';
	for (var i = 0; i < HIGHLIGHTED_PINS.length; i++) {
	    if (HIGHLIGHTED_PINS[i].result_id === result.result_id) {
		imgurl = '/resources/pin_selected.png';
		break;
	    }
	}
	var imghtml = get_pin_html(imgurl, result.result_id
				   , coords[0], coords[1]);
	$("#pins").append(imghtml);
    }

    function draw_gigapan(result) {
	var img_div = create_thumbnail(result);
	$("#top").append(img_div);
    }

    function create_gigapan_object(result) {
	var gigapan = new Object();
	gigapan.id = result.gigapan_id;
	gigapan.height = result.gigapan_height;
	gigapan.width = result.gigapan_width;
	gigapan.levels = result.gigapan_levels;
	return gigapan;
    }

    function focus_gigapan(gigapan_id) {
	var result = RESULTS_MAP[gigapan_id][0];
	CURRENT_GIGAPAN = create_gigapan_object(result);
	$("#image").html(create_draw_html());
	$("#pins").html("");

	var to_draw = RESULTS_MAP[gigapan_id];
	for (var i = 0; i < to_draw.length; i++) {
	    draw_pin(to_draw[i]);
	}
    }
    
    function create_draw_html() {
	var max_x = DOCUMENT_WIDTH - PIN_DIM[0];
	var max_y = (((100 - TOP) / 100) * DOCUMENT_HEIGHT) - PIN_DIM[1];
	// assume max_x
	var implied_y = y_from_x(CURRENT_GIGAPAN, max_x);
	if (implied_y < max_y) {
	    CURRENT_GIGAPAN.drawn_width = max_x;
	    CURRENT_GIGAPAN.drawn_height = implied_y;
	    var imgurl = "http://www.gigapan.org/gigapans/" 
		+ CURRENT_GIGAPAN.id + "-" + max_x + "x" + implied_y + ".jpg";
	} else {
	    var implied_x = x_from_y(CURRENT_GIGAPAN, max_y);
	    CURRENT_GIGAPAN.drawn_width = implied_x;
	    CURRENT_GIGAPAN.drawn_height = max_y;
	    var imgurl = "http://www.gigapan.org/gigapans/" 
		+ CURRENT_GIGAPAN.id + "-" + implied_x + "x" + max_y + ".jpg";
	}
	return get_img_html(imgurl, CURRENT_GIGAPAN.id,
			    CURRENT_GIGAPAN.drawn_width,
			    CURRENT_GIGAPAN.drawn_height);
    }

    function y_from_x(gigapan, x) {
	var aspect_ratio = gigapan.width / gigapan.height;
	return Math.floor(x / aspect_ratio);
    }

    function x_from_y(gigapan, y) {
	var aspect_ratio = gigapan.width / gigapan.height;
	return Math.floor(y * aspect_ratio);
    }

    function build_frames() {
	CURRENT_GIGAPAN.id = -1;

	// top part
	var style = "position: relative;";
	style += "overflow-x: hidden; overflow-y: scroll;";
	var top = $("<div/>", {style:style, id:"top"});
	$("#outer").append(top);
	$("#outer").append("<br><br>");
	
	// bottom part
	var style = "position: relative;";
	var bottom = $("<div/>", {style:style, id:"bottom"});

	// bottom sub-divs
	var style = "position: absolute;";
	var bottom_pin = $("<div/>", {style:style, id:"pins"});
	style += "overflow: hidden;";
	var bottom_image = $("<div/>", {style:style, id:"image"});
	$(bottom).append(bottom_image);
	$(bottom).append(bottom_pin);

	$("#outer").append(bottom);

	update_frame_sizes();
    }

    function update_frame_sizes() {
	DOCUMENT_WIDTH = $(document).width() - 25;
	DOCUMENT_HEIGHT = $(document).height() - 100;

	var height = DOCUMENT_HEIGHT;
	var width = DOCUMENT_WIDTH;
	var top_height = (TOP / 100) * height;
	var bottom_height = ((100 - TOP) / 100) * height;

	$('#top').height(top_height);
	for (var id in ['#bottom', '#pins', '#image']) {
	    $(id).height(bottom_height);
	    $(id).width(width);
	}
    }

    function create_thumbnail (obj) {
	var width = 700;
	var imgurl = "http://www.gigapan.org/gigapans/" 
	    + obj.gigapan_id + "-" + width + "x200.jpg";
	// create "canvas"
	var style = "top: 17px; left: 17px;";
	style += "position: relative;";
	var img_div = $("<div/>", {id:"images", style:style});
	var gigapan_obj = create_gigapan_object(obj);
	$(img_div).append(get_img_html(imgurl, obj.gigapan_id, 
				       width, y_from_x(gigapan_obj, width)));
	$(img_div).append($("<span/>", {style:"vertical-align:top; margin:10px;"
					, id: obj.gigapan_id + "_text"}));
	return img_div;
    }

    function get_pin_html(imgurl, id, x_coord, y_coord) {
	var style = "position:absolute; top:" + y_coord + "px;";
	style += " left:" + x_coord + "px;";
	var img = $("<img>", {src:imgurl, style:style, id:id, 'class':"pin"});
	$(img).click({myID:id}, function(e) {
	    $.post("/display", {blah:e.data.myID});
	});
	return img;
    }

    function get_img_html(imgurl, id, width, height) {
	var img = $("<img>", {src:imgurl, width:width, height:height});

	$(img).click({myID:id}, function(ev) {
	    if (CURRENT_GIGAPAN.id !== ev.data.myID) {
		focus_gigapan(ev.data.myID);
	    }
	});

	return img;
    }


    function get_draw_coords (object) {
	actual_object_zoom = (CURRENT_GIGAPAN.levels - 1) - object.level;
	height_at_zoom_level = CURRENT_GIGAPAN.height 
	    / (Math.pow(2, actual_object_zoom));
	width_at_zoom_level = CURRENT_GIGAPAN.width 
	    / (Math.pow(2, actual_object_zoom));
	
	mid_x_coord = (256 * object.col) + 128;
	mid_y_coord = (256 * object.row) + 128;
	percentX = mid_x_coord / width_at_zoom_level;
	percentY = mid_y_coord / height_at_zoom_level;

	var height = CURRENT_GIGAPAN.drawn_height;
	var width = CURRENT_GIGAPAN.drawn_width;

	return_coord_x = Math.min((percentX * width - 10), 
				  width - 10);
	return_coord_y = Math.min((percentY * height - 34), 
				  width - 34);
	
	return new Array(return_coord_x, return_coord_y);
    }
    
    $(window).resize(function() {
	update_frame_sizes();
	focus_gigapan(CURRENT_GIGAPAN.id);
    });
});