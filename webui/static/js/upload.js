
var RECEIVE_FILE_DROP = true;
function step1_drop(e) {
  e.preventDefault();
  e.stopPropagation();
  if (!RECEIVE_FILE_DROP) return;

  console.log(e);
  if (e.originalEvent.dataTransfer && e.originalEvent.dataTransfer.files.length==1){
    $("#selectedfile").prop("files", e.originalEvent.dataTransfer.files);
  }
}

function step1_filechanged() {
  if ($("#selectedfile").prop("files").length != 1) {
    $("#step1-error").show().text("Invalid selection. Please try again.");
    $("#step1 .upload-info").hide();
    $("#step1-fileselected").hide();
    return;
  }

  var file = $("#selectedfile").prop("files")[0];
  $(".upload-info .filename").text(file.name);
  $(".upload-info .filesize").text(file.size + " bytes");
  $(".upload-info .filetype").text(file.type);

  $("#step1-error").hide();
  $("#step1 .upload-info").show();
  $("#step1-fileselected").show();
}

function step1_go() {
  if ($("#selectedfile").prop("files").length != 1) {
    $("#step1-error").show().text("Invalid selection. Please try again.");
    $("#step1 .upload-info").hide();
    $("#step1-fileselected").hide();
    return;
  }

  var file = $("#selectedfile").prop("files")[0];
  $("#step1").fadeOut();

  $.ajax({
    method: "POST",
    url: "http://" + RELAY_HOST + "/api/new_upload/",
    headers: {
      "X-FileBounce-Filename": file.name,
      "X-FileBounce-Content-Type": file.type ? file.type : "application/octet-stream",
      "X-FileBounce-Content-Length": file.size,
      "X-FileBounce-Token": "not implemented",
    },
    dataType: "text",
    success: function(data){
      $("#downloadid").val(data);
      var dlHref = "http://" + RELAY_HOST + "/d/" + data;
      $("a#dllink").attr("href", dlHref).text(dlHref);
      $("#step2").fadeIn();
    }
  });

}

function step2_confirm() {
  $("#dl-instructions").fadeOut();
  $("#upload-trigger").fadeIn();
}

var CHUNK_SIZE = 20000; // 20 KB, arbitrary

function send_chunk(file, start, url) {
  var data = file.slice(start, start+CHUNK_SIZE);
  var reader = new FileReader();

  reader.onload = function() {
    var dataUrl = reader.result;
    var base64 = dataUrl.split(',')[1];
    $.ajax({
      method: "POST",
      url: url,
      data: base64,
      processData: false,
      success: function() {
        var new_start = start + CHUNK_SIZE;
        if (new_start > file.size) {
          return;
        }
        send_chunk(file, new_start, url);
      }
    });
  };
  reader.readAsDataURL(data);
}


function send_file_websocket(file, url) {
    var ws = new WebSocket(url);
    var offset = 0;
    var total = 0;
    var ws_send = function() {
	if (offset > file.size) {
	    ws.close();
	    return;
	}
	var data = file.slice(offset, offset + CHUNK_SIZE);
	total += data.size;
	ws.send(data);
	offset += data.size;
    }
    ws.onopen = ws_send
    ws.onmessage = function(ev) {
	if (ev.data == "OK") {
	    ws_send();
	} else {
	    console.log("Unexpected message from server: " + ev.data);
	}
    }
    ws.onerror = function(ev) {
	console.log("Error! " + ev);
    }
}

function do_upload() {
    var dlId = $("#downloadid").val();
    var file = $("#selectedfile").prop("files")[0];

    if ($("#wsToggle").prop("checked")) {
	var wsUrl = (window.location.protocol.replace("http", "ws") +
		      RELAY_HOST + "/api/upload_ws/" + dlId);
	send_file_websocket(file, wsUrl);
    } else {
	var uploadUrl = "http://" + RELAY_HOST + "/api/upload/" + dlId;
	send_chunk(file, 0, uploadUrl);
    }
}

$(document).ready(function() {
  $(document).on('dragover', function(e) {
    e.preventDefault();
    e.stopPropagation();
  });
  $(document).on('dragenter', function(e) {
    e.preventDefault();
    e.stopPropagation();
  });
  $(document).on("drop", step1_drop)


  $("#step1 .file-pick").click(function(){
    $("#selectedfile").trigger("click");
  });

  $("#selectedfile").on("change", step1_filechanged);
  $("#step1-go").click(step1_go);
  $("#step2-confirm").click(step2_confirm);
  $("#upload-trigger").click(do_upload);
});
