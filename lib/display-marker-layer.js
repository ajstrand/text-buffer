(function() {
  var CompositeDisposable, DisplayMarker, DisplayMarkerLayer, Emitter, Point, Range, ref;

  ref = require('event-kit'), Emitter = ref.Emitter, CompositeDisposable = ref.CompositeDisposable;

  DisplayMarker = require('./display-marker');

  Range = require('./range');

  Point = require('./point');

  module.exports = DisplayMarkerLayer = (function() {
    function DisplayMarkerLayer(displayLayer, bufferMarkerLayer, ownsBufferMarkerLayer) {
      this.displayLayer = displayLayer;
      this.bufferMarkerLayer = bufferMarkerLayer;
      this.ownsBufferMarkerLayer = ownsBufferMarkerLayer;
      this.id = this.bufferMarkerLayer.id;
      this.bufferMarkerLayer.displayMarkerLayers.add(this);
      this.markersById = {};
      this.destroyed = false;
      this.emitter = new Emitter;
      this.subscriptions = new CompositeDisposable;
      this.markersWithDestroyListeners = new Set;
      this.subscriptions.add(this.bufferMarkerLayer.onDidUpdate(this.emitDidUpdate.bind(this)));
    }


    /*
    Section: Lifecycle
     */

    DisplayMarkerLayer.prototype.destroy = function() {
      if (this.destroyed) {
        return;
      }
      this.destroyed = true;
      if (this.ownsBufferMarkerLayer) {
        this.clear();
      }
      this.subscriptions.dispose();
      this.bufferMarkerLayer.displayMarkerLayers["delete"](this);
      if (this.ownsBufferMarkerLayer) {
        this.bufferMarkerLayer.destroy();
      }
      this.displayLayer.didDestroyMarkerLayer(this.id);
      this.emitter.emit('did-destroy');
      return this.emitter.clear();
    };

    DisplayMarkerLayer.prototype.clear = function() {
      return this.bufferMarkerLayer.clear();
    };

    DisplayMarkerLayer.prototype.didClearBufferMarkerLayer = function() {
      this.markersWithDestroyListeners.forEach(function(marker) {
        return marker.didDestroyBufferMarker();
      });
      return this.markersById = {};
    };

    DisplayMarkerLayer.prototype.isDestroyed = function() {
      return this.destroyed;
    };


    /*
    Section: Event Subscription
     */

    DisplayMarkerLayer.prototype.onDidDestroy = function(callback) {
      return this.emitter.on('did-destroy', callback);
    };

    DisplayMarkerLayer.prototype.onDidUpdate = function(callback) {
      return this.emitter.on('did-update', callback);
    };

    DisplayMarkerLayer.prototype.onDidCreateMarker = function(callback) {
      return this.bufferMarkerLayer.onDidCreateMarker((function(_this) {
        return function(bufferMarker) {
          return callback(_this.getMarker(bufferMarker.id));
        };
      })(this));
    };


    /*
    Section: Marker creation
     */

    DisplayMarkerLayer.prototype.markScreenRange = function(screenRange, options) {
      var bufferRange;
      screenRange = Range.fromObject(screenRange);
      bufferRange = this.displayLayer.translateScreenRange(screenRange, options);
      return this.getMarker(this.bufferMarkerLayer.markRange(bufferRange, options).id);
    };

    DisplayMarkerLayer.prototype.markScreenPosition = function(screenPosition, options) {
      var bufferPosition;
      screenPosition = Point.fromObject(screenPosition);
      bufferPosition = this.displayLayer.translateScreenPosition(screenPosition, options);
      return this.getMarker(this.bufferMarkerLayer.markPosition(bufferPosition, options).id);
    };

    DisplayMarkerLayer.prototype.markBufferRange = function(bufferRange, options) {
      bufferRange = Range.fromObject(bufferRange);
      return this.getMarker(this.bufferMarkerLayer.markRange(bufferRange, options).id);
    };

    DisplayMarkerLayer.prototype.markBufferPosition = function(bufferPosition, options) {
      return this.getMarker(this.bufferMarkerLayer.markPosition(Point.fromObject(bufferPosition), options).id);
    };


    /*
    Section: Querying
     */

    DisplayMarkerLayer.prototype.getMarker = function(id) {
      var bufferMarker, displayMarker;
      if (displayMarker = this.markersById[id]) {
        return displayMarker;
      } else if (bufferMarker = this.bufferMarkerLayer.getMarker(id)) {
        return this.markersById[id] = new DisplayMarker(this, bufferMarker);
      }
    };

    DisplayMarkerLayer.prototype.getMarkers = function() {
      return this.bufferMarkerLayer.getMarkers().map((function(_this) {
        return function(arg) {
          var id;
          id = arg.id;
          return _this.getMarker(id);
        };
      })(this));
    };

    DisplayMarkerLayer.prototype.getMarkerCount = function() {
      return this.bufferMarkerLayer.getMarkerCount();
    };

    DisplayMarkerLayer.prototype.findMarkers = function(params) {
      params = this.translateToBufferMarkerLayerFindParams(params);
      return this.bufferMarkerLayer.findMarkers(params).map((function(_this) {
        return function(stringMarker) {
          return _this.getMarker(stringMarker.id);
        };
      })(this));
    };


    /*
    Section: Private
     */

    DisplayMarkerLayer.prototype.translateBufferPosition = function(bufferPosition, options) {
      return this.displayLayer.translateBufferPosition(bufferPosition, options);
    };

    DisplayMarkerLayer.prototype.translateBufferRange = function(bufferRange, options) {
      return this.displayLayer.translateBufferRange(bufferRange, options);
    };

    DisplayMarkerLayer.prototype.translateScreenPosition = function(screenPosition, options) {
      return this.displayLayer.translateScreenPosition(screenPosition, options);
    };

    DisplayMarkerLayer.prototype.translateScreenRange = function(screenRange, options) {
      return this.displayLayer.translateScreenRange(screenRange, options);
    };

    DisplayMarkerLayer.prototype.emitDidUpdate = function() {
      return this.emitter.emit('did-update');
    };

    DisplayMarkerLayer.prototype.notifyObserversIfMarkerScreenPositionsChanged = function() {
      var i, len, marker, ref1;
      ref1 = this.getMarkers();
      for (i = 0, len = ref1.length; i < len; i++) {
        marker = ref1[i];
        marker.notifyObservers(false);
      }
    };

    DisplayMarkerLayer.prototype.destroyMarker = function(id) {
      var marker;
      if (marker = this.markersById[id]) {
        return marker.didDestroyBufferMarker();
      }
    };

    DisplayMarkerLayer.prototype.didDestroyMarker = function(marker) {
      this.markersWithDestroyListeners["delete"](marker);
      return delete this.markersById[marker.id];
    };

    DisplayMarkerLayer.prototype.translateToBufferMarkerLayerFindParams = function(params) {
      var bufferMarkerLayerFindParams, endBufferPosition, endScreenRow, key, startBufferPosition, startScreenRow, value;
      bufferMarkerLayerFindParams = {};
      for (key in params) {
        value = params[key];
        switch (key) {
          case 'startBufferPosition':
            key = 'startPosition';
            break;
          case 'endBufferPosition':
            key = 'endPosition';
            break;
          case 'startScreenPosition':
            key = 'startPosition';
            value = this.displayLayer.translateScreenPosition(value);
            break;
          case 'endScreenPosition':
            key = 'endPosition';
            value = this.displayLayer.translateScreenPosition(value);
            break;
          case 'startsInBufferRange':
            key = 'startsInRange';
            break;
          case 'endsInBufferRange':
            key = 'endsInRange';
            break;
          case 'startsInScreenRange':
            key = 'startsInRange';
            value = this.displayLayer.translateScreenRange(value);
            break;
          case 'endsInScreenRange':
            key = 'endsInRange';
            value = this.displayLayer.translateScreenRange(value);
            break;
          case 'startBufferRow':
            key = 'startRow';
            break;
          case 'endBufferRow':
            key = 'endRow';
            break;
          case 'startScreenRow':
            key = 'startsInRange';
            startBufferPosition = this.displayLayer.translateScreenPosition(Point(value, 0));
            endBufferPosition = this.displayLayer.translateScreenPosition(Point(value, 2e308));
            value = Range(startBufferPosition, endBufferPosition);
            break;
          case 'endScreenRow':
            key = 'endsInRange';
            startBufferPosition = this.displayLayer.translateScreenPosition(Point(value, 0));
            endBufferPosition = this.displayLayer.translateScreenPosition(Point(value, 2e308));
            value = Range(startBufferPosition, endBufferPosition);
            break;
          case 'intersectsBufferRowRange':
            key = 'intersectsRowRange';
            break;
          case 'intersectsScreenRowRange':
            key = 'intersectsRange';
            startScreenRow = value[0], endScreenRow = value[1];
            startBufferPosition = this.displayLayer.translateScreenPosition(Point(startScreenRow, 0));
            endBufferPosition = this.displayLayer.translateScreenPosition(Point(endScreenRow, 2e308));
            value = Range(startBufferPosition, endBufferPosition);
            break;
          case 'containsBufferRange':
            key = 'containsRange';
            break;
          case 'containsScreenRange':
            key = 'containsRange';
            value = this.displayLayer.translateScreenRange(value);
            break;
          case 'containsBufferPosition':
            key = 'containsPosition';
            break;
          case 'containsScreenPosition':
            key = 'containsPosition';
            value = this.displayLayer.translateScreenPosition(value);
            break;
          case 'containedInBufferRange':
            key = 'containedInRange';
            break;
          case 'containedInScreenRange':
            key = 'containedInRange';
            value = this.displayLayer.translateScreenRange(value);
            break;
          case 'intersectsBufferRange':
            key = 'intersectsRange';
            break;
          case 'intersectsScreenRange':
            key = 'intersectsRange';
            value = this.displayLayer.translateScreenRange(value);
        }
        bufferMarkerLayerFindParams[key] = value;
      }
      return bufferMarkerLayerFindParams;
    };

    return DisplayMarkerLayer;

  })();

}).call(this);
