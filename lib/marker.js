(function() {
  var Delegator, Emitter, Grim, Marker, OptionKeys, Point, Range, extend, isEqual, omit, pick, ref, size;

  ref = require('underscore-plus'), extend = ref.extend, isEqual = ref.isEqual, omit = ref.omit, pick = ref.pick, size = ref.size;

  Emitter = require('event-kit').Emitter;

  Delegator = require('delegato');

  Point = require('./point');

  Range = require('./range');

  Grim = require('grim');

  OptionKeys = new Set(['reversed', 'tailed', 'invalidate', 'exclusive']);

  module.exports = Marker = (function() {
    Delegator.includeInto(Marker);

    Marker.extractParams = function(inputParams) {
      var containsCustomProperties, i, key, len, outputParams, ref1;
      outputParams = {};
      containsCustomProperties = false;
      if (inputParams != null) {
        ref1 = Object.keys(inputParams);
        for (i = 0, len = ref1.length; i < len; i++) {
          key = ref1[i];
          if (OptionKeys.has(key)) {
            outputParams[key] = inputParams[key];
          } else if (key === 'clipDirection' || key === 'skipSoftWrapIndentation') {

          } else {
            containsCustomProperties = true;
            if (outputParams.properties == null) {
              outputParams.properties = {};
            }
            outputParams.properties[key] = inputParams[key];
          }
        }
      }
      if (containsCustomProperties) {
        Grim.deprecate("Assigning custom properties to a marker when creating/copying it is\ndeprecated. Please, consider storing the custom properties you need in\nsome other object in your package, keyed by the marker's id property.");
      }
      return outputParams;
    };

    Marker.delegatesMethods('containsPoint', 'containsRange', 'intersectsRow', {
      toMethod: 'getRange'
    });

    function Marker(id, layer, range, params, exclusivitySet) {
      this.id = id;
      this.layer = layer;
      if (exclusivitySet == null) {
        exclusivitySet = false;
      }
      this.tailed = params.tailed, this.reversed = params.reversed, this.valid = params.valid, this.invalidate = params.invalidate, this.exclusive = params.exclusive, this.properties = params.properties;
      this.emitter = new Emitter;
      if (this.tailed == null) {
        this.tailed = true;
      }
      if (this.reversed == null) {
        this.reversed = false;
      }
      if (this.valid == null) {
        this.valid = true;
      }
      if (this.invalidate == null) {
        this.invalidate = 'overlap';
      }
      if (this.properties == null) {
        this.properties = {};
      }
      this.hasChangeObservers = false;
      Object.freeze(this.properties);
      if (!exclusivitySet) {
        this.layer.setMarkerIsExclusive(this.id, this.isExclusive());
      }
    }


    /*
    Section: Event Subscription
     */

    Marker.prototype.onDidDestroy = function(callback) {
      this.layer.markersWithDestroyListeners.add(this);
      return this.emitter.on('did-destroy', callback);
    };

    Marker.prototype.onDidChange = function(callback) {
      if (!this.hasChangeObservers) {
        this.previousEventState = this.getSnapshot(this.getRange());
        this.hasChangeObservers = true;
        this.layer.markersWithChangeListeners.add(this);
      }
      return this.emitter.on('did-change', callback);
    };

    Marker.prototype.getRange = function() {
      return this.layer.getMarkerRange(this.id);
    };

    Marker.prototype.setRange = function(range, params) {
      if (params == null) {
        params = {};
      }
      return this.update(this.getRange(), {
        reversed: params.reversed,
        tailed: true,
        range: Range.fromObject(range, true),
        exclusive: params.exclusive
      });
    };

    Marker.prototype.getHeadPosition = function() {
      if (this.reversed) {
        return this.getStartPosition();
      } else {
        return this.getEndPosition();
      }
    };

    Marker.prototype.setHeadPosition = function(position) {
      var oldRange, params;
      position = Point.fromObject(position);
      oldRange = this.getRange();
      params = {};
      if (this.hasTail()) {
        if (this.isReversed()) {
          if (position.isLessThan(oldRange.end)) {
            params.range = new Range(position, oldRange.end);
          } else {
            params.reversed = false;
            params.range = new Range(oldRange.end, position);
          }
        } else {
          if (position.isLessThan(oldRange.start)) {
            params.reversed = true;
            params.range = new Range(position, oldRange.start);
          } else {
            params.range = new Range(oldRange.start, position);
          }
        }
      } else {
        params.range = new Range(position, position);
      }
      return this.update(oldRange, params);
    };

    Marker.prototype.getTailPosition = function() {
      if (this.reversed) {
        return this.getEndPosition();
      } else {
        return this.getStartPosition();
      }
    };

    Marker.prototype.setTailPosition = function(position) {
      var oldRange, params;
      position = Point.fromObject(position);
      oldRange = this.getRange();
      params = {
        tailed: true
      };
      if (this.reversed) {
        if (position.isLessThan(oldRange.start)) {
          params.reversed = false;
          params.range = new Range(position, oldRange.start);
        } else {
          params.range = new Range(oldRange.start, position);
        }
      } else {
        if (position.isLessThan(oldRange.end)) {
          params.range = new Range(position, oldRange.end);
        } else {
          params.reversed = true;
          params.range = new Range(oldRange.end, position);
        }
      }
      return this.update(oldRange, params);
    };

    Marker.prototype.getStartPosition = function() {
      return this.layer.getMarkerStartPosition(this.id);
    };

    Marker.prototype.getEndPosition = function() {
      return this.layer.getMarkerEndPosition(this.id);
    };

    Marker.prototype.clearTail = function() {
      var headPosition;
      headPosition = this.getHeadPosition();
      return this.update(this.getRange(), {
        tailed: false,
        reversed: false,
        range: Range(headPosition, headPosition)
      });
    };

    Marker.prototype.plantTail = function() {
      var headPosition;
      if (!this.hasTail()) {
        headPosition = this.getHeadPosition();
        return this.update(this.getRange(), {
          tailed: true,
          range: new Range(headPosition, headPosition)
        });
      }
    };

    Marker.prototype.isReversed = function() {
      return this.tailed && this.reversed;
    };

    Marker.prototype.hasTail = function() {
      return this.tailed;
    };

    Marker.prototype.isValid = function() {
      return !this.isDestroyed() && this.valid;
    };

    Marker.prototype.isDestroyed = function() {
      return !this.layer.hasMarker(this.id);
    };

    Marker.prototype.isExclusive = function() {
      if (this.exclusive != null) {
        return this.exclusive;
      } else {
        return this.getInvalidationStrategy() === 'inside' || !this.hasTail();
      }
    };

    Marker.prototype.isEqual = function(other) {
      return this.invalidate === other.invalidate && this.tailed === other.tailed && this.reversed === other.reversed && this.exclusive === other.exclusive && isEqual(this.properties, other.properties) && this.getRange().isEqual(other.getRange());
    };

    Marker.prototype.getInvalidationStrategy = function() {
      return this.invalidate;
    };

    Marker.prototype.getProperties = function() {
      return this.properties;
    };

    Marker.prototype.setProperties = function(properties) {
      return this.update(this.getRange(), {
        properties: extend({}, this.properties, properties)
      });
    };

    Marker.prototype.copy = function(options) {
      var snapshot;
      if (options == null) {
        options = {};
      }
      snapshot = this.getSnapshot();
      options = Marker.extractParams(options);
      return this.layer.createMarker(this.getRange(), extend({}, snapshot, options, {
        properties: extend({}, snapshot.properties, options.properties)
      }));
    };

    Marker.prototype.destroy = function(suppressMarkerLayerUpdateEvents) {
      var error;
      if (this.isDestroyed()) {
        return;
      }
      if (this.trackDestruction) {
        error = new Error;
        Error.captureStackTrace(error);
        this.destroyStackTrace = error.stack;
      }
      this.layer.destroyMarker(this, suppressMarkerLayerUpdateEvents);
      this.emitter.emit('did-destroy');
      return this.emitter.clear();
    };

    Marker.prototype.compare = function(other) {
      return this.layer.compareMarkers(this.id, other.id);
    };

    Marker.prototype.matchesParams = function(params) {
      var i, key, len, ref1;
      ref1 = Object.keys(params);
      for (i = 0, len = ref1.length; i < len; i++) {
        key = ref1[i];
        if (!this.matchesParam(key, params[key])) {
          return false;
        }
      }
      return true;
    };

    Marker.prototype.matchesParam = function(key, value) {
      switch (key) {
        case 'startPosition':
          return this.getStartPosition().isEqual(value);
        case 'endPosition':
          return this.getEndPosition().isEqual(value);
        case 'containsPoint':
        case 'containsPosition':
          return this.containsPoint(value);
        case 'containsRange':
          return this.containsRange(value);
        case 'startRow':
          return this.getStartPosition().row === value;
        case 'endRow':
          return this.getEndPosition().row === value;
        case 'intersectsRow':
          return this.intersectsRow(value);
        case 'invalidate':
        case 'reversed':
        case 'tailed':
          return isEqual(this[key], value);
        case 'valid':
          return this.isValid() === value;
        default:
          return isEqual(this.properties[key], value);
      }
    };

    Marker.prototype.update = function(oldRange, arg, textChanged, suppressMarkerLayerUpdateEvents) {
      var exclusive, properties, propertiesChanged, range, reversed, tailed, updated, valid, wasExclusive;
      range = arg.range, reversed = arg.reversed, tailed = arg.tailed, valid = arg.valid, exclusive = arg.exclusive, properties = arg.properties;
      if (textChanged == null) {
        textChanged = false;
      }
      if (suppressMarkerLayerUpdateEvents == null) {
        suppressMarkerLayerUpdateEvents = false;
      }
      if (this.isDestroyed()) {
        return;
      }
      oldRange = Range.fromObject(oldRange);
      if (range != null) {
        range = Range.fromObject(range);
      }
      wasExclusive = this.isExclusive();
      updated = propertiesChanged = false;
      if ((range != null) && !range.isEqual(oldRange)) {
        this.layer.setMarkerRange(this.id, range);
        updated = true;
      }
      if ((reversed != null) && reversed !== this.reversed) {
        this.reversed = reversed;
        updated = true;
      }
      if ((tailed != null) && tailed !== this.tailed) {
        this.tailed = tailed;
        updated = true;
      }
      if ((valid != null) && valid !== this.valid) {
        this.valid = valid;
        updated = true;
      }
      if ((exclusive != null) && exclusive !== this.exclusive) {
        this.exclusive = exclusive;
        updated = true;
      }
      if (wasExclusive !== this.isExclusive()) {
        this.layer.setMarkerIsExclusive(this.id, this.isExclusive());
        updated = true;
      }
      if ((properties != null) && !isEqual(properties, this.properties)) {
        this.properties = Object.freeze(properties);
        propertiesChanged = true;
        updated = true;
      }
      this.emitChangeEvent(range != null ? range : oldRange, textChanged, propertiesChanged);
      if (updated && !suppressMarkerLayerUpdateEvents) {
        this.layer.markerUpdated();
      }
      return updated;
    };

    Marker.prototype.getSnapshot = function(range, includeMarker) {
      var snapshot;
      if (includeMarker == null) {
        includeMarker = true;
      }
      snapshot = {
        range: range,
        properties: this.properties,
        reversed: this.reversed,
        tailed: this.tailed,
        valid: this.valid,
        invalidate: this.invalidate,
        exclusive: this.exclusive
      };
      if (includeMarker) {
        snapshot.marker = this;
      }
      return Object.freeze(snapshot);
    };

    Marker.prototype.toString = function() {
      return "[Marker " + this.id + ", " + (this.getRange()) + "]";
    };


    /*
    Section: Private
     */

    Marker.prototype.inspect = function() {
      return this.toString();
    };

    Marker.prototype.emitChangeEvent = function(currentRange, textChanged, propertiesChanged) {
      var newHeadPosition, newState, newTailPosition, oldHeadPosition, oldState, oldTailPosition;
      if (!this.hasChangeObservers) {
        return;
      }
      oldState = this.previousEventState;
      if (currentRange == null) {
        currentRange = this.getRange();
      }
      if (!(propertiesChanged || oldState.valid !== this.valid || oldState.tailed !== this.tailed || oldState.reversed !== this.reversed || oldState.range.compare(currentRange) !== 0)) {
        return false;
      }
      newState = this.previousEventState = this.getSnapshot(currentRange);
      if (oldState.reversed) {
        oldHeadPosition = oldState.range.start;
        oldTailPosition = oldState.range.end;
      } else {
        oldHeadPosition = oldState.range.end;
        oldTailPosition = oldState.range.start;
      }
      if (newState.reversed) {
        newHeadPosition = newState.range.start;
        newTailPosition = newState.range.end;
      } else {
        newHeadPosition = newState.range.end;
        newTailPosition = newState.range.start;
      }
      this.emitter.emit("did-change", {
        wasValid: oldState.valid,
        isValid: newState.valid,
        hadTail: oldState.tailed,
        hasTail: newState.tailed,
        oldProperties: oldState.properties,
        newProperties: newState.properties,
        oldHeadPosition: oldHeadPosition,
        newHeadPosition: newHeadPosition,
        oldTailPosition: oldTailPosition,
        newTailPosition: newTailPosition,
        textChanged: textChanged
      });
      return true;
    };

    return Marker;

  })();

}).call(this);
