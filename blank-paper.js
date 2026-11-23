/* Editable ink and the local archive for the blank-paper screen. */
var BlankPaper = (function(){
  'use strict';

  var WIDTH = 1588; // Two A4 widths at the CSS reference density.
  var EXTENSION = 1123;
  var tools = {pen:4, pencil:2.5, marker:18, eraser:28};
  var bounds = new WeakMap();
  var paths = new WeakMap();
  var opening;

  function database(){
    if (!opening) opening = new Promise(function(resolve, reject){
      var request = indexedDB.open('mathTrainer-paper', 1);
      request.onupgradeneeded = function(){
        request.result.createObjectStore('sheets', {keyPath:'id'})
          .createIndex('recent', ['profileId', 'updatedAt', 'id']);
      };
      request.onsuccess = function(){
        var db = request.result;
        db.onversionchange = function(){ db.close(); opening = null; };
        resolve(db);
      };
      request.onerror = function(){ reject(request.error); };
    }).catch(function(error){
      opening = null;
      throw error;
    });
    return opening;
  }

  function transact(mode, operation){
    return database().then(function(db){
      return new Promise(function(resolve, reject){
        var tx = db.transaction('sheets', mode);
        var result;
        tx.oncomplete = function(){ resolve(result); };
        tx.onabort = function(){ reject(tx.error || new Error('Speicherkonflikt')); };
        operation(tx.objectStore('sheets'), function(value){ result = value; });
      });
    });
  }

  function recent(profileId, keysOnly){
    return transact('readonly', function(store, result){
      var range = IDBKeyRange.bound([profileId], [profileId, []]);
      var index = store.index('recent');
      var request = keysOnly ? index.openKeyCursor(range, 'prev') : index.openCursor(range, 'prev');
      var sheets = [];
      request.onsuccess = function(){
        var cursor = request.result;
        if (!cursor){ result(sheets); return; }
        sheets.push(keysOnly ? {id:cursor.primaryKey, updatedAt:cursor.key[1]} : cursor.value);
        cursor.continue();
      };
    });
  }

  function load(id){
    return transact('readonly', function(store, result){
      var request = store.get(id);
      request.onsuccess = function(){ result(request.result); };
    });
  }

  function save(sheet){
    return transact('readwrite', function(store){
      var request = store.get(sheet.id);
      request.onsuccess = function(){
        var previous = request.result;
        if ((previous ? previous.revision : 0) !== sheet.revision - 1){
          store.transaction.abort();
          return;
        }
        store.put(sheet);
      };
    });
  }

  function newId(){
    return Array.from(crypto.getRandomValues(new Uint32Array(4))).map(function(value){
      return value.toString(16).padStart(8, '0');
    }).join('');
  }

  function validStroke(stroke){
    return stroke && Object.prototype.hasOwnProperty.call(tools, stroke.tool) &&
      typeof stroke.color === 'string' && /^#[0-9a-f]{6}$/i.test(stroke.color) &&
      [0.65, 1, 1.65].indexOf(stroke.size) !== -1 &&
      Array.isArray(stroke.points) && stroke.points.length > 0 &&
      stroke.points.every(function(point){
        return Array.isArray(point) && point.length === 3 && point.every(Number.isFinite) &&
          point[0] >= 0 && point[0] <= WIDTH && point[1] >= 0 && point[1] <= Number.MAX_SAFE_INTEGER &&
          point[2] >= 0 && point[2] <= 1;
      });
  }

  function readBackup(data, profileId){
    if (!data || data.format !== 'mathTrainer-paper' || data.version !== 1 || !Array.isArray(data.sheets)){
      throw new Error('Ungültiges Dateiformat');
    }
    return data.sheets.map(function(sheet){
      if (!sheet || !Number.isSafeInteger(sheet.updatedAt) || sheet.updatedAt < 0 ||
          sheet.updatedAt > 8640000000000000 || !Array.isArray(sheet.strokes) || !sheet.strokes.every(validStroke)){
        throw new Error('Ungültiges Blatt');
      }
      return {id:newId(), profileId:profileId, updatedAt:sheet.updatedAt, revision:1, strokes:sheet.strokes};
    });
  }

  function download(sheets){
    var data = {format:'mathTrainer-paper', version:1, sheets:sheets.map(function(sheet){
      return {updatedAt:sheet.updatedAt, strokes:sheet.strokes};
    })};
    var url = URL.createObjectURL(new Blob([JSON.stringify(data)], {type:'application/json'}));
    var link = document.createElement('a');
    link.href = url;
    link.download = 'mathTrainer-Blaetter-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 60000);
  }

  function strokeBounds(stroke){
    if (!bounds.has(stroke)){
      var box = {left:Infinity, top:Infinity, right:0, bottom:0};
      stroke.points.forEach(function(point){
        box.left = Math.min(box.left, point[0]);
        box.top = Math.min(box.top, point[1]);
        box.right = Math.max(box.right, point[0]);
        box.bottom = Math.max(box.bottom, point[1]);
      });
      bounds.set(stroke, box);
    }
    return bounds.get(stroke);
  }

  function strokePath(stroke){
    var path = new Path2D();
    var points = stroke.points;
    var width = tools[stroke.tool] * stroke.size;
    var varying = stroke.tool === 'pen' || stroke.tool === 'pencil';

    function radius(point){ return width * (varying ? 0.35 + point[2] * 1.3 : 1) / 2; }
    function dot(point){
      var r = radius(point);
      path.moveTo(point[0] + r, point[1]);
      path.arc(point[0], point[1], r, 0, 2 * Math.PI);
      path.closePath();
    }

    if (points.length === 1){
      dot(points[0]);
    } else if (varying){
      // Join tapered segments with round points. One filled path keeps opacity even.
      points.forEach(function(point, index){
        dot(point);
        if (!index) return;
        var before = points[index - 1];
        var dx = point[0] - before[0], dy = point[1] - before[1];
        var length = Math.hypot(dx, dy);
        if (!length) return;
        var x = -dy / length, y = dx / length;
        var r = radius(point), previous = radius(before);
        path.moveTo(before[0] - x * previous, before[1] - y * previous);
        path.lineTo(point[0] - x * r, point[1] - y * r);
        path.lineTo(point[0] + x * r, point[1] + y * r);
        path.lineTo(before[0] + x * previous, before[1] + y * previous);
        path.closePath();
      });
    } else {
      path.moveTo(points[0][0], points[0][1]);
      for (var i = 1; i < points.length - 1; i++){
        var point = points[i], next = points[i + 1];
        path.quadraticCurveTo(point[0], point[1], (point[0] + next[0]) / 2, (point[1] + next[1]) / 2);
      }
      path.lineTo(points[points.length - 1][0], points[points.length - 1][1]);
    }
    return path;
  }

  function paint(ctx, stroke, live){
    var path = paths.get(stroke) || strokePath(stroke);
    if (!live) paths.set(stroke, path);
    ctx.globalAlpha = stroke.tool === 'marker' ? 0.3 : stroke.tool === 'pencil' ? 0.8 : 1;
    ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
    if (stroke.points.length === 1 || stroke.tool === 'pen' || stroke.tool === 'pencil'){
      ctx.fillStyle = stroke.color;
      ctx.fill(path);
    } else {
      ctx.strokeStyle = stroke.color;
      ctx.lineJoin = ctx.lineCap = 'round';
      ctx.lineWidth = tools[stroke.tool] * stroke.size;
      ctx.stroke(path);
    }
  }

  function create(goHome){
    function el(id){ return document.getElementById(id); }

    var archive = el('paperArchive'), editor = el('paperEditor'), list = el('paperList');
    var archiveStatus = el('paperArchiveStatus'), status = el('paperSaveStatus');
    var scroll = el('paperScroll'), surface = el('paperSurface'), canvas = el('paperCanvas');
    var ctx = canvas.getContext('2d');
    var date = new Intl.DateTimeFormat('de-DE', {dateStyle:'long', timeStyle:'medium'});
    var profileId, sheet, active, pending, dirty, redo, height, frame;
    var tool = 'pen', touches = new Map();
    var archiveRequest = 0, archiveBusy = false;

    function archiveButtons(busy){
      archiveBusy = busy;
      ['paperHome', 'paperNew', 'paperImport', 'paperExportAll'].forEach(function(id){ el(id).disabled = busy; });
      list.querySelectorAll('button').forEach(function(button){ button.disabled = busy; });
    }

    function showArchive(message, focus){
      var request = ++archiveRequest;
      editor.hidden = true;
      archive.hidden = false;
      list.textContent = '';
      archiveStatus.textContent = 'Blätter werden geladen …';
      archiveButtons(false);
      if (focus) el('paperNew').focus();
      recent(profileId, true).then(function(entries){
        if (request !== archiveRequest) return;
        archiveStatus.textContent = message || (entries.length ? '' : 'Hier erscheinen deine bearbeiteten Blätter.');
        entries.forEach(function(entry){
          var item = document.createElement('li');
          var button = document.createElement('button');
          button.type = 'button';
          button.className = 'secondary-btn';
          button.textContent = date.format(entry.updatedAt);
          button.disabled = archiveBusy;
          button.addEventListener('click', function(){
            archiveButtons(true);
            load(entry.id).then(function(result){
              if (!result || result.profileId !== profileId) throw new Error('Blatt fehlt');
              openSheet(result);
            }).catch(function(){ archiveStatus.textContent = 'Das Blatt konnte nicht geöffnet werden.'; })
              .finally(function(){ archiveButtons(false); });
          });
          item.appendChild(button);
          list.appendChild(item);
        });
      }).catch(function(){
        if (request === archiveRequest) archiveStatus.textContent = 'Der lokale Blattspeicher ist gerade nicht verfügbar.';
      });
    }

    function extend(bottom){
      if (height >= bottom + EXTENSION / 2) return;
      height = Math.ceil((bottom + EXTENSION) / EXTENSION) * EXTENSION;
      surface.style.height = height + 'px';
    }

    function render(){
      frame = 0;
      if (editor.hidden) return;
      var width = Math.min(WIDTH, scroll.clientWidth), visibleHeight = scroll.clientHeight;
      if (!width || !visibleHeight) return;
      var ratio = Math.min(window.devicePixelRatio || 1, Math.sqrt(8000000 / (width * visibleHeight)));
      var pixelWidth = Math.ceil(width * ratio), pixelHeight = Math.ceil(visibleHeight * ratio);
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight ||
          canvas.style.width !== width + 'px' || canvas.style.height !== visibleHeight + 'px'){
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
        canvas.style.width = width + 'px';
        canvas.style.height = visibleHeight + 'px';
      }
      var x = Math.max(0, scroll.scrollLeft), y = Math.max(0, scroll.scrollTop);
      extend(y + visibleHeight);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, pixelWidth, pixelHeight);
      ctx.setTransform(pixelWidth / width, 0, 0, pixelHeight / visibleHeight, -x * pixelWidth / width, -y * pixelHeight / visibleHeight);
      sheet.strokes.forEach(function(stroke){
        var box = strokeBounds(stroke);
        if (box.right + 25 >= x && box.left - 25 <= x + width &&
            box.bottom + 25 >= y && box.top - 25 <= y + visibleHeight) paint(ctx, stroke);
      });
      if (active) paint(ctx, active.stroke, true);
    }

    function redraw(){
      if (!frame) frame = requestAnimationFrame(render);
    }

    function updateHistory(){
      el('paperUndo').disabled = !sheet.strokes.length;
      el('paperRedo').disabled = !redo.length;
    }

    function openSheet(record){
      ++archiveRequest;
      sheet = record;
      pending = null;
      dirty = false;
      redo = [];
      touches.clear();
      height = 0;
      var bottom = record.strokes.reduce(function(y, stroke){ return Math.max(y, strokeBounds(stroke).bottom); }, EXTENSION);
      extend(bottom);
      surface.style.width = WIDTH + 'px';
      archive.hidden = true;
      editor.hidden = false;
      scroll.scrollTo(0, 0);
      el('paperDiscard').hidden = true;
      status.textContent = record.revision ? 'Auf diesem Gerät gespeichert' : '';
      updateHistory();
      render();
      scroll.focus({preventScroll:true});
    }

    function flush(){
      if (pending) return pending;
      if (!dirty) return Promise.resolve(true);
      var snapshot = Object.assign({}, sheet, {revision:sheet.revision + 1});
      dirty = false;
      status.textContent = 'Speichert …';
      pending = save(snapshot).then(function(){
        sheet.revision = snapshot.revision;
        pending = null;
        if (dirty) return flush();
        el('paperDiscard').hidden = true;
        status.textContent = 'Auf diesem Gerät gespeichert';
        return true;
      }).catch(function(){
        pending = null;
        dirty = true;
        el('paperDiscard').hidden = false;
        status.textContent = 'Speichern fehlgeschlagen. Sichere das Blatt als Datei.';
        return false;
      });
      return pending;
    }

    function changed(strokes){
      sheet.strokes = strokes;
      sheet.updatedAt = Date.now();
      dirty = true;
      updateHistory();
      redraw();
      flush();
    }

    function addSamples(event){
      var rect = canvas.getBoundingClientRect();
      var samples = event.getCoalescedEvents ? event.getCoalescedEvents() : [];
      if (!samples.length) samples = [event];
      var points = active.stroke.points;
      samples.forEach(function(sample){
        var x = Math.max(0, Math.min(WIDTH, sample.clientX - rect.left + scroll.scrollLeft));
        var y = Math.max(0, Math.min(height, sample.clientY - rect.top + scroll.scrollTop));
        var pressure = event.pointerType === 'pen' && sample.pressure > 0 ? sample.pressure : 0.5;
        var last = points[points.length - 1];
        if (!last || x !== last[0] || y !== last[1]) points.push([x, y, pressure]);
      });
      redraw();
    }

    function finish(event){
      if (event) touches.delete(event.pointerId);
      if (!active || (event && event.pointerId !== active.id)) return;
      if (event && event.type === 'pointerup') addSamples(event);
      var stroke = active.stroke;
      active = null;
      redo = [];
      changed(sheet.strokes.concat(stroke));
    }

    canvas.addEventListener('pointerdown', function(event){
      if (event.pointerType === 'touch'){
        touches.set(event.pointerId, active ? null : [event.clientX, event.clientY]);
        return;
      }
      if (active || event.button !== 0 || el('paperBack').disabled) return;
      event.preventDefault();
      touches.forEach(function(point, id){ touches.set(id, null); });
      canvas.setPointerCapture(event.pointerId);
      active = {id:event.pointerId, stroke:{tool:tool, color:el('paperColor').value,
        size:Number(el('paperSize').value), points:[]}};
      addSamples(event);
    });

    canvas.addEventListener('pointermove', function(event){
      if (active && event.pointerId === active.id){ addSamples(event); return; }
      var from = touches.get(event.pointerId);
      if (!from) return;
      touches.set(event.pointerId, [event.clientX, event.clientY]);
      if (active || touches.size !== 1) return;
      scroll.scrollLeft += from[0] - event.clientX;
      scroll.scrollTop += from[1] - event.clientY;
      extend(scroll.scrollTop + scroll.clientHeight);
    });

    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function(name){
      canvas.addEventListener(name, finish);
    });
    scroll.addEventListener('scroll', redraw);
    new ResizeObserver(redraw).observe(scroll);
    document.addEventListener('visibilitychange', function(){
      if (document.hidden && !editor.hidden){ finish(); flush(); }
    });

    el('paperTools').querySelectorAll('[data-paper-tool]').forEach(function(button){
      button.addEventListener('click', function(){
        tool = button.dataset.paperTool;
        el('paperTools').querySelectorAll('[data-paper-tool]').forEach(function(option){
          option.setAttribute('aria-pressed', String(option === button));
        });
      });
    });

    el('paperUndo').addEventListener('click', function(){
      var strokes = sheet.strokes.slice();
      if (!active && strokes.length){ redo.push(strokes.pop()); changed(strokes); }
    });
    el('paperRedo').addEventListener('click', function(){
      if (!active && redo.length) changed(sheet.strokes.concat(redo.pop()));
    });

    el('paperHome').addEventListener('click', function(){ ++archiveRequest; goHome(); el('openPaper').focus(); });
    el('paperNew').addEventListener('click', function(){
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function(){});
      openSheet({id:newId(), profileId:profileId, updatedAt:Date.now(), revision:0, strokes:[]});
    });
    el('paperBack').addEventListener('click', function(){
      finish();
      var button = el('paperBack');
      button.disabled = true;
      flush().then(function(saved){
        button.disabled = false;
        if (saved) showArchive('', true);
        else button.focus();
      });
    });
    el('paperDiscard').addEventListener('click', function(){
      if (!active && !pending && window.confirm('Zum Archiv zurückkehren und ungespeicherte Änderungen verwerfen?')){
        showArchive('', true);
      }
    });
    el('paperExport').addEventListener('click', function(){ finish(); download([sheet]); });
    el('paperExportAll').addEventListener('click', function(){
      archiveButtons(true);
      recent(profileId, false).then(download).catch(function(){
        archiveStatus.textContent = 'Das Archiv konnte nicht gesichert werden.';
      }).finally(function(){ archiveButtons(false); });
    });
    el('paperImport').addEventListener('click', function(){ el('paperFile').click(); });
    el('paperFile').addEventListener('change', function(event){
      var file = event.target.files[0];
      event.target.value = '';
      if (!file) return;
      archiveButtons(true);
      file.text().then(function(contents){
        var records = readBackup(JSON.parse(contents), profileId);
        return transact('readwrite', function(store){
          records.forEach(function(record){ store.add(record); });
        }).then(function(){ showArchive(records.length === 1 ? 'Ein Blatt wiederhergestellt.' : records.length + ' Blätter wiederhergestellt.', true); });
      }).catch(function(){
        archiveStatus.textContent = 'Die Datei konnte nicht importiert werden. Wähle eine Blattsicherung aus dem Mathetrainer.';
      }).finally(function(){ archiveButtons(false); });
    });

    return {open:function(id){ profileId = id; showArchive('', true); }};
  }

  return {create:create};
}());
