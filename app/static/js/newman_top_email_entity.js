/**
 * Created by jlee on 10/31/15.
 */

/**
 * email-entity related container
 */
var newman_top_email_entity = (function () {
  var debug_enabled = false;

  var chart_bar_ui_id = '#chart_horizontal_bar_entities';
  var chart_bar_legend_ui_id = '#chart_legend_entities';

  var chart_donut_ui_id = '#chart_donut_entities';
  var _donut_chart_entity_email;


  var _entity_type_color_map = {
    "person": "#00ccff",
    "organization": "#ffcc33",
    "location": "#00ff00",
    "misc": "#c0c0c0"
  };

  var _entity_selected_person = {};
  var _entity_selected_location = {};
  var _entity_selected_org = {};
  var _entity_selected_misc = {};

  function getEntityTypeColor(key) {
    var color = _entity_type_color_map['misc'];
    if (key) {
      var value = _entity_type_color_map[key]
      if (value) {
        color = value;
      }
    }
    return color;
  }

  var response_element_list = [];
  var min_request_count = 10, max_request_count = 50, ui_display_count = 10;

  function getMinRequestCount() {
    return min_request_count;
  }

  function getMaxRequestCount() {
    return max_request_count;
  }

  function getUIDisplayCount() {
    return ui_display_count;
  }

  function getTopEmailEntityList( count ) {
    if (debug_enabled) {
      //console.log('getTopEmailEntityList(' + count + ')');
    }

    var top_response_element_list = [];
    _.each(response_element_list, function (item, index) {
      //console.log('\tindex : ' + index + '\nitem :' + JSON.stringify(item, null, 2));
      if (index < count) {
        top_response_element_list.push( item );
      }
    });
    return top_response_element_list;
  }

  /**
   * search email entities
   */
  function requestEmailEntitySearch( parent_search_uid, clear_sibling, dataset_list_string, entity_text_list, callback ) {

    newman_email_entity_search_request.requestService( parent_search_uid, clear_sibling, dataset_list_string, entity_text_list, callback );
  }

  /**
   * request and display the top list of email entities
   */
  function requestEmailEntityList() {
    newman_top_email_entity_list_request.requestService( getMaxRequestCount() );
  }

  /**
   * update from service the top email-entities-related charts
   * @param response
   */
  function onRequestEmailEntityList( response ) {

    if (response) {
      //if (debug_enabled) {
        //console.log('onRequestEmailEntityList( response )\n' + JSON.stringify(response, null, 2));
      //}

      if (response_element_list.length > 0) { // clear cache if any
        response_element_list.length = 0;
      }
      _.each(response, function (item, index) {
        response_element_list.push( item );
      });
    }

      initUI();
      clearAllEntitySelected();

    var ui_display_entity_list = getTopEmailEntityList( ui_display_count );

        var legend_items = ["Person", "Location", "Organization", "Misc"];

    if (ui_display_entity_list.length > 0) {
      //console.log('ui_display_entity_list: ' + JSON.stringify(ui_display_entity_list, null, 2));

      var legend = $('<div>').css('padding-top', '8px');
      _.each(legend_items, function (item) {
        legend.append($('<div>').css({
            'display': 'inline-block',
            'width': '20px',
            'height': '12px',
            'padding-left': '5px',
            'padding-right': '5px;'
          }).addClass('newman-entity-' + item.toLowerCase()))
          .append($('<span>').css({'padding-left': '5px', 'padding-right': '5px'}).text(item))
          .append($('<br/>'));
      });

      if (chart_bar_legend_ui_id) {
        $(chart_bar_legend_ui_id).append(legend);
      }

      var width = 490, height_bar = 13, margin_top = 8, margin_bottom = 2;
      var margin = {top: margin_top, right: 10, bottom: margin_bottom, left: 150};
      width = width - margin.left - margin.right;

      var max_value = ui_display_entity_list[0].entity_ref_count;
      var adjusted_width_factor = getAdjustedChartWidthFactor(width, max_value);

      var x = d3.scale.linear().range([0, width]);
      var chart = d3.select(chart_bar_ui_id).append('svg')
        .attr('class', 'chart')
        .attr("width", width + margin.left + margin.right);

      x.domain([0, ui_display_entity_list[0].entity_ref_count]);
      chart.attr("height", height_bar * ui_display_entity_list.length + margin_top + margin_bottom);

      var bar = chart.selectAll("g")
        .data(ui_display_entity_list).enter()
        .append("g")
        .attr("transform", function (d, i) {
          return "translate(" + margin.left + "," + (+(i * height_bar) + +margin.top) + ")";
        });

      bar.append("rect")
        .attr("width", function (d) {
          return getAdjustedChartWidth(adjusted_width_factor, d.entity_ref_count);
        })
        .attr("height", height_bar - 1)
        .attr("class", function (d) {
          return d.entity_type + ' label clickable';
        })
        .on("click", function (d) {
          //console.log('entity-text clicked\n' + JSON.stringify(d, null, 2));

          onEntityClicked(d.entity_text, d.entity_type);

        })
        .append('title').text(function (d) {
        return d.entity_text;
      });

      bar.append("text")
        .attr("x", function (d) {
          return (getAdjustedChartWidth(adjusted_width_factor, d.entity_ref_count) - 3);
        })
        .attr("y", height_bar / 2)
        .attr("dy", ".35em")
        .text(function (d) {
          return +d.entity_ref_count;
        });

      bar.append("text")
        .attr("x", function (d) {
          return -margin.left;
        })
        .attr("y", height_bar / 2)
        .attr("class", "label clickable")
        .on("click", function (d) {
          //console.log('entity-text clicked\n' + JSON.stringify(d, null, 2));

          onEntityClicked(d.entity_text, d.entity_type);

        })
        .text(function (d) {

          var text = truncateString(d.entity_text, app_display_config.getLabelLengthMax());

          return text;

        })
        .append('title').text(function (d) {
        return d.entity_text;
      });

      //console.log('adjusted_width_factor : ' + adjusted_width_factor);
      //console.log('ui_display_list :\n' + JSON.stringify(ui_display_entity_list, null, 2));

      var top_donut_chart_sum = 0;
      var top_donut_chart_colors = [];


      _.each(ui_display_entity_list, function (element, index) {
        var adjusted_value = getAdjustedChartWidth(adjusted_width_factor, element.entity_ref_count) / width * 100;
        //console.log('adjusted_value : ' + adjusted_value);
        top_donut_chart_sum = top_donut_chart_sum + adjusted_value;

        var entity_color = getEntityTypeColor(element.entity_type);
        top_donut_chart_colors.push(entity_color);
      });


      var top_donut_chart_data = [];

      _.each(ui_display_entity_list, function (element, index) {
        var adjusted_value = getAdjustedChartWidth(adjusted_width_factor, element.entity_ref_count) / width * 100;
        //console.log('adjusted_value : ' + adjusted_value);

        var percent_value = (adjusted_value / top_donut_chart_sum * 100);
        //console.log('percent_value : ' + percent_value);

        var entry = {
          value: percent_value,
          label: element.entity_text,
          formatted: Math.round(percent_value) + '%'
        };
        top_donut_chart_data.push(entry);
      });


      _donut_chart_entity_email = Morris.Donut({
        element: 'chart_donut_entities',
        resize: true,
        data: top_donut_chart_data,
        colors: top_donut_chart_colors,
        formatter: function (x, data) {
          return data.formatted;
        }
      });

      _donut_chart_entity_email.select(0);

    }// end-of if (ui_display_entity_list.length > 0)
    else {
      console.log('ui_display_entity_list: empty');
    }

  } // end-of onRequestEmailEntityList( response )

  function getAdjustedChartWidthFactor(width, max_value) {
    var adjusted_factor = 1.0, adjusted_max = parseFloat(max_value);
    if (width && max_value) {
      var done = false;
      if (adjusted_max >= width) {

        while (!done) {
          adjusted_max = (adjusted_max * 0.85);
          done = adjusted_max < width;
        }
      }
      else {
        done = (adjusted_max * 1.15) > width;
        var adjusted_max_prev = adjusted_max;
        while (!done) {
          adjusted_max_prev = adjusted_max;
          adjusted_max = (adjusted_max * 1.15);
          done = adjusted_max > width;
        }
        adjusted_max = adjusted_max_prev;
      }
      adjusted_factor = (adjusted_max / max_value);
    }
    //console.log('getAdjustedChartWidthFactor(' + width + ', ' + max_value + ') : ' + adjusted_factor);
    return adjusted_factor;
  }

  function getAdjustedChartWidth(factor, value) {
    var adjusted_value = parseFloat(value);
    if (factor && value) {
      adjusted_value = (factor * value)
    }
    //console.log('getAdjustedChartWidth(' + factor + ', ' + value + ') : ' + adjusted_value);
    return adjusted_value;
  }

  function initUI() {

    if (chart_bar_ui_id) {
      $(chart_bar_ui_id).empty();
    }

    if (chart_bar_legend_ui_id) {
      $(chart_bar_legend_ui_id).empty();
    }

    if (chart_donut_ui_id) {
      $(chart_donut_ui_id).empty();
    }
  }

  function revalidateUIEntityEmail() {
    if (_donut_chart_entity_email) {
      _donut_chart_entity_email.redraw();
    }
  }

  function getAllEntityAsString() {

    var entity_set_as_string = '';
    var keys = _.keys(_entity_selected_org);
    if (keys) {
      _.each(keys, function(key) {
        entity_set_as_string += key + ' ';
      });
    }

    keys = _.keys(_entity_selected_person);
    if (keys) {
      _.each(keys, function(key) {
        entity_set_as_string += key + ' ';
      });
    }

    keys = _.keys(_entity_selected_location);
    if (keys) {
      _.each(keys, function(key) {
        entity_set_as_string += key + ' ';
      });
    }

    keys = _.keys(_entity_selected_misc);
    if (keys) {
      _.each(keys, function(key) {
        entity_set_as_string += key + ' ';
      });
    }

    entity_set_as_string = entity_set_as_string.trim().replace(/\s/g, ',');

    return entity_set_as_string;
  }

  function appendEntity(url_path, entity_text_list) {

    if (url_path) {

      if (url_path.endsWith('/')) {
        url_path = url_path.substring(0, url_path.length - 1);
      }

      var entity_set_as_string = '';
      if (entity_text_list) { // match cache against argument entity-text
        _.each(entity_text_list, function (entity_text) {
          _.each(response_element_list, function (entity_obj) {
            if (entity_obj.entity_text == entity_text) {
              if (entity_obj.entity_type == 'organization') {
                var encoded_entity_text = encodeURIComponent( entity_text );
                entity_set_as_string += encoded_entity_text + ' ';
              }
            }
          });
        });
      }
      else { // match local entity-select of type organization
        var keys = _.keys(_entity_selected_org);
        if (keys) {
          _.each(keys, function (key) {
            entity_set_as_string += key + ' ';
          });
        }
      }

      if(entity_set_as_string) {
        entity_set_as_string = entity_set_as_string.trim().replace(/\s/g, ',');
        var key = 'entities.body_entities.entity_organization'
        if (url_path.indexOf('?') > 0) {
          url_path += '&' + key + '=' + entity_set_as_string;
        }
        else {
          url_path += '?' + key + '=' + entity_set_as_string;
        }
      }

      entity_set_as_string = '';
      if (entity_text_list) { // match cache against argument entity-text
        _.each(entity_text_list, function (entity_text) {
          _.each(response_element_list, function (entity_obj) {
            if (entity_obj.entity_text == entity_text) {
              if (entity_obj.entity_type == 'person') {
                var encoded_entity_text = encodeURIComponent( entity_text );
                entity_set_as_string += encoded_entity_text + ' ';
              }
            }
          });
        });
      }
      else { // match local entity-select of type person
        keys = _.keys(_entity_selected_person);
        if (keys) {
          _.each(keys, function (key) {
            entity_set_as_string += key + ' ';
          });
        }
      }

      if(entity_set_as_string) {
        entity_set_as_string = entity_set_as_string.trim().replace(/\s/g, ',');
        var key = 'entities.body_entities.entity_person'
        if (url_path.indexOf('?') > 0) {
          url_path += '&' + key + '=' + entity_set_as_string;
        }
        else {
          url_path += '?' + key + '=' + entity_set_as_string;
        }
      }

      entity_set_as_string = '';
      if (entity_text_list) { // match cache against argument entity-text
        _.each(entity_text_list, function (entity_text) {
          _.each(response_element_list, function (entity_obj) {
            if (entity_obj.entity_text == entity_text) {
              if (entity_obj.entity_type == 'location') {
                var encoded_entity_text = encodeURIComponent( entity_text );
                entity_set_as_string += encoded_entity_text + ' ';
              }
            }
          });
        });
      }
      else { // match local entity-select of type location
        keys = _.keys(_entity_selected_location);
        if (keys) {
          _.each(keys, function (key) {
            entity_set_as_string += key + ' ';
          });
        }
      }

      if(entity_set_as_string) {
        entity_set_as_string = entity_set_as_string.trim().replace(/\s/g, ',');
        var key = 'entities.body_entities.entity_location'
        if (url_path.indexOf('?') > 0) {
          url_path += '&' + key + '=' + entity_set_as_string;
        }
        else {
          url_path += '?' + key + '=' + entity_set_as_string;
        }
      }

      entity_set_as_string = '';
      if (entity_text_list) { // match cache against argument entity-text
        _.each(entity_text_list, function (entity_text) {
          _.each(response_element_list, function (entity_obj) {
            if (entity_obj.entity_text == entity_text) {
              if (entity_obj.entity_type == 'misc') {
                var encoded_entity_text = encodeURIComponent( entity_text );
                entity_set_as_string += encoded_entity_text + ' ';
              }
            }
          });
        });
      }
      else { // match local entity-select of type miscellaneous
        keys = _.keys(_entity_selected_misc);
        if (keys) {
          _.each(keys, function (key) {
            entity_set_as_string += key + ' ';
          });
        }
      }

      if(entity_set_as_string) {
        entity_set_as_string = entity_set_as_string.trim().replace(/\s/g, ',');
        var key = 'entities.body_entities.entity_misc'
        if (url_path.indexOf('?') > 0) {
          url_path += '&' + key + '=' + entity_set_as_string;
        }
        else {
          url_path += '?' + key + '=' + entity_set_as_string;
        }
      }

    }

    return url_path;

  }

  function _putEntity(key, value) {
    if (key && value) {
      key = encodeURIComponent(key);

      if (value === 'organization') {
        var index = _.size(_entity_selected_org);
        var object = {"key": key, "index": index, "type": value}
        _entity_selected_org[key] = object;
      }
      else if (value === 'person') {
        var index = _.size(_entity_selected_person);
        var object = {"key": key, "index": index, "type": value}
        _entity_selected_person[key] = object;
      }
      else if (value === 'location') {
        var index = _.size(_entity_selected_location);
        var object = {"key": key, "index": index, "type": value}
        _entity_selected_location[key] = object;
      }
      else if (value === 'misc') {
        var index = _.size(_entity_selected_misc);
        var object = {"key": key, "index": index, "type": value}
        _entity_selected_misc[key] = object;
      }
      else {
        var index = _.size(_entity_selected_misc);
        var object = {"key": key, "index": index, "type": value}
        _entity_selected_misc[key] = object;
      }
    }
  }

  function _removeEntity(key) {
    if (key) {
      delete _entity_selected_org[key];
      delete _entity_selected_person[key];
      delete _entity_selected_location[key];
      delete _entity_selected_misc[key];
    }
  }

  function setEntitySelected(key, type, is_selected, refresh_ui) {
    if (key && type) {

      if (is_selected) {
        _putEntity(key, type);
      }
      else {
        _removeEntity(key)
      }

      console.log('selected-entities-org : ' + JSON.stringify(_entity_selected_org, null, 2));
      console.log('selected-entities-person : ' + JSON.stringify(_entity_selected_person, null, 2));
      console.log('selected-entities-location : ' + JSON.stringify(_entity_selected_location, null, 2));
      console.log('selected-entities-misc : ' + JSON.stringify(_entity_selected_misc, null, 2));

      if (refresh_ui) {
        //trigger refresh

      }
    }
  }

  function clearAllEntitySelected() {
    _entity_selected_org = {};
    _entity_selected_person = {};
    _entity_selected_location = {};
    _entity_selected_misc = {};
  }

  function onEntityClicked(key, type) {
    console.log( 'onEntityClicked( ' + key + ', ' + type + ' )' );

    clearAllEntitySelected();

    setEntitySelected(key, type, true, false);

    // query email documents by entity
    newman_email_entity_search_request.requestService();

    // display email-tab
    newman_graph_email.displayUITab();
  }


  return {
    'initUI' : initUI,
    'getMinRequestCount' : getMinRequestCount,
    'getMaxRequestCount' : getMaxRequestCount,
    'getUIDisplayCount' : getUIDisplayCount,
    'getEntityTypeColor' : getEntityTypeColor,
    'requestEmailEntityList' : requestEmailEntityList,
    'onRequestEmailEntityList' : onRequestEmailEntityList,
    'requestEmailEntitySearch' : requestEmailEntitySearch,
    'revalidateUIEntityEmail' : revalidateUIEntityEmail,
    'appendEntity' : appendEntity,
    'setEntitySelected' : setEntitySelected,
    'onEntityClicked' : onEntityClicked,
    'getAllEntityAsString' : getAllEntityAsString,
    'getTopEmailEntityList' : getTopEmailEntityList
  }

}());

