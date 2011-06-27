$(function() {
    var currentIndex = 0;
    var ZOOM_LEVEL = 3;
    var gigapan_info;
    var context;

    $.getJSON('/gigapanID', function(data) {
	gigapan_info = data;
	if (gigapan_info != null) {
	    create_images();
	    poll_for_results();
	}
    });
    
    function poll_for_results () {
	$.ajax({
	    type: 'GET',
	    url: "/results",
	    data: {resultNum : currentIndex},
	    dataType: ($.browser.msie) ? "text" : "json",
	    success: function (data) {
		for (i = 0; i < data.length; i++) {
		    if (data[i].terminate) {
			return;
		    }
		    var coords = get_draw_coords(data[i]);
		    var imgurl = 'resources/pin.png';
		    var imghtml = get_img_html(imgurl, coords[0], 
					       coords[1], 20, 34, 
					       data[i].result_id);
		    $("#pins").append(imghtml);
		    currentIndex += 1;
		}
		return poll_for_results();
	    }
	});
    }
    
    $("#zoom_in").click(function(e) {
	if (ZOOM_LEVEL < 5) {
	    ZOOM_LEVEL += 1;
	    $("#outer").html("");
	    currentIndex = 0;
	    create_images();
	    poll_for_results();
	}
    });

    $("#zoom_out").click(function(e) {
	if (ZOOM_LEVEL > 2) {
	    ZOOM_LEVEL -= 1;
	    $("#outer").html("");
	    currentIndex = 0;
	    create_images();
	    poll_for_results();
	}
    });

    function create_images () {
	desired_zoom_level = (gigapan_info.levels - 1) - ZOOM_LEVEL;
	height_at_zoom_level = gigapan_info.height 
	    / (Math.pow(2, desired_zoom_level));
	width_at_zoom_level = gigapan_info.width 
	    / (Math.pow(2, desired_zoom_level));	
	blocks_high = Math.ceil(height_at_zoom_level / 256);
	blocks_wide = Math.ceil(width_at_zoom_level / 256);
	
	// create "canvas"
	var style = "width: " + width_at_zoom_level + "px; ";
	style += "height: " + height_at_zoom_level + "px; ";
	style += "top: 17px; left: 17px;";
	style += "position: absolute;" 
	var pin_div = $("<div/>", {id:"pins", style:style});
	style += "overflow: hidden;";
	var img_div = $("<div/>", {id:"images", style:style});
	$("#outer").append(img_div);
	$("#outer").append(pin_div);

	for (var i = 0; i < blocks_high; i++) {
	    for (var j = 0; j < blocks_wide; j++) {
		var imgurl = get_tile_url(i, j, ZOOM_LEVEL);
		var img_x = j * 256; var img_y = i * 256;
		var img_width = 256; var img_height = 256;
		if (img_x + img_width > width_at_zoom_level) {
		    img_width = width_at_zoom_level - img_x;
		}
		if (img_y + img_height > height_at_zoom_level) {
		    img_height = height_at_zoom_level - img_y;
		}
		var imghtml = get_img_html(imgurl, j * 256, i * 256, 
					   256, 256, "");
		$(img_div).append(imghtml);
	    }
	}
    }

    function get_img_html(imgurl, x_coord, y_coord, img_width, img_height, id) {
	var style = "position:absolute; top:" + y_coord + "px;";
	style += " left:" + x_coord + "px;";
	var img = $("<img>", {src:imgurl, style:style, width:img_width,
			      height:img_height});
	if (id !== "") {
	    $(img).click({myID:id}, function(ev) {
		$.post('/display', {id: ev.data.myID}, function(data) {
		});
	    });
	}
	return img;
    }

    function get_tile_url (row, column, level) {
	var GC_TILE = ['0', '1', '2', '3'];
	var fn = 'r';
	var path = 'http://share.gigapan.org/gigapans0/' 
	    + gigapan_info.id + '/tiles';
	for (var i = level - 1; i > -1; i--) {
	    var bit = 1 << i;
	    var index = 0;
	    if ((column & bit) !== 0) {
		index = 1;
	    }
	    if ((row & bit) !== 0) {
		index += 2;
	    }
	    fn += GC_TILE[index]
	}
	for (var i = 0; i < fn.length - 3; i+=3) {
	    path += '/' + fn.substring(i, i + 3);
	}
	return path + '/' + fn + ".jpg";
    }

    function descend_quad_tree(depth, position, prefix) {
	if (depth === ZOOM_LEVEL) {
	    return prefix + String(position);
	} else {
	    var nw = descend_quad_tree(depth + 1, 0, prefix + String(position));
	    var ne = descend_quad_tree(depth + 1, 1, prefix + String(position));
	    var sw = descend_quad_tree(depth + 1, 2, prefix + String(position));
	    var se = descend_quad_tree(depth + 1, 3, prefix + String(position));
	    return new Array(nw, ne, sw, se);
	}
    }

    function get_draw_coords (object) {
	actual_object_zoom = (gigapan_info.levels - 1) - object.level;
	height_at_zoom_level = gigapan_info.height 
	    / (Math.pow(2, actual_object_zoom));
	width_at_zoom_level = gigapan_info.width 
	    / (Math.pow(2, actual_object_zoom));
	
	mid_x_coord = (256 * object.col) + 128;
	mid_y_coord = (256 * object.row) + 128;
	percentX = mid_x_coord / width_at_zoom_level;
	percentY = mid_y_coord / height_at_zoom_level;
	
	desired_zoom_level = (gigapan_info.levels - 1) - ZOOM_LEVEL;
	height_at_desired_zoom = gigapan_info.height 
	    / (Math.pow(2, desired_zoom_level));
	width_at_desired_zoom = gigapan_info.width 
	    / (Math.pow(2, desired_zoom_level));
	return_coord_x = Math.min((percentX * width_at_desired_zoom - 10), 
				  width_at_desired_zoom - 10);
	return_coord_y = Math.min((percentY * height_at_desired_zoom - 34), 
				  height_at_desired_zoom - 34);
	
	return new Array(return_coord_x, return_coord_y);
    }
});