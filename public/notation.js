// GLOBAL VARIABLES ----------------------------------------------------- //
// CLOCK ------------------------- >
var framect = 0;
var delta = 0.0;
var lastFrameTimeMs = 0.0;
// TIMING ------------------------ >
var FRAMERATE = 60.0;
var MSPERFRAME = 1000.0 / FRAMERATE;
var timeAdjustment = 0;
// SVG --------------------------- >
var SVG_NS = "http://www.w3.org/2000/svg";
var SVG_XLINK = 'http://www.w3.org/1999/xlink';
// NOTATION SVGs ----------------- >
var notationUrlSz = []; //[url, w, h]
var availableNotes = [
  "/notation/quintuplet_accent_76_46.svg",
  "/notation/eight_accent_2ndPartial_27_34.svg",
  "/notation/eight_accent_1stPartial_27_34.svg",
  "/notation/triplet_accent_1st_partial_45_45.svg",
  "/notation/quarter_accent_12_35.svg"
];
// DIAL NOTATION OBJECT ----------- >
var dial;
var tickDegs = [];
var eventData;
// BUTTONS ------------------------ >
var activateButtons = false;
var activateStartBtn = false;
var activatePauseStopBtn = false;
var activateSaveBtn = false;
// START ------------------------ >
var startPieceGate = true;
var pauseState = 0;
var pausedTime = 0;
var animationGo = true;
// SOCKET IO ------------------------ >
// var socket = io();
var socket = io('https://protected-lowlands-00467.herokuapp.com:5000', {path: '/socket.io'});
// Socket.io receiver to start piece on reicept of 'startpiecebroadcast' msg
socket.on('startpiecebroadcast', function(data) {
  if (startPieceGate) {
    startPieceGate = false;
    activateStartBtn = false;
    activatePauseStopBtn = true;
    startPiece();
    startBtn.className = 'btn btn-1_inactive';
  }
});
// SOCKET MSG: CREATE EVENTS BROADCAST FROM SERVER
socket.on('createEventsBroadcast', function(data) {
  dial.generatePiece(data.eventdata); // run generate Piece function in dial notation object
  eventData = data.eventdata; // generated event data
  if (startPieceGate) {
    activateStartBtn = true;
    activateSaveBtn = true;
    startBtn.className = 'btn btn-1';
    saveBtn.className = 'btn btn-1';
  }
});

socket.on('pauseBroadcast', function(data) {
  pauseState = data.pauseState;
  if (pauseState == 0) { //unpaused
    timeAdjustment = data.pauseTime + timeAdjustment;
    var btnDOM = document.getElementById('pauseBtn');
    btnDOM.innerText = 'Pause';
    btnDOM.className = 'btn btn-1';
    var ctrlPanelDOM = document.getElementById('ctrlPanel');
    ctrlPanelDOM.smallify();
    animationGo = true;
    requestAnimationFrame(animationEngine);
  } else if (pauseState == 1) { //paused
    pausedTime = data.pauseTime
    animationGo = false;
    var btnDOM = document.getElementById('pauseBtn');
    btnDOM.innerText = 'Un-Pause';
    btnDOM.className = 'btn btn-2';
  }
});

// SOCKET MSG: load events pauseBroadcast
socket.on('loadPieceBroadcast', function(data) {
  dial.generatePiece(data.eventsArray); // run generate Piece function in dial notation object
  eventData = data.eventsArray; // generated event data
  if (startPieceGate) {
    activateStartBtn = true;
    activateSaveBtn = true;
    startBtn.className = 'btn btn-1';
    saveBtn.className = 'btn btn-1';
  }
});
// START TIME SYNC ENGINE ---------------- >
var ts = timesync.create({
  //server: 'https://safe-plateau-48516.herokuapp.com/timesync',
  // server: 'https://salty-scrubland-85563.herokuapp.com/timesync',
  server: 'https://protected-lowlands-00467.herokuapp.com/timesync',
  // server: '/timesync',
  interval: 1000
});
////////////////////////////////////////////////////////////////////////////

// FUNCTION: startPiece -------------------------------------------------------------- //
function startPiece() {
  startClockSync();
  requestAnimationFrame(animationEngine); //change to gate
}
// FUNCTION: startClockSync -------------------------------------------------------------- //
function startClockSync() {
  var t_now = new Date(ts.now());
  lastFrameTimeMs = t_now.getTime();
}