/**
 * email-entities-related service container
 * @type {{requestService, getResponse}}
 */
var newman_top_email_entity_list_request = (function () {

  var _service_url = 'entity/top';
  var request_response_map = {};

  function getServiceURLBase() {
    return _service_url;
  }

  function getServiceURL(top_count) {

    if (top_count) {
      var service_url = newman_data_source.appendDataSource(_service_url + '/' + encodeURIComponent(top_count));
      service_url = newman_datetime_range.appendDatetimeRange(service_url);
      service_url = newman_aggregate_filter.appendAggregateFilter(service_url);
      service_url = newman_search_parameter.appendURLQuery(service_url);
      service_url += '&size=' + top_count;

      return service_url;
    }
  }

  function requestService(top_count) {
    var min_count = newman_top_email_entity.getMinRequestCount();
    var max_count = newman_top_email_entity.getMaxRequestCount();
    if (top_count) {
      if (top_count < min_count || top_count > max_count) {
        top_count = max_count;
      }
    }
    else {
      top_count = max_count;
    }
    console.log('newman_service_email_entities.requestService(' + top_count + ')');

    var data_source_string = newman_data_source.getAllSelectedAsString();
    var service_url = getServiceURL( top_count );

    var prev_response = request_response_map[ service_url ];
    if (prev_response && prev_response.entities) {
      console.log("service-response already exists for '" + service_url + "'");

      newman_top_email_entity.onRequestEmailEntityList( prev_response.entities );
    }
    else {

      app_status_indicator.setStatusConnecting( true );

      $.get(service_url).then(function (response) {
      //$.when($.get( service_url )).done(function (response) {

        setResponse(service_url, data_source_string, response);

        app_status_indicator.setStatusConnecting( false );
      });
    }
  }

  function setResponse( service_url, data_source_string, response ) {
    if (response) {

      var mapped_response = mapResponse( service_url, data_source_string, response );

      if (mapped_response && mapped_response.entities) {
        newman_top_email_entity.onRequestEmailEntityList( mapped_response.entities );
      }
    }
  }

  function mapResponse( service_url, data_source_string, response ) {
    if (response) {

      var response_element_list = _.map(response.entities, function (value_list, index) {

        var element_obj = _.object(['entity_index', 'entity_type', 'entity_text', 'entity_ref_count'], value_list);

        return element_obj;
      });

      var response_obj = { "entities" : response_element_list, "data_source" : data_source_string };
      //console.log('mapResponse(' + service_url + ')\n' + JSON.stringify(response_obj, null, 2));

      request_response_map[ service_url ] = response_obj;

      return response_obj;
    }
    return response;
  }

  function getTopEmailEntityByDataSource( dataset_id ) {
    var object_matched, url;
    if (dataset_id) {
      _.each(request_response_map, function(response_element, key) {
        if (dataset_id == response_element.data_source) {
          object_matched = response_element.entities;
          url = key;
        }
      });
      console.log('getTopEmailAccountByDataSource(' + dataset_id + ')\n\ttarget_url : ' + url);
    }
    return object_matched;
  }

  function onRequestTopEmailEntityDataSource( dataset_id, response, url ) {
    if (dataset_id && url && response) {
      var mapped_response = mapResponse( url, dataset_id, response);
    }
  }

  function requestTopEmailEntityByDataSource( data_id_list_string ) {
    if (data_id_list_string) {
      var top_count = newman_top_email_entity.getMaxRequestCount();

      console.log('requestAllEmailByRank(' + data_id_list_string + ')');

      var dataset_id_list = data_id_list_string.split(',');
      var dataset_url_map = {};

      // create url for each individual data-source
      _.each(dataset_id_list, function (dataset_id, index) {
        var service_url = newman_data_source.appendDataSource(_service_url + '/' + encodeURIComponent(top_count), dataset_id);
        service_url = newman_datetime_range.appendDatetimeRange(service_url);
        service_url = newman_aggregate_filter.appendAggregateFilter(service_url);
        service_url = newman_search_parameter.appendURLQuery(service_url);
        service_url += '&size=' + top_count;

        dataset_url_map[dataset_id] = service_url;
      });

      // create url for each individual the union of data-sources
      var service_url = newman_data_source.appendDataSource(_service_url + '/' + encodeURIComponent(top_count), data_id_list_string);
      service_url = newman_datetime_range.appendDatetimeRange(service_url);
      service_url = newman_aggregate_filter.appendAggregateFilter(service_url);
      service_url = newman_search_parameter.appendURLQuery(service_url);
      service_url += '&size=' + top_count;
      dataset_url_map[data_id_list_string] = service_url;

      console.log('url_map :\n' + JSON.stringify(dataset_url_map, null, 2));

      // initiate request for each url
      _.each(dataset_url_map, function (service_url, key) {

        var prev_response = request_response_map[ service_url ];
        if (prev_response) {
          console.log('service-response already exists for "' + service_url + '"');

        }
        else {

          app_status_indicator.setStatusConnecting( true );

          $.get(service_url).then(function (response) {

            onRequestTopEmailEntityDataSource(key, response, service_url);

            app_status_indicator.setStatusConnecting( false );
          });
        }
      });

    }

  }

  function clearAllResponse() {
    if (_.isEmpty(request_response_map)) {
      return;
    }

    // deep-delete
    var key_list = _.keys(request_response_map);
    _.each(key_list, function(key) {
      delete request_response_map[ key ];
    });
    request_response_map = {};

  }


  return {
    'getServiceURLBase' : getServiceURLBase,
    'getServiceURL' : getServiceURL,
    'requestService' : requestService,
    'requestTopEmailEntityByDataSource' : requestTopEmailEntityByDataSource,
    'onRequestTopEmailEntityDataSource' : onRequestTopEmailEntityDataSource,
    'getTopEmailEntityByDataSource' : getTopEmailEntityByDataSource,
    'clearAllResponse' : clearAllResponse
  }

}());

