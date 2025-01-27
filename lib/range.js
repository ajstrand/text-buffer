(function() {
  var Point, Range, newlineRegex,
    slice = [].slice;

  Point = require('./point');

  newlineRegex = null;

  module.exports = Range = (function() {

    /*
    Section: Properties
     */
    Range.prototype.start = null;

    Range.prototype.end = null;


    /*
    Section: Construction
     */

    Range.fromObject = function(object, copy) {
      if (Array.isArray(object)) {
        return new this(object[0], object[1]);
      } else if (object instanceof this) {
        if (copy) {
          return object.copy();
        } else {
          return object;
        }
      } else {
        return new this(object.start, object.end);
      }
    };

    Range.fromText = function() {
      var args, endPoint, lastIndex, lines, startPoint, text;
      args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
      if (newlineRegex == null) {
        newlineRegex = require('./helpers').newlineRegex;
      }
      if (args.length > 1) {
        startPoint = Point.fromObject(args.shift());
      } else {
        startPoint = new Point(0, 0);
      }
      text = args.shift();
      endPoint = startPoint.copy();
      lines = text.split(newlineRegex);
      if (lines.length > 1) {
        lastIndex = lines.length - 1;
        endPoint.row += lastIndex;
        endPoint.column = lines[lastIndex].length;
      } else {
        endPoint.column += lines[0].length;
      }
      return new this(startPoint, endPoint);
    };

    Range.fromPointWithDelta = function(startPoint, rowDelta, columnDelta) {
      var endPoint;
      startPoint = Point.fromObject(startPoint);
      endPoint = new Point(startPoint.row + rowDelta, startPoint.column + columnDelta);
      return new this(startPoint, endPoint);
    };

    Range.fromPointWithTraversalExtent = function(startPoint, extent) {
      startPoint = Point.fromObject(startPoint);
      return new this(startPoint, startPoint.traverse(extent));
    };


    /*
    Section: Serialization and Deserialization
     */

    Range.deserialize = function(array) {
      if (Array.isArray(array)) {
        return new this(array[0], array[1]);
      } else {
        return new this();
      }
    };


    /*
    Section: Construction
     */

    function Range(pointA, pointB) {
      if (pointA == null) {
        pointA = new Point(0, 0);
      }
      if (pointB == null) {
        pointB = new Point(0, 0);
      }
      if (!(this instanceof Range)) {
        return new Range(pointA, pointB);
      }
      pointA = Point.fromObject(pointA);
      pointB = Point.fromObject(pointB);
      if (pointA.isLessThanOrEqual(pointB)) {
        this.start = pointA;
        this.end = pointB;
      } else {
        this.start = pointB;
        this.end = pointA;
      }
    }

    Range.prototype.copy = function() {
      return new this.constructor(this.start.copy(), this.end.copy());
    };

    Range.prototype.negate = function() {
      return new this.constructor(this.start.negate(), this.end.negate());
    };


    /*
    Section: Serialization and Deserialization
     */

    Range.prototype.serialize = function() {
      return [this.start.serialize(), this.end.serialize()];
    };


    /*
    Section: Range Details
     */

    Range.prototype.isEmpty = function() {
      return this.start.isEqual(this.end);
    };

    Range.prototype.isSingleLine = function() {
      return this.start.row === this.end.row;
    };

    Range.prototype.getRowCount = function() {
      return this.end.row - this.start.row + 1;
    };

    Range.prototype.getRows = function() {
      var i, ref, ref1, results;
      return (function() {
        results = [];
        for (var i = ref = this.start.row, ref1 = this.end.row; ref <= ref1 ? i <= ref1 : i >= ref1; ref <= ref1 ? i++ : i--){ results.push(i); }
        return results;
      }).apply(this);
    };


    /*
    Section: Operations
     */

    Range.prototype.freeze = function() {
      this.start.freeze();
      this.end.freeze();
      return Object.freeze(this);
    };

    Range.prototype.union = function(otherRange) {
      var end, start;
      start = this.start.isLessThan(otherRange.start) ? this.start : otherRange.start;
      end = this.end.isGreaterThan(otherRange.end) ? this.end : otherRange.end;
      return new this.constructor(start, end);
    };

    Range.prototype.translate = function(startDelta, endDelta) {
      if (endDelta == null) {
        endDelta = startDelta;
      }
      return new this.constructor(this.start.translate(startDelta), this.end.translate(endDelta));
    };

    Range.prototype.traverse = function(delta) {
      return new this.constructor(this.start.traverse(delta), this.end.traverse(delta));
    };


    /*
    Section: Comparison
     */

    Range.prototype.compare = function(other) {
      var value;
      other = this.constructor.fromObject(other);
      if (value = this.start.compare(other.start)) {
        return value;
      } else {
        return other.end.compare(this.end);
      }
    };

    Range.prototype.isEqual = function(other) {
      if (other == null) {
        return false;
      }
      other = this.constructor.fromObject(other);
      return other.start.isEqual(this.start) && other.end.isEqual(this.end);
    };

    Range.prototype.coversSameRows = function(other) {
      return this.start.row === other.start.row && this.end.row === other.end.row;
    };

    Range.prototype.intersectsWith = function(otherRange, exclusive) {
      if (exclusive) {
        return !(this.end.isLessThanOrEqual(otherRange.start) || this.start.isGreaterThanOrEqual(otherRange.end));
      } else {
        return !(this.end.isLessThan(otherRange.start) || this.start.isGreaterThan(otherRange.end));
      }
    };

    Range.prototype.containsRange = function(otherRange, exclusive) {
      var end, ref, start;
      ref = this.constructor.fromObject(otherRange), start = ref.start, end = ref.end;
      return this.containsPoint(start, exclusive) && this.containsPoint(end, exclusive);
    };

    Range.prototype.containsPoint = function(point, exclusive) {
      point = Point.fromObject(point);
      if (exclusive) {
        return point.isGreaterThan(this.start) && point.isLessThan(this.end);
      } else {
        return point.isGreaterThanOrEqual(this.start) && point.isLessThanOrEqual(this.end);
      }
    };

    Range.prototype.intersectsRow = function(row) {
      return (this.start.row <= row && row <= this.end.row);
    };

    Range.prototype.intersectsRowRange = function(startRow, endRow) {
      var ref;
      if (startRow > endRow) {
        ref = [endRow, startRow], startRow = ref[0], endRow = ref[1];
      }
      return this.end.row >= startRow && endRow >= this.start.row;
    };

    Range.prototype.getExtent = function() {
      return this.end.traversalFrom(this.start);
    };


    /*
    Section: Conversion
     */

    Range.prototype.toDelta = function() {
      var columns, rows;
      rows = this.end.row - this.start.row;
      if (rows === 0) {
        columns = this.end.column - this.start.column;
      } else {
        columns = this.end.column;
      }
      return new Point(rows, columns);
    };

    Range.prototype.toString = function() {
      return "[" + this.start + " - " + this.end + "]";
    };

    return Range;

  })();

}).call(this);
