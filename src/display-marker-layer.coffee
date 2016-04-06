{Emitter} = require 'event-kit'
DisplayMarker = require './display-marker'
Range = require './range'
Point = require './point'

# Public: *Experimental:* A container for a related set of markers at the
# {DisplayLayer} level. Wraps an underlying {MarkerLayer} on the {TextBuffer}.
#
# This API is experimental and subject to change on any release.
module.exports =
class DisplayMarkerLayer
  constructor: (@displayLayer, @bufferMarkerLayer) ->
    {@id} = @bufferMarkerLayer
    @markersById = {}
    @emitter = new Emitter
    @bufferMarkerLayer.onDidUpdate(@emitDidUpdate.bind(this))
    @bufferMarkerLayer.onDidDestroy(@emitDidDestroy.bind(this))

  ###
  Section: Lifecycle
  ###

  # Essential: Destroy this layer.
  destroy: ->
    @bufferMarkerLayer.destroy()

  ###
  Section: Event Subscription
  ###

  # Public: Subscribe to be notified synchronously when this layer is destroyed.
  #
  # Returns a {Disposable}.
  onDidDestroy: (callback) ->
    @emitter.on('did-destroy', callback)

  # Public: Subscribe to be notified asynchronously whenever markers are
  # created, updated, or destroyed on this layer. *Prefer this method for
  # optimal performance when interacting with layers that could contain large
  # numbers of markers.*
  #
  # * `callback` A {Function} that will be called with no arguments when changes
  #   occur on this layer.
  #
  # Subscribers are notified once, asynchronously when any number of changes
  # occur in a given tick of the event loop. You should re-query the layer
  # to determine the state of markers in which you're interested in. It may
  # be counter-intuitive, but this is much more efficient than subscribing to
  # events on individual markers, which are expensive to deliver.
  #
  # Returns a {Disposable}.
  onDidUpdate: (callback) ->
    @emitter.on('did-update', callback)

  # Public: Subscribe to be notified synchronously whenever markers are created
  # on this layer. *Avoid this method for optimal performance when interacting
  # with layers that could contain large numbers of markers.*
  #
  # * `callback` A {Function} that will be called with a {TextEditorMarker}
  #   whenever a new marker is created.
  #
  # You should prefer {onDidUpdate} when synchronous notifications aren't
  # absolutely necessary.
  #
  # Returns a {Disposable}.
  onDidCreateMarker: (callback) ->
    @bufferMarkerLayer.onDidCreateMarker (bufferMarker) =>
      callback(@getMarker(bufferMarker.id))

  ###
  Section: Marker creation
  ###

  # Essential: Create a marker on this layer with the given range in screen
  # coordinates.
  #
  # See the documentation for {TextBuffer::markRange}.
  #
  # Returns a {DisplayMarker}.
  markScreenRange: (screenRange, properties) ->
    screenRange = Range.fromObject(screenRange)
    bufferRange = @displayLayer.translateScreenRange(screenRange, properties)
    @createDisplayMarker(@bufferMarkerLayer.markRange(bufferRange, properties))

  # Public: Create a marker on this layer with the given screen position and no
  # tail.
  #
  # See the documentation for {TextBuffer::markPosition}
  #
  # Returns a {DisplayMarker}.
  markScreenPosition: (screenPosition, properties) ->
    screenPosition = Point.fromObject(screenPosition)
    bufferPosition = @displayLayer.translateScreenPosition(screenPosition, properties)
    @createDisplayMarker(@bufferMarkerLayer.markPosition(bufferPosition, properties))

  # Essential: Create a marker on this layer with the given range in buffer
  # coordinates.
  #
  # See the documentation for {TextBuffer::markRange}.
  markBufferRange: (bufferRange, properties) ->
    bufferRange = Range.fromObject(bufferRange)
    @createDisplayMarker(@bufferMarkerLayer.markRange(bufferRange, properties))

  # Public: Create a marker on this layer with the given buffer position and no
  # tail.
  #
  # See the documentation for {TextBuffer::markPosition}
  markBufferPosition: (bufferPosition, properties) ->
    bufferPosition = Point.fromObject(bufferPosition)
    @createDisplayMarker(@bufferMarkerLayer.markPosition(bufferPosition, properties))

  createDisplayMarker: (bufferMarker) ->
    displayMarker = new DisplayMarker(this, bufferMarker)
    @markersById[displayMarker.id] = displayMarker
    displayMarker

  ###
  Section: Querying
  ###

  # Essential: Get an existing marker by its id.
  #
  # Returns a {DisplayMarker}.
  getMarker: (id) ->
    if displayMarker = @markersById[id]
      displayMarker
    else if bufferMarker = @bufferMarkerLayer.getMarker(id)
      @markersById[id] = new DisplayMarker(this, bufferMarker)

  # Essential: Get all markers in the layer.
  #
  # Returns an {Array} of {DisplayMarker}s.
  getMarkers: ->
    @bufferMarkerLayer.getMarkers().map ({id}) => @getMarker(id)

  # Public: Get the number of markers in the marker layer.
  #
  # Returns a {Number}.
  getMarkerCount: ->
    @bufferMarkerLayer.getMarkerCount()

  # Public: Find markers in the layer conforming to the given parameters.
  #
  # This method finds markers based on the given properties. Markers can be
  # associated with custom properties that will be compared with basic equality.
  # In addition, there are several special properties that will be compared
  # with the range of the markers rather than their properties.
  #
  # * `properties` An {Object} containing properties that each returned marker
  #   must satisfy. Markers can be associated with custom properties, which are
  #   compared with basic equality. In addition, several reserved properties
  #   can be used to filter markers based on their current range:
  #   * `startBufferPosition` Only include markers starting at this {Point} in buffer coordinates.
  #   * `endBufferPosition` Only include markers ending at this {Point} in buffer coordinates.
  #   * `startScreenPosition` Only include markers starting at this {Point} in screen coordinates.
  #   * `endScreenPosition` Only include markers ending at this {Point} in screen coordinates.
  #   * `startBufferRow` Only include markers starting at this row in buffer coordinates.
  #   * `endBufferRow` Only include markers ending at this row in buffer coordinates.
  #   * `startScreenRow` Only include markers starting at this row in screen coordinates.
  #   * `endScreenRow` Only include markers ending at this row in screen coordinates.
  #   * `intersectsBufferRowRange` Only include markers intersecting this {Array}
  #      of `[startRow, endRow]` in buffer coordinates.
  #   * `intersectsScreenRowRange` Only include markers intersecting this {Array}
  #      of `[startRow, endRow]` in screen coordinates.
  #   * `containsBufferRange` Only include markers containing this {Range} in buffer coordinates.
  #   * `containsBufferPosition` Only include markers containing this {Point} in buffer coordinates.
  #   * `containedInBufferRange` Only include markers contained in this {Range} in buffer coordinates.
  #   * `containedInScreenRange` Only include markers contained in this {Range} in screen coordinates.
  #   * `intersectsBufferRange` Only include markers intersecting this {Range} in buffer coordinates.
  #   * `intersectsScreenRange` Only include markers intersecting this {Range} in screen coordinates.
  #
  # Returns an {Array} of {DisplayMarker}s
  findMarkers: (params) ->
    params = @translateToBufferMarkerLayerFindParams(params)
    @bufferMarkerLayer.findMarkers(params).map (stringMarker) => @getMarker(stringMarker.id)

  ###
  Section: Private
  ###

  translateBufferPosition: (bufferPosition, options) ->
    @displayLayer.translateBufferPosition(bufferPosition, options)

  translateBufferRange: (bufferRange, options) ->
    @displayLayer.translateBufferRange(bufferRange, options)

  translateScreenPosition: (screenPosition, options) ->
    @displayLayer.translateScreenPosition(screenPosition, options)

  translateScreenRange: (screenRange, options) ->
    @displayLayer.translateScreenRange(screenRange, options)

  emitDidUpdate: ->
    @emitter.emit('did-update')

  emitDidDestroy: ->
    @emitter.emit('did-destroy')

  notifyObserversIfMarkerScreenPositionsChanged: ->
    for marker in @getMarkers()
      marker.notifyObservers(false)
    return

  didDestroyMarker: (marker) ->
    delete @markersById[marker.id]

  translateToBufferMarkerLayerFindParams: (params) ->
    bufferMarkerLayerFindParams = {}
    for key, value of params
      switch key
        when 'startBufferPosition'
          key = 'startPosition'
        when 'endBufferPosition'
          key = 'endPosition'
        when 'startScreenPosition'
          key = 'startPosition'
          value = @displayLayer.translateScreenPosition(value)
        when 'endScreenPosition'
          key = 'endPosition'
          value = @displayLayer.translateScreenPosition(value)
        when 'startBufferRow'
          key = 'startRow'
        when 'endBufferRow'
          key = 'endRow'
        when 'startScreenRow'
          key = 'startRow'
          value = @displayLayer.translateScreenPosition(Point(value, 0)).row
        when 'endScreenRow'
          key = 'endRow'
          value = @displayLayer.translateScreenPosition(Point(value, 0)).row
        when 'intersectsBufferRowRange'
          key = 'intersectsRowRange'
        when 'intersectsScreenRowRange'
          key = 'intersectsRowRange'
          [startScreenRow, endScreenRow] = value
          startBufferRow = @displayLayer.translateScreenPosition(Point(startScreenRow, 0)).row
          endBufferRow = @displayLayer.translateScreenPosition(Point(endScreenRow, 0)).row
          value = [startBufferRow, endBufferRow]
        when 'containsBufferRange'
          key = 'containsRange'
        when 'containsBufferPosition'
          key = 'containsPosition'
        when 'containedInBufferRange'
          key = 'containedInRange'
        when 'containedInScreenRange'
          key = 'containedInRange'
          value = @displayLayer.translateScreenRange(value)
        when 'intersectsBufferRange'
          key = 'intersectsRange'
        when 'intersectsScreenRange'
          key = 'intersectsRange'
          value = @displayLayer.translateScreenRange(value)
      bufferMarkerLayerFindParams[key] = value

    bufferMarkerLayerFindParams