// INIT -------------------------------------------------------------- //
function init() {
  // 02: MAKE CONTROL PANEL ---------------- >
  mkCtrlPanel("ctrlPanel", 130, 400, "Control Panel");
  // 03: GET NOTATION SIZES ---------------- >
  availableNotes.forEach(function(it, ix) {
    getImageOgSize(it, function(size, url) {
      var sizeArr = [];
      sizeArr.push(url);
      sizeArr.push(size.w);
      sizeArr.push(size.h);
      notationUrlSz.push(sizeArr);
      // Activate Buttons after last image has been processed
      if (ix == (availableNotes.length - 1)) {
        activateButtons = true;
      }
    });
  });
  // MODIFY GENERATE NOTATION FUNCTION FOR NOTES LOOKUP
  // 04: GENERATE STATIC ELEMENTS ---------------- >
  dial = mkDialNO(0, 500, 500, 50, 5, 12, 100);
}
////////////////////////////////////////////////////////////////////////////


// FUNCTION GET ORIGINAL IMAGE SIZE ------------------------------------- //
function getImageOgSize(url, callback) {
  var newImg = new Image();
  newImg.src = url;
  newImg.onload = function() {
    var imgSize = {
      w: this.naturalWidth,
      h: this.naturalHeight
    };
    if (typeof callback !== "undefined") callback(imgSize, url);
  };
}
////////////////////////////////////////////////////////////////////////////


function generateNotation() {
  var notationSet = [];
  for (var i = 0; i < tickDegs.length; i++) {
    var useNotation = probability(0.42);
    if (useNotation) {
      var notesArrIxSet = [0, 1, 2, 3, 4];
      var notesArrIx = chooseWeighted(notesArrIxSet, [0.13, 0.13, 0.13, 0.13, 0.48]);
      var notesArr = notationUrlSz[notesArrIx]; // Send this through Node
      notationSet.push(notesArr);
    } else { //not all ticks have a notation box. push 0 to empty ones
      notationSet.push(-1);
    }
  }
  return notationSet;
}


