$(function() {
    var currentIndex = 0;
    var DEFAULT_ZOOM_LEVEL = 3;
    var gigapan_info;
    var pin_image = new Image();
    var context;

    $.getJSON('/gigapanID', function(data) {
	gigapan_info = data;
	if (gigapan_info != null) {
	    create_canvas();
	    var images = create_images();
	    pin_image.src = 'http://duke.edu/~tmn7/Resources/pin.png';
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
		    var coords = get_draw_coords(data[i]);
		    context.drawImage(pin_image, coords[0], coords[1]);
		    currentIndex += 1;
		}
		return poll_for_results();
	    }
	});
    }

    function create_canvas () {
	desired_zoom_level = (gigapan_info.levels - 1) - DEFAULT_ZOOM_LEVEL;
	height_at_zoom_level = gigapan_info.height 
	    / (Math.pow(2, desired_zoom_level));
	width_at_zoom_level = gigapan_info.width 
	    / (Math.pow(2, desired_zoom_level));
	var canvas = $("<canvas>", {width:width_at_zoom_level
				    , height:height_at_zoom_level, id: "draw"});
	$("#content").append(canvas);
	var ctx = canvas[0];
	ctx.width = width_at_zoom_level; 
	ctx.height = height_at_zoom_level;
	context = ctx.getContext('2d');
    }
    function create_images () {
	desired_zoom_level = (gigapan_info.levels - 1) - DEFAULT_ZOOM_LEVEL;
	height_at_zoom_level = gigapan_info.height 
	    / (Math.pow(2, desired_zoom_level));
	width_at_zoom_level = gigapan_info.width 
	    / (Math.pow(2, desired_zoom_level));	
	blocks_high = Math.ceil(height_at_zoom_level / 256);
	blocks_wide = Math.ceil(width_at_zoom_level / 256);
	var images = new Array(blocks_high);
	for (var i = 0; i < blocks_high; i++) {
	    for (var j = 0; j < blocks_wide; j++) {
		images[i] = new Array(blocks_wide);
		var img = new Image();
		img.src = get_tile_url(i, j, DEFAULT_ZOOM_LEVEL);
		$(img).load({myI: i, myJ: j, maxI: blocks_high - 1, 
			     maxJ: blocks_wide - 1}, function(ev) {
		    context.drawImage(ev.target, ev.data.myJ * 256, 
				      ev.data.myI * 256);
		    if (ev.data.myJ === ev.data.maxJ 
			&& ev.data.myI === ev.data.maxI) {
			return poll_for_results();
		    }
		});
	    }
	}
	return images;
    }

    function get_tile_url (row, column, level) {
	var GC_TILE = ['0', '1', '2', '3'];
	var fn = 'r';
	var path = 'http://share.gigapan.org/gigapans0/' 
	    + gigapan_info.id + '/tiles';
	for (var i = level - 1; i > -1; i--) {
	    var bit = 1 << i;
	    var index = 0;
	    if ((column & bit) != 0) {
		index = 1;
	    }
	    if ((row & bit) != 0) {
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
	if (depth == DEFAULT_ZOOM_LEVEL) {
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
	
	desired_zoom_level = (gigapan_info.levels - 1) - 3;
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