/**
 * entity-based-email-search service response container
 * @type {{requestService, getResponse}}
 */
var newman_email_entity_search_request = (function () {

  var _service_url = 'entity/entity';
  var _response;

  function getServiceURLBase() {
    return _service_url;
  }

  function getServiceURL( entity_text_list, dataset_list_string ) {

    // append data-source
    var service_url = newman_data_source.appendDataSource(_service_url, dataset_list_string);

    // append datetime range
    service_url = newman_datetime_range.appendDatetimeRange(service_url);

    // append entity-text and entity-types
    service_url = newman_top_email_entity.appendEntity(service_url, entity_text_list);

    // append query-string
    service_url = newman_search_parameter.appendURLQuery(service_url);

    return service_url;
  }

  function requestService( parent_search_uid, clear_sibling, dataset_list_string, entity_text_list, callback ) {

    console.log('newman_email_entity_search_request.requestService(...)');
    var service_url = getServiceURL( entity_text_list, dataset_list_string );
    $.get( service_url ).then(function (search_response) {
      setResponse( search_response );

      var field = 'entity';

      var entity_set_string = '';
      _.each(entity_text_list, function (item) {
        entity_set_string += encodeURIComponent(item) + ' ';
      });
      entity_set_string = entity_set_string.trim().replace(/\s/g, ',');
      var search_text = decodeURIComponent( entity_set_string );

      var load_on_response = false;
      var url_path = service_url;

      if (callback) { // pass search-response to caller

        // search-result-parameter: field, search_text, load_on_response, url_path, search_response, parent_search_uid, clear_sibling
        callback.onRequestEmailEntitySearch( field, search_text, load_on_response, url_path,  search_response, parent_search_uid, clear_sibling );

      }
      else { // default, load search-response

        newman_graph_email.updateUIGraphView( search_response );

        // add to work-flow-history
        var entity_set_string = newman_top_email_entity.getAllEntityAsString();
        entity_set_string = truncateString(entity_set_string, app_display_config.getLabelLengthMax());
        app_nav_history.appendHist(service_url, field, entity_set_string);
      }

    });
  }

  function setResponse( response ) {
    if (response) {
      _response = response;
      //console.log('\tfiltered_response: ' + JSON.stringify(_response, null, 2));
    }
  }

  function getResponse() {
    return _response;
  }

  return {
    'getServiceURLBase' : getServiceURLBase,
    'getServiceURL' : getServiceURL,
    'requestService' : requestService,
    'getResponse' : getResponse,
    'setResponse' : setResponse
  }

}());