// FUNCTION MAKE DIAL NOTATION OBJECT ------------------------------------- //
function mkDialNO(ix, w, h, x, y, numTicks, bpm) {
  var cx = w / 2;
  var cy = h / 2;
  var innerRadius = 70;
  var noteSpace = 65;
  var midRadius = innerRadius + noteSpace;
  var defaultStrokeWidth = 4;
  var outerRadius = w / 2;
  var currDeg = 120;
  var lastDeg = currDeg;
  var tickBlinkTimes = []; //timer to blink ticks
  var notes = [];
  var noteBoxes = [];
  for (var i = 0; i < numTicks; i++) tickBlinkTimes.push(0); //populate w/0s
  // Calculate number of degrees per frame
  var beatsPerSec = bpm / 60;
  var beatsPerFrame = beatsPerSec / FRAMERATE;
  var degreesPerBeat = 360 / numTicks;
  var degreesPerFrame = degreesPerBeat * beatsPerFrame;
  // Create OBJECT
  var notationObj = {}; //returned object to add all elements and data
  // Generate ID
  var id = 'dial' + ix;
  notationObj['id'] = id;
  // Make SVG Canvas ------------- >
  var canvasID = id + 'canvas';
  var svgCanvas = mkSVGcanvas(canvasID, w, h); //see func below
  notationObj['canvas'] = svgCanvas;
  // Make jsPanel ----------------- >
  var panelID = id + 'panel';
  var panel = mkPanel(panelID, svgCanvas, x, y, w, h, 'Pulse Cycle 002'); //see func below
  notationObj['panel'] = panel;
  // STATIC ELEMENTS ----------------------------- >
  //// Ring -------------------------------- //
  var ring = document.createElementNS(SVG_NS, "circle");
  ring.setAttributeNS(null, "cx", cx);
  ring.setAttributeNS(null, "cy", cy);
  ring.setAttributeNS(null, "r", innerRadius);
  ring.setAttributeNS(null, "stroke", "rgb(153, 255, 0)");
  ring.setAttributeNS(null, "stroke-width", defaultStrokeWidth);
  ring.setAttributeNS(null, "fill", "none");
  var ringID = id + 'ring';
  ring.setAttributeNS(null, "id", ringID);
  svgCanvas.appendChild(ring);
  notationObj['ring'] = ring;
  //// Dial ------------------------------- //
  var dialWidth = 2;
  var dial = document.createElementNS(SVG_NS, "line");
  var ogx1 = outerRadius * Math.cos(rads(120)) + cx;
  var ogy1 = outerRadius * Math.sin(rads(120)) + cy;
  dial.setAttributeNS(null, "x1", ogx1);
  dial.setAttributeNS(null, "y1", ogy1);
  dial.setAttributeNS(null, "x2", cx);
  dial.setAttributeNS(null, "y2", cy);
  dial.setAttributeNS(null, "stroke", "rgb(153,255,0)");
  dial.setAttributeNS(null, "stroke-width", dialWidth);
  var dialID = id + 'dial';
  dial.setAttributeNS(null, "id", dialID);
  svgCanvas.appendChild(dial);
  notationObj['dial'] = dial;
  //// Ticks ------------------------------- //
  var ticks = [];
  var tickRadius = innerRadius - (defaultStrokeWidth / 2) - 3; // ticks offset from dial 3px like a watch
  var tickLength = 11;
  var tickWidth = 2;
  for (var i = 0; i < numTicks; i++) {
    var tickDeg = -90 + (degreesPerBeat * i); //-90 is 12 o'clock
    tickDegs.push(tickDeg); //store degrees for collision detection later
    var x1 = midRadius * Math.cos(rads(tickDeg)) + cx;
    var y1 = midRadius * Math.sin(rads(tickDeg)) + cy;
    var x2 = (tickRadius - tickLength) * Math.cos(rads(tickDeg)) + cx;
    var y2 = (tickRadius - tickLength) * Math.sin(rads(tickDeg)) + cy;
    var tick = document.createElementNS(SVG_NS, "line");
    tick.setAttributeNS(null, "x1", x1);
    tick.setAttributeNS(null, "y1", y1);
    tick.setAttributeNS(null, "x2", x2);
    tick.setAttributeNS(null, "y2", y2);
    tick.setAttributeNS(null, "stroke", "rgb(255,128,0)");
    tick.setAttributeNS(null, "stroke-width", tickWidth);
    var tickID = id + 'tick' + i;
    tick.setAttributeNS(null, "id", tickID);
    svgCanvas.appendChild(tick);
    ticks.push(tick);
  }
  notationObj['ticks'] = ticks;
  // GENERATE PIECE  ------------------- //
  var rectSize = 36;
  var generatePieceFunc = function(notesArr) {
    //Remove Previous Notation
    notes.forEach(function(it, ix) {
      if (it != 0) {
        it.parentNode.removeChild(it);
      }
    });
    noteBoxes.forEach(function(it, ix) {
      if (it != 0) {
        it.parentNode.removeChild(it);
      }
    });
    notes = [];
    noteBoxes = [];
    // Generate New Notation and Boxes
    for (var i = 0; i < notesArr.length; i++) {
      if (notesArr[i] != -1) {
        var url = notesArr[i][0];
        var svgW = notesArr[i][1];
        var svgH = notesArr[i][2];
        var deg = notesArr[i][3];
        var notationSVG = document.createElementNS(SVG_NS, "image");
        notationSVG.setAttributeNS(SVG_XLINK, 'xlink:href', url);
        var rectx = midRadius * Math.cos(rads(tickDegs[i])) + cx - (svgW / 2);
        var recty = midRadius * Math.sin(rads(tickDegs[i])) + cy - (svgH / 2);
        notationSVG.setAttributeNS(null, "transform", "translate( " + rectx.toString() + "," + recty.toString() + ")");
        var notationSVGID = id + 'notationSVG' + i;
        notationSVG.setAttributeNS(null, "id", notationSVGID);
        notationSVG.setAttributeNS(null, 'visibility', 'visible');
        notes.push(notationSVG);
        var noteBox = document.createElementNS(SVG_NS, "rect");
        noteBox.setAttributeNS(null, "width", svgW + 6);
        noteBox.setAttributeNS(null, "height", svgH + 6);
        var boxX = rectx - 3;
        var boxY = recty - 3;
        noteBox.setAttributeNS(null, "transform", "translate( " + boxX.toString() + "," + boxY.toString() + ")");
        var noteBoxID = id + 'noteBox' + i;
        noteBox.setAttributeNS(null, "id", canvasID);
        noteBox.setAttributeNS(null, 'visibility', 'visible');
        noteBox.setAttributeNS(null, "fill", "white");
        noteBoxes.push(noteBox);
        svgCanvas.appendChild(noteBox);
        svgCanvas.appendChild(notationSVG);
      } else { //not all ticks have a notation box. push 0 to empty ones
        notes.push(0);
        noteBoxes.push(0);
      }
    }
  }
  notationObj['generatePiece'] = generatePieceFunc;
  // ANIMATION -------------------------------------- >
  var tickBlinkDur = 150;
  var growTickLen = 5; //expand tick stroke-width by this amount
  // ---------------------------------------------------------- >
  var animateFunc = function(time) {
    // Animate Dial
    currDeg += degreesPerFrame; //advance degreesPerFrame
    var newDialX1 = outerRadius * Math.cos(rads(currDeg)) + cx;
    var newDialY1 = outerRadius * Math.sin(rads(currDeg)) + cy;
    dial.setAttributeNS(null, "x1", newDialX1);
    dial.setAttributeNS(null, "y1", newDialY1);
    // Animate Ticks
    var currDegMod = ((currDeg + 90) % 360) - 90; //do this hack so you are not mod negative number
    tickDegs.forEach(function(it, ix) {
      if (ix == 0) { //for tick at 12o'clock to accomodate for positive to negative transition
        if (lastDeg > 0 && currDegMod < 0) { //if last frame was pos and this frame neg
          ticks[ix].setAttributeNS(null, "stroke", "rgb(255,0,0)");
          ticks[ix].setAttributeNS(null, "stroke-width", tickWidth + growTickLen);
          tickBlinkTimes[ix] = (time + tickBlinkDur); //set blink timer time for this tick
          // Note Boxes
          if (noteBoxes[ix] != 0) {
            noteBoxes[ix].setAttributeNS(null, "stroke", "rgb(255,0,0)");
            noteBoxes[ix].setAttributeNS(null, "stroke-width", 4);
          }
        }
      } else {
        if (currDeg < 270) { // different color for count in
          if (it > lastDeg && it <= currDegMod) { //all other ticks looking to see that last frame dial was before this tick and in this frame dial is equal or past this tick
            ticks[ix].setAttributeNS(null, "stroke", "rgb(153,255,0)");
            ticks[ix].setAttributeNS(null, "stroke-width", tickWidth + growTickLen);
            tickBlinkTimes[ix] = (time + tickBlinkDur); //set blink timer time for this tick
          }
        } else {
          if (it > lastDeg && it <= currDegMod) { //all other ticks looking to see that last frame dial was before this tick and in this frame dial is equal or past this tick
            ticks[ix].setAttributeNS(null, "stroke", "rgb(255,0,0)");
            ticks[ix].setAttributeNS(null, "stroke-width", tickWidth + growTickLen);
            tickBlinkTimes[ix] = (time + tickBlinkDur); //set blink timer time for this tick
            // Note Boxes
            if (noteBoxes[ix] != 0) {
              noteBoxes[ix].setAttributeNS(null, "stroke", "rgb(255,0,0)");
              noteBoxes[ix].setAttributeNS(null, "stroke-width", 4);
            }
          }
        }
      }
    });
    lastDeg = currDegMod;
    // Tick blink timer
    tickBlinkTimes.forEach(function(it, ix) {
      if (time > it) {
        ticks[ix].setAttributeNS(null, "stroke", "rgb(255,128,0)");
        ticks[ix].setAttributeNS(null, "stroke-width", tickWidth);
        // Note Boxes
        if (noteBoxes[ix] != 0) {
          noteBoxes[ix].setAttributeNS(null, "stroke", "white");
          noteBoxes[ix].setAttributeNS(null, "stroke-width", 0);
        }
      }
    })
  }
  // ------------------------------------------------------------- >
  notationObj['animateFunc'] = animateFunc;
  return notationObj;
}
////////////////////////////////////////////////////////////////////////////


