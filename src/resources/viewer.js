/*
 *  GigaPan Search Monitor, a HyperFind plugin for searching GigaPan images
 *
 *  Copyright (c) 2011 Carnegie Mellon University
 *  All rights reserved.
 *
 *  GigaPan Search Monitor is free software: you can redistribute it and/or
 *  modify it under the terms of the GNU General Public License as published
 *  by the Free Software Foundation, version 2.
 *
 *  GigaPan Search Monitor is distributed in the hope that it will be
 *  useful, but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 *  General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License along
 *  with GigaPan Search Monitor.  If not, see <http://www.gnu.org/licenses/>.
 *
 *  Linking GigaPan Search Monitor statically or dynamically with other
 *  modules is making a combined work based on GigaPan Search Monitor. 
 *  Thus, the terms and conditions of the GNU General Public License cover
 *  the whole combination.
 *
 *  In addition, as a special exception, the copyright holders of GigaPan
 *  Search Monitor give you permission to combine GigaPan Search Monitor
 *  with free software programs or libraries that are released under the GNU
 *  LGPL or the Eclipse Public License 1.0.  You may copy and distribute
 *  such a system following the terms of the GNU GPL for GigaPan Search
 *  Monitor and the licenses of the other code concerned, provided that you
 *  include the source code of that other code when and as the GNU GPL
 *  requires distribution of source code.
 *
 *  Note that people who make modified versions of GigaPan Search Monitor
 *  are not obligated to grant this special exception for their modified
 *  versions; it is their choice whether to do so.  The GNU General Public
 *  License gives permission to release a modified version without this
 *  exception; this exception also makes it possible to release a modified
 *  version which carries forward this exception.
 */

$(function() {
    // state
    var CURRENT_GIGAPAN = new Object();
    var RESULTS_MAP = new Object();
    var HIGHLIGHTED_PINS = [];
    var LAST_RESULT_NUM = 0;
    var SERIAL = 0;
    // Percentage of window height for top pane
    var TOP = 60;
    var DOCUMENT_WIDTH = 0;
    var DOCUMENT_HEIGHT = 0;
    // Dimensions of pin image
    var PIN_DIM = [20, 29]

    // init methods
    build_frames();
    poll();

    function poll () {
        $.getJSON('/data', {desiredResult:LAST_RESULT_NUM,
                            serialNumber:SERIAL}, function(data) {
            for (var i = 0; i < data.length; i++) {
                if (data[i].terminate) {
                    $("body").html("");
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

    // Update count of results next to each thumbnail
    function update_count(gigapan_id) {
        var count = RESULTS_MAP[gigapan_id].length;
        $('#' + gigapan_id + '_text').html(count + " results");
    }

    // Draw pin on focused GigaPan
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

    // Add thumbnail to top pane
    function draw_gigapan(result) {
        var img_div = create_thumbnail(result);
        $("#top").append(img_div);
    }

    // Create object representing a single GigaPan
    function create_gigapan_object(result) {
        var gigapan = new Object();
        gigapan.id = result.gigapan_id;
        gigapan.height = result.gigapan_height;
        gigapan.width = result.gigapan_width;
        gigapan.levels = result.gigapan_levels;
        return gigapan;
    }

    // Load the specified GigaPan into the bottom pane
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

    // Return HTML for displaying GigaPan in bottom pane
    function create_draw_html() {
        // The GigaPan thumbnail URL ignores the specified height.
        // Determine what size GigaPan to ask for based on the size of
        // the bottom pane.
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

    // Return thumbnail height for specified GigaPan given the width
    function y_from_x(gigapan, x) {
        var aspect_ratio = gigapan.width / gigapan.height;
        return Math.floor(x / aspect_ratio);
    }

    // Return thumbnail width for specified GigaPan given the height
    function x_from_y(gigapan, y) {
        var aspect_ratio = gigapan.width / gigapan.height;
        return Math.floor(y * aspect_ratio);
    }

    // Initialize document
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

    // Resize frames in accordance with current window size
    function update_frame_sizes() {
        DOCUMENT_WIDTH = $(window).width() - 25;
        DOCUMENT_HEIGHT = $(window).height() - 100;

        var height = DOCUMENT_HEIGHT;
        var width = DOCUMENT_WIDTH;
        var top_height = Math.floor((TOP / 100) * height);
        var bottom_height = Math.floor(((100 - TOP) / 100) * height);

        $('#top').height(top_height);
        var ids = ['#bottom', '#pins', '#image'];
        for (var i = 0; i < ids.length; i++) {
            $(ids[i]).height(bottom_height);
            $(ids[i]).width(width);
        }
    }

    // Return a div containing a thumbnail for the specified GigaPan
    function create_thumbnail (obj) {
        var width = 700;
        // GigaPan ignores the height
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

    // Return HTML for a pin with the specified parameters
    function get_pin_html(imgurl, id, x_coord, y_coord) {
        var style = "position:absolute; top:" + y_coord + "px;";
        style += " left:" + x_coord + "px;";
        var img = $("<img>", {src:imgurl, style:style, id:id, 'class':"pin"});
        $(img).click({myID:id}, function(e) {
            $.post("/display", {blah:e.data.myID});
        });
        return img;
    }

    // Return wrapper HTML for an image
    function get_img_html(imgurl, id, width, height) {
        var img = $("<img>", {src:imgurl, width:width, height:height});

        $(img).click({myID:id}, function(ev) {
            if (CURRENT_GIGAPAN.id !== ev.data.myID) {
                focus_gigapan(ev.data.myID);
            }
        });
        return img;
    }

    // Return the coordinates of a pin representing the given tile
    function get_draw_coords (object) {
        var real_level = (CURRENT_GIGAPAN.levels - 1) - object.level;
        var level_height = CURRENT_GIGAPAN.height /
            (Math.pow(2, real_level));
        var level_width = CURRENT_GIGAPAN.width /
            (Math.pow(2, real_level));

        var bottom_right_x = (object.col + 1) * 256;
        var bottom_right_y = (object.row + 1) * 256;
        var img_width = 256;
        var img_height = 256;
        if (bottom_right_x > level_width) {
            img_width = 256 - (bottom_right_x - level_width);
        }
        if (bottom_right_y > level_height) {
            img_height = 256 - (bottom_right_y - level_height);
        }


        var mid_x_coord = (object.col * 256) + (img_width / 2);
        var mid_y_coord = (object.row * 256) + (img_height / 2);
        var percentX = mid_x_coord / level_width;
        var percentY = mid_y_coord / level_height;

        var height = CURRENT_GIGAPAN.drawn_height;
        var width = CURRENT_GIGAPAN.drawn_width;

        var return_coord_x = Math.floor(percentX * width - (PIN_DIM[0] / 2));
        var return_coord_y = Math.floor(percentY * height - PIN_DIM[1]);

        return new Array(return_coord_x, return_coord_y);
    }
    
    $(window).resize(function() {
        update_frame_sizes();
        if (CURRENT_GIGAPAN.id !== -1) {
            focus_gigapan(CURRENT_GIGAPAN.id);
        }
    });
});
