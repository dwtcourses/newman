/**
 * Created by jlee on 1/14/16.
 */


/**
 * email-graph related container
 */
var newman_email_starred = (function () {

  var ui_id;



  function initUI() {

  }

  /**
   * update from service the UI for email response
   * @param response
   */
  function updateUIEmailTable(search_response, documentViewEnabled) {

    //validate search-response
    var filtered_response = validateResponseSearch( search_response );
    //console.log('filtered_response:\n' + JSON.stringify(filtered_response, null, 2));

    if( filtered_response.rows && filtered_response.rows.length > 0 ) {

      var id_array = [];
      _.each(filtered_response.rows, function (element) {
        var doc_id = element.num;
        if (doc_id) {
          id_array.push(doc_id);
        }
      });

      if (id_array.length > 0) {
        newman_graph_email.updateUIGraphView(search_response, documentViewEnabled, id_array);

      }
      else {
        console.warn('No expected email-document-ID found!');
      }
    }
    else {
      console.warn('No expected email-document found!');
    }
  }

  function displayUITab() {

    $('#tab-list li:eq(0) a').tab('show');

  }

  return {
    'initUI' : initUI,
    'updateUIEmailTable' : updateUIEmailTable,
    'displayUITab' : displayUITab
  }

}());


/**
 * service container toggle-email-as-starred
 * @type {{requestService, getResponse}}
 */
var newman_email_starred_request_toggle = (function () {

  var _service_url = 'email/set_email_starred';
  var _response;

  function getServiceURLBase() {
    return _service_url;
  }

  function getServiceURL(email_id, enabled) {
    console.log('newman_email_starred_request_toggle.getServiceURL(' + email_id + ', ' + enabled + ')');

    var service_url = _service_url + '/' + encodeURIComponent(email_id.trim());
    var is_starred = 'true';
    if (enabled === true) {
      is_starred = 'true';
    }
    else {
      is_starred = 'false';
    }

    if (service_url.indexOf('?') > 0) {
      service_url += '&starred=' + is_starred;
    }
    else {
      service_url += '?starred=' + is_starred;
    }

    service_url = newman_data_source.appendDataSource(service_url);
    service_url = newman_datetime_range.appendDatetimeRange(service_url);

    return service_url;

  }

  function requestService(email_address, enabled) {

    console.log('newman_email_starred_request_toggle.requestService()');
    var service_url = getServiceURL(email_address, enabled);
    $.get( service_url ).then(function (response) {
      setResponse( response );
      // no response handling needed
    });
  }

  function setResponse( response ) {
    if (response) {

      _response = response;
      console.log('\tresponse: ' + JSON.stringify(_response, null, 2));
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


/**
 * service container all-starred-email-to-be-exported
 * @type {{requestService, getResponse}}
 */
var newman_email_starred_request_export = (function () {

  var _service_url = 'email/export_all_starred';
  var _response;

  function getServiceURLBase() {
    return _service_url;
  }

  function getServiceURL() {
    console.log('newman_email_starred_request_export.getServiceURL()');

    var service_url = _service_url;
    service_url = newman_data_source.appendDataSource(service_url);
    service_url = newman_datetime_range.appendDatetimeRange(service_url);

    return service_url;

  }

  function requestService() {

    console.log('newman_email_starred_request_export.requestService()');
    var service_url = getServiceURL();

    $.ajax({
      url: service_url,
      type: "GET",
      headers:{'Content-Type':'application/x-gzip','X-Requested-With':'XMLHttpRequest'},
      dataType: "binary",
      processData: false,
      success: function(response) {
        window.location = service_url;

        console.log('response :\n' + JSON.stringify(response, null, 2));

        //TODO: download pop-up not working; needs re-work
        $('#export_download_link a').attr('href', 'export.tar.gz');
        $('#export_link_spin').hide();
        $('#export_download_link').show();

      },
      error: function(xhr, ajaxOptions, thrownError) {
        alert('Failed to download!');

        $('#export_modal').modal('hide');

      }
    });

  }

  return {
    'getServiceURLBase' : getServiceURLBase,
    'getServiceURL' : getServiceURL,
    'requestService' : requestService
  }

}());

/**
 * service container all-starred-email-search
 * @type {{requestService, getResponse}}
 */
var newman_email_starred_request_all = (function () {

  var _service_url = 'email/search_all_starred';
  var _response;

  function getServiceURLBase() {
    return _service_url;
  }

  function getServiceURL() {
    console.log('newman_email_starred_request_all.getServiceURL()');

      var service_url = _service_url;
      service_url = newman_data_source.appendDataSource(service_url);
      service_url = newman_datetime_range.appendDatetimeRange(service_url);

      return service_url;
  }

  function requestService() {

    console.log('newman_email_starred_request_all.requestService()');
    var service_url = getServiceURL();
    $.get( service_url ).then(function (response) {
      setResponse( response );
      newman_email_starred.updateUIEmailTable( response, false );
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

/**
 *
 * @description. jQuery ajax transport to handle binary data type requests.
 *
 */
// use this transport for "binary" data type
$.ajaxTransport("+binary", function(options, originalOptions, jqXHR){
  // check for conditions and support for blob / arraybuffer response type
  if (window.FormData && ((options.dataType && (options.dataType == 'binary')) ||
                          (options.data && ((window.ArrayBuffer && options.data instanceof ArrayBuffer) ||
                          (window.Blob && options.data instanceof Blob))))) {
    return {
      // create new XMLHttpRequest
      send: function(headers, callback){
        // setup all variables
        var xhr = new XMLHttpRequest(),
          url = options.url,
          type = options.type,
          async = options.async || true,
        // blob or arraybuffer. Default is blob
          dataType = options.responseType || "blob",
          data = options.data || null,
          username = options.username || null,
          password = options.password || null;

        xhr.addEventListener('load', function(){
          var data = {};
          data[options.dataType] = xhr.response;
          // make callback and send data
          callback(xhr.status, xhr.statusText, data, xhr.getAllResponseHeaders());
        });

        xhr.open(type, url, async, username, password);

        // setup custom headers
        for (var i in headers ) {
          xhr.setRequestHeader(i, headers[i] );
        }

        xhr.responseType = dataType;
        xhr.send(data);
      },
      abort: function(){
        jqXHR.abort();
      }
    };
  }
});