// MAKE SVG CANVAS ------------------------------------------------------ //
function mkSVGcanvas(canvasID, w, h) {
  var tsvgCanvas = document.createElementNS(SVG_NS, "svg");
  tsvgCanvas.setAttributeNS(null, "width", w);
  tsvgCanvas.setAttributeNS(null, "height", h);
  tsvgCanvas.setAttributeNS(null, "id", canvasID);
  tsvgCanvas.style.backgroundColor = "black";
  return tsvgCanvas;
}
////////////////////////////////////////////////////////////////////////////


// MAKE JSPANEL ------------------------------------------------------ //
function mkPanel(panelid, svgcanvas, posx, posy, w, h, title) {
  var tpanel;
  jsPanel.create({
    position: 'center-top',
    id: panelid,
    contentSize: w.toString() + " " + h.toString(),
    header: 'auto-show-hide',
    headerControls: {
      minimize: 'remove',
      // smallify: 'remove',
      maximize: 'remove',
      close: 'remove'
    },
    contentOverflow: 'hidden',
    headerTitle: title,
    theme: "light",
    content: svgcanvas, //svg canvas lives here
    resizeit: {
      aspectRatio: 'content',
      resize: function(panel, paneldata, e) {}
    },
    callback: function() {
      tpanel = this;
    }
  });
  return tpanel;
}
////////////////////////////////////////////////////////////////////////////

