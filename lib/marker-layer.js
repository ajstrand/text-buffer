(function() {
  var Emitter, Marker, MarkerIndex, MarkerLayer, Point, Range, SerializationVersion, clone, filterSet, intersectSet;

  clone = require("underscore-plus").clone;

  Emitter = require('event-kit').Emitter;

  Point = require("./point");

  Range = require("./range");

  Marker = require("./marker");

  MarkerIndex = require("superstring").MarkerIndex;

  intersectSet = require("./set-helpers").intersectSet;

  SerializationVersion = 2;

  module.exports = MarkerLayer = (function() {
    MarkerLayer.deserialize = function(delegate, state) {
      var store;
      store = new MarkerLayer(delegate, 0);
      store.deserialize(state);
      return store;
    };

    MarkerLayer.deserializeSnapshot = function(snapshot) {
      var layerId, markerId, markerSnapshot, markerSnapshots, result;
      result = {};
      for (layerId in snapshot) {
        markerSnapshots = snapshot[layerId];
        result[layerId] = {};
        for (markerId in markerSnapshots) {
          markerSnapshot = markerSnapshots[markerId];
          result[layerId][markerId] = clone(markerSnapshot);
          result[layerId][markerId].range = Range.fromObject(markerSnapshot.range);
        }
      }
      return result;
    };


    /*
    Section: Lifecycle
     */

    function MarkerLayer(delegate1, id3, options) {
      var ref, ref1, ref2;
      this.delegate = delegate1;
      this.id = id3;
      this.maintainHistory = (ref = options != null ? options.maintainHistory : void 0) != null ? ref : false;
      this.destroyInvalidatedMarkers = (ref1 = options != null ? options.destroyInvalidatedMarkers : void 0) != null ? ref1 : false;
      this.role = options != null ? options.role : void 0;
      if (this.role === "selections") {
        this.delegate.registerSelectionsMarkerLayer(this);
      }
      this.persistent = (ref2 = options != null ? options.persistent : void 0) != null ? ref2 : false;
      this.emitter = new Emitter;
      this.index = new MarkerIndex;
      this.markersById = {};
      this.markersWithChangeListeners = new Set;
      this.markersWithDestroyListeners = new Set;
      this.displayMarkerLayers = new Set;
      this.destroyed = false;
      this.emitCreateMarkerEvents = false;
    }

    MarkerLayer.prototype.copy = function() {
      var copy, marker, markerId, ref, snapshot;
      copy = this.delegate.addMarkerLayer({
        maintainHistory: this.maintainHistory,
        role: this.role
      });
      ref = this.markersById;
      for (markerId in ref) {
        marker = ref[markerId];
        snapshot = marker.getSnapshot(null);
        copy.createMarker(marker.getRange(), marker.getSnapshot());
      }
      return copy;
    };

    MarkerLayer.prototype.destroy = function() {
      if (this.destroyed) {
        return;
      }
      this.clear();
      this.delegate.markerLayerDestroyed(this);
      this.displayMarkerLayers.forEach(function(displayMarkerLayer) {
        return displayMarkerLayer.destroy();
      });
      this.displayMarkerLayers.clear();
      this.destroyed = true;
      this.emitter.emit('did-destroy');
      return this.emitter.clear();
    };

    MarkerLayer.prototype.clear = function() {
      this.markersWithDestroyListeners.forEach(function(marker) {
        return marker.destroy();
      });
      this.markersWithDestroyListeners.clear();
      this.markersById = {};
      this.index = new MarkerIndex;
      this.displayMarkerLayers.forEach(function(layer) {
        return layer.didClearBufferMarkerLayer();
      });
      return this.delegate.markersUpdated(this);
    };

    MarkerLayer.prototype.isDestroyed = function() {
      return this.destroyed;
    };

    MarkerLayer.prototype.isAlive = function() {
      return !this.destroyed;
    };


    /*
    Section: Querying
     */

    MarkerLayer.prototype.getMarker = function(id) {
      return this.markersById[id];
    };

    MarkerLayer.prototype.getMarkers = function() {
      var id, marker, ref, results;
      ref = this.markersById;
      results = [];
      for (id in ref) {
        marker = ref[id];
        results.push(marker);
      }
      return results;
    };

    MarkerLayer.prototype.getMarkerCount = function() {
      return Object.keys(this.markersById).length;
    };

    MarkerLayer.prototype.findMarkers = function(params) {
      var end, i, key, len, markerIds, position, ref, ref1, ref2, ref3, ref4, ref5, result, start, value;
      markerIds = null;
      ref = Object.keys(params);
      for (i = 0, len = ref.length; i < len; i++) {
        key = ref[i];
        value = params[key];
        switch (key) {
          case 'startPosition':
            markerIds = filterSet(markerIds, this.index.findStartingAt(Point.fromObject(value)));
            break;
          case 'endPosition':
            markerIds = filterSet(markerIds, this.index.findEndingAt(Point.fromObject(value)));
            break;
          case 'startsInRange':
            ref1 = Range.fromObject(value), start = ref1.start, end = ref1.end;
            markerIds = filterSet(markerIds, this.index.findStartingIn(start, end));
            break;
          case 'endsInRange':
            ref2 = Range.fromObject(value), start = ref2.start, end = ref2.end;
            markerIds = filterSet(markerIds, this.index.findEndingIn(start, end));
            break;
          case 'containsPoint':
          case 'containsPosition':
            position = Point.fromObject(value);
            markerIds = filterSet(markerIds, this.index.findContaining(position, position));
            break;
          case 'containsRange':
            ref3 = Range.fromObject(value), start = ref3.start, end = ref3.end;
            markerIds = filterSet(markerIds, this.index.findContaining(start, end));
            break;
          case 'intersectsRange':
            ref4 = Range.fromObject(value), start = ref4.start, end = ref4.end;
            markerIds = filterSet(markerIds, this.index.findIntersecting(start, end));
            break;
          case 'startRow':
            markerIds = filterSet(markerIds, this.index.findStartingIn(Point(value, 0), Point(value, 2e308)));
            break;
          case 'endRow':
            markerIds = filterSet(markerIds, this.index.findEndingIn(Point(value, 0), Point(value, 2e308)));
            break;
          case 'intersectsRow':
            markerIds = filterSet(markerIds, this.index.findIntersecting(Point(value, 0), Point(value, 2e308)));
            break;
          case 'intersectsRowRange':
            markerIds = filterSet(markerIds, this.index.findIntersecting(Point(value[0], 0), Point(value[1], 2e308)));
            break;
          case 'containedInRange':
            ref5 = Range.fromObject(value), start = ref5.start, end = ref5.end;
            markerIds = filterSet(markerIds, this.index.findContainedIn(start, end));
            break;
          default:
            continue;
        }
        delete params[key];
      }
      if (markerIds == null) {
        markerIds = new Set(Object.keys(this.markersById));
      }
      result = [];
      markerIds.forEach((function(_this) {
        return function(markerId) {
          var marker;
          marker = _this.markersById[markerId];
          if (!marker.matchesParams(params)) {
            return;
          }
          return result.push(marker);
        };
      })(this));
      return result.sort(function(a, b) {
        return a.compare(b);
      });
    };

    MarkerLayer.prototype.getRole = function() {
      return this.role;
    };


    /*
    Section: Marker creation
     */

    MarkerLayer.prototype.markRange = function(range, options) {
      if (options == null) {
        options = {};
      }
      return this.createMarker(this.delegate.clipRange(range), Marker.extractParams(options));
    };

    MarkerLayer.prototype.markPosition = function(position, options) {
      if (options == null) {
        options = {};
      }
      position = this.delegate.clipPosition(position);
      options = Marker.extractParams(options);
      options.tailed = false;
      return this.createMarker(this.delegate.clipRange(new Range(position, position)), options);
    };


    /*
    Section: Event subscription
     */

    MarkerLayer.prototype.onDidUpdate = function(callback) {
      return this.emitter.on('did-update', callback);
    };

    MarkerLayer.prototype.onDidCreateMarker = function(callback) {
      this.emitCreateMarkerEvents = true;
      return this.emitter.on('did-create-marker', callback);
    };

    MarkerLayer.prototype.onDidDestroy = function(callback) {
      return this.emitter.on('did-destroy', callback);
    };


    /*
    Section: Private - TextBuffer interface
     */

    MarkerLayer.prototype.splice = function(start, oldExtent, newExtent) {
      var invalidated;
      invalidated = this.index.splice(start, oldExtent, newExtent);
      return invalidated.touch.forEach((function(_this) {
        return function(id) {
          var marker, ref;
          marker = _this.markersById[id];
          if ((ref = invalidated[marker.getInvalidationStrategy()]) != null ? ref.has(id) : void 0) {
            if (_this.destroyInvalidatedMarkers) {
              return marker.destroy();
            } else {
              return marker.valid = false;
            }
          }
        };
      })(this));
    };

    MarkerLayer.prototype.restoreFromSnapshot = function(snapshots, alwaysCreate) {
      var existingMarkerIds, i, id, j, len, len1, marker, newMarker, range, results, snapshot, snapshotIds;
      if (snapshots == null) {
        return;
      }
      snapshotIds = Object.keys(snapshots);
      existingMarkerIds = Object.keys(this.markersById);
      for (i = 0, len = snapshotIds.length; i < len; i++) {
        id = snapshotIds[i];
        snapshot = snapshots[id];
        if (alwaysCreate) {
          this.createMarker(snapshot.range, snapshot, true);
          continue;
        }
        if (marker = this.markersById[id]) {
          marker.update(marker.getRange(), snapshot, true, true);
        } else {
          marker = snapshot.marker;
          if (marker) {
            this.markersById[marker.id] = marker;
            range = snapshot.range;
            this.index.insert(marker.id, range.start, range.end);
            marker.update(marker.getRange(), snapshot, true, true);
            if (this.emitCreateMarkerEvents) {
              this.emitter.emit('did-create-marker', marker);
            }
          } else {
            newMarker = this.createMarker(snapshot.range, snapshot, true);
          }
        }
      }
      results = [];
      for (j = 0, len1 = existingMarkerIds.length; j < len1; j++) {
        id = existingMarkerIds[j];
        if ((marker = this.markersById[id]) && (snapshots[id] == null)) {
          results.push(marker.destroy(true));
        } else {
          results.push(void 0);
        }
      }
      return results;
    };

    MarkerLayer.prototype.createSnapshot = function() {
      var i, id, len, marker, ranges, ref, result;
      result = {};
      ranges = this.index.dump();
      ref = Object.keys(this.markersById);
      for (i = 0, len = ref.length; i < len; i++) {
        id = ref[i];
        marker = this.markersById[id];
        result[id] = marker.getSnapshot(Range.fromObject(ranges[id]));
      }
      return result;
    };

    MarkerLayer.prototype.emitChangeEvents = function(snapshot) {
      return this.markersWithChangeListeners.forEach(function(marker) {
        var ref;
        if (!marker.isDestroyed()) {
          return marker.emitChangeEvent(snapshot != null ? (ref = snapshot[marker.id]) != null ? ref.range : void 0 : void 0, true, false);
        }
      });
    };

    MarkerLayer.prototype.serialize = function() {
      var i, id, len, marker, markersById, ranges, ref, snapshot;
      ranges = this.index.dump();
      markersById = {};
      ref = Object.keys(this.markersById);
      for (i = 0, len = ref.length; i < len; i++) {
        id = ref[i];
        marker = this.markersById[id];
        snapshot = marker.getSnapshot(Range.fromObject(ranges[id]), false);
        markersById[id] = snapshot;
      }
      return {
        id: this.id,
        maintainHistory: this.maintainHistory,
        role: this.role,
        persistent: this.persistent,
        markersById: markersById,
        version: SerializationVersion
      };
    };

    MarkerLayer.prototype.deserialize = function(state) {
      var id, markerState, range, ref;
      if (state.version !== SerializationVersion) {
        return;
      }
      this.id = state.id;
      this.maintainHistory = state.maintainHistory;
      this.role = state.role;
      if (this.role === "selections") {
        this.delegate.registerSelectionsMarkerLayer(this);
      }
      this.persistent = state.persistent;
      ref = state.markersById;
      for (id in ref) {
        markerState = ref[id];
        range = Range.fromObject(markerState.range);
        delete markerState.range;
        this.addMarker(id, range, markerState);
      }
    };


    /*
    Section: Private - Marker interface
     */

    MarkerLayer.prototype.markerUpdated = function() {
      return this.delegate.markersUpdated(this);
    };

    MarkerLayer.prototype.destroyMarker = function(marker, suppressMarkerLayerUpdateEvents) {
      if (suppressMarkerLayerUpdateEvents == null) {
        suppressMarkerLayerUpdateEvents = false;
      }
      if (this.markersById.hasOwnProperty(marker.id)) {
        delete this.markersById[marker.id];
        this.index.remove(marker.id);
        this.markersWithChangeListeners["delete"](marker);
        this.markersWithDestroyListeners["delete"](marker);
        this.displayMarkerLayers.forEach(function(displayMarkerLayer) {
          return displayMarkerLayer.destroyMarker(marker.id);
        });
        if (!suppressMarkerLayerUpdateEvents) {
          return this.delegate.markersUpdated(this);
        }
      }
    };

    MarkerLayer.prototype.hasMarker = function(id) {
      return !this.destroyed && this.index.has(id);
    };

    MarkerLayer.prototype.getMarkerRange = function(id) {
      return Range.fromObject(this.index.getRange(id));
    };

    MarkerLayer.prototype.getMarkerStartPosition = function(id) {
      return Point.fromObject(this.index.getStart(id));
    };

    MarkerLayer.prototype.getMarkerEndPosition = function(id) {
      return Point.fromObject(this.index.getEnd(id));
    };

    MarkerLayer.prototype.compareMarkers = function(id1, id2) {
      return this.index.compare(id1, id2);
    };

    MarkerLayer.prototype.setMarkerRange = function(id, range) {
      var end, ref, start;
      ref = Range.fromObject(range), start = ref.start, end = ref.end;
      start = this.delegate.clipPosition(start);
      end = this.delegate.clipPosition(end);
      this.index.remove(id);
      return this.index.insert(id, start, end);
    };

    MarkerLayer.prototype.setMarkerIsExclusive = function(id, exclusive) {
      return this.index.setExclusive(id, exclusive);
    };

    MarkerLayer.prototype.createMarker = function(range, params, suppressMarkerLayerUpdateEvents) {
      var id, marker, ref;
      if (suppressMarkerLayerUpdateEvents == null) {
        suppressMarkerLayerUpdateEvents = false;
      }
      id = this.delegate.getNextMarkerId();
      marker = this.addMarker(id, range, params);
      this.delegate.markerCreated(this, marker);
      if (!suppressMarkerLayerUpdateEvents) {
        this.delegate.markersUpdated(this);
      }
      marker.trackDestruction = (ref = this.trackDestructionInOnDidCreateMarkerCallbacks) != null ? ref : false;
      if (this.emitCreateMarkerEvents) {
        this.emitter.emit('did-create-marker', marker);
      }
      marker.trackDestruction = false;
      return marker;
    };


    /*
    Section: Internal
     */

    MarkerLayer.prototype.addMarker = function(id, range, params) {
      range = Range.fromObject(range);
      Point.assertValid(range.start);
      Point.assertValid(range.end);
      this.index.insert(id, range.start, range.end);
      return this.markersById[id] = new Marker(id, this, range, params);
    };

    MarkerLayer.prototype.emitUpdateEvent = function() {
      return this.emitter.emit('did-update');
    };

    return MarkerLayer;

  })();

  filterSet = function(set1, set2) {
    if (set1) {
      intersectSet(set1, set2);
      return set1;
    } else {
      return set2;
    }
  };

}).call(this);