// MAKE CONTROL PANEL ------------------------------------------------------ //
function mkCtrlPanel(panelid, w, h, title) {
  var tpanel;
  //Container Div
  var ctrlPanelDiv = document.createElement("div");
  ctrlPanelDiv.style.width = w.toString() + "px";
  ctrlPanelDiv.style.height = h.toString() + "px";
  ctrlPanelDiv.setAttribute("id", "ctrlPanel");
  ctrlPanelDiv.style.backgroundColor = "black";
  var btnW = w - 18;
  //Generate Piece
  var generateNotationButton = document.createElement("BUTTON");
  generateNotationButton.id = 'generateNotationButton';
  generateNotationButton.innerText = 'Generate Piece';
  generateNotationButton.className = 'btn btn-1';
  generateNotationButton.style.width = btnW.toString() + "px";
  generateNotationButton.addEventListener("click", function() {
    if (activateButtons) {
      var newNotation = generateNotation();
      socket.emit('createEvents', {
        eventdata: newNotation
      });
    }
  });
  ctrlPanelDiv.appendChild(generateNotationButton);
  //Load Piece
  var loadPieceBtn = document.createElement("BUTTON");
  loadPieceBtn.id = 'loadPieceBtn';
  loadPieceBtn.innerText = 'Load Piece';
  loadPieceBtn.className = 'btn btn-1';
  loadPieceBtn.style.width = btnW.toString() + "px";
  loadPieceBtn.addEventListener("click", function() {
    if (activateButtons) {
      // UPLOAD pitchChanges from file -------------------------------------- //
      //open file manager and select file name
      // basically create an input element and 'click' it (see below)
      var input = document.createElement('input');
      input.type = 'file';
      input.onchange = e => {
        var file = e.target.files[0];
        var fileName = file.name;
        //fetch contents of file; parce the string and send to server as array
        fetch("/savedEvents/" + fileName)
          .then(response => response.text())
          .then(text => {
            var eventsArray = [];
            var t1 = text.split(";");
            for (var i = 0; i < t1.length; i++) {
              if (t1[i] == -1) {
                eventsArray.push(-1);
              } else {
                t2 = [];
                var temparr = t1[i].split(',');
                t2.push(temparr[0]);
                t2.push(parseInt(temparr[1]));
                t2.push(parseInt(temparr[2]));
                eventsArray.push(t2);
              }
            }
            socket.emit('loadPiece', {
              eventsArray: eventsArray
            });
          });
      }
      input.click();
    }
  });
  ctrlPanelDiv.appendChild(loadPieceBtn);
  // START
  var startBtn = document.createElement("BUTTON");
  startBtn.id = 'startBtn';
  startBtn.innerText = 'START';
  startBtn.className = 'btn btn-1_inactive';
  startBtn.style.width = btnW.toString() + "px";
  startBtn.style.height = "60px";
  startBtn.addEventListener("click", function() {
    if (activateButtons) {
      if (activateStartBtn) {
        socket.emit('startpiece', {});
        tpanel.smallify();
        pauseBtn.className = 'btn btn-1';
        stopBtn.className = 'btn btn-1';
      }
    }
  });
  ctrlPanelDiv.appendChild(startBtn);
  // PAUSE
  var pauseBtn = document.createElement("BUTTON");
  pauseBtn.id = 'pauseBtn';
  pauseBtn.innerText = 'Pause';
  pauseBtn.className = 'btn btn-1_inactive';
  pauseBtn.style.width = btnW.toString() + "px";
  pauseBtn.addEventListener("click", function() {
    if (activateButtons) {
      if (activatePauseStopBtn) {
        pauseState = (pauseState + 1) % 2;
        var t_now = new Date(ts.now());
        var pauseTime = t_now.getTime()
        if (pauseState == 1) { //Paused
          socket.emit('pause', {
            pauseState: pauseState,
            pauseTime: pauseTime
          });
        } else if (pauseState == 0) { //unpaused
          var globalPauseTime = pauseTime - pausedTime;
          socket.emit('pause', {
            pauseState: pauseState,
            pauseTime: globalPauseTime
          });
        }
      }
    }
  });
  ctrlPanelDiv.appendChild(pauseBtn);
  // STOP
  var stopBtn = document.createElement("BUTTON");
  stopBtn.id = 'stopBtn';
  stopBtn.innerText = 'Stop';
  stopBtn.className = 'btn btn-1_inactive';
  stopBtn.style.width = btnW.toString() + "px";
  stopBtn.addEventListener("click", function() {
    if (activateButtons) {
      if (activatePauseStopBtn) {
        location.reload();
      }
    }
  });
  ctrlPanelDiv.appendChild(stopBtn);
  // SAVE EVENTS
  var saveBtn = document.createElement("BUTTON");
  saveBtn.id = 'saveBtn';
  saveBtn.innerText = 'Save';
  saveBtn.className = 'btn btn-1_inactive';
  saveBtn.style.width = btnW.toString() + "px";
  saveBtn.addEventListener("click", function() {
    if (activateButtons) {
      if (activateSaveBtn) {
        var eventDataStr = "";
        for (var i = 0; i < eventData.length; i++) { // format as string to store in a file
          if (i != (eventData.length - 1)) { //if it is not the last one
            if (eventData[i] == -1) {
              eventDataStr = eventDataStr + "-1;"; //not every tick has notation; if not = -1
            } else {
              for (var j = 0; j < eventData[i].length; j++) {
                if (j == (eventData[i].length - 1)) {
                  eventDataStr = eventDataStr + eventData[i][j].toString() + ";";
                } else {
                  eventDataStr = eventDataStr + eventData[i][j].toString() + ",";
                }
              }
            }
          } else { //last one don't include semicolon
            if (eventData[i] == -1) {
              eventDataStr = eventDataStr + "-1";
            } else {
              for (var j = 0; j < eventData[i].length; j++) {
                if (j == (eventData[i].length - 1)) {
                  eventDataStr = eventDataStr + eventData[i][j].toString();
                } else {
                  eventDataStr = eventDataStr + eventData[i][j].toString() + ",";
                }
              }
            }

          }
        }
        var t_now = new Date(ts.now());
        var month = t_now.getMonth() + 1;
        var eventsFileName = "pulseCycle001_" + t_now.getFullYear() + "_" + month + "_" + t_now.getUTCDate() + "_" + t_now.getHours() + "-" + t_now.getMinutes();
        downloadStrToHD(eventDataStr, eventsFileName, 'text/plain');
      }
    }
  });
  ctrlPanelDiv.appendChild(saveBtn);

  // jsPanel
  jsPanel.create({
    position: 'left-top',
    id: panelid,
    contentSize: w.toString() + " " + h.toString(),
    header: 'auto-show-hide',
    headerControls: {
      minimize: 'remove',
      // smallify: 'remove',
      maximize: 'remove',
      close: 'remove'
    },
    contentOverflow: 'hidden',
    headerTitle: '<small>' + title + '</small>',
    theme: "light",
    content: ctrlPanelDiv,
    resizeit: {
      aspectRatio: 'content',
      resize: function(panel, paneldata, e) {}
    },
    dragit: {
      disable: true
    },
    callback: function() {
      tpanel = this;
    }
  });
  return tpanel;
}
////////////////////////////////////////////////////////////////////////////


// UPDATE --------------------------------------------------------------- //
function update(aMSPERFRAME, currTimeMS) {
  framect++;
  dial.animateFunc(currTimeMS); //call the animate function from the notation object
}
////////////////////////////////////////////////////////////////////////////


// DRAW ----------------------------------------------------------------- //
function draw() {}
////////////////////////////////////////////////////////////////////////////


// ANIMATION ENGINE ----------------------------------------------------- //
function animationEngine(timestamp) {
  var t_now = new Date(ts.now());
  t_lt = t_now.getTime() - timeAdjustment;
  delta += t_lt - lastFrameTimeMs;
  lastFrameTimeMs = t_lt;
  while (delta >= MSPERFRAME) {
    update(MSPERFRAME, t_lt);
    draw();
    delta -= MSPERFRAME;
  }
  if (animationGo) requestAnimationFrame(animationEngine);
}
////////////////////////////////////////////////////////////////////////////
