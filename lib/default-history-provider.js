(function() {
  var Checkpoint, DefaultHistoryProvider, MarkerLayer, Patch, SerializationVersion, Transaction, checkpointFromSnapshot, patchFromChanges, snapshotFromCheckpoint, snapshotFromTransaction, transactionFromSnapshot, traversal;

  Patch = require('superstring').Patch;

  MarkerLayer = require('./marker-layer');

  traversal = require('./point-helpers').traversal;

  patchFromChanges = require('./helpers').patchFromChanges;

  SerializationVersion = 6;

  Checkpoint = (function() {
    function Checkpoint(id1, snapshot1, isBarrier) {
      var ref;
      this.id = id1;
      this.snapshot = snapshot1;
      this.isBarrier = isBarrier;
      if (this.snapshot == null) {
        if ((ref = global.atom) != null) {
          ref.assert(false, "Checkpoint created without snapshot");
        }
        this.snapshot = {};
      }
    }

    return Checkpoint;

  })();

  Transaction = (function() {
    function Transaction(markerSnapshotBefore1, patch1, markerSnapshotAfter1, groupingInterval1) {
      this.markerSnapshotBefore = markerSnapshotBefore1;
      this.patch = patch1;
      this.markerSnapshotAfter = markerSnapshotAfter1;
      this.groupingInterval = groupingInterval1 != null ? groupingInterval1 : 0;
      this.timestamp = Date.now();
    }

    Transaction.prototype.shouldGroupWith = function(previousTransaction) {
      var timeBetweenTransactions;
      timeBetweenTransactions = this.timestamp - previousTransaction.timestamp;
      return timeBetweenTransactions < Math.min(this.groupingInterval, previousTransaction.groupingInterval);
    };

    Transaction.prototype.groupWith = function(previousTransaction) {
      return new Transaction(previousTransaction.markerSnapshotBefore, Patch.compose([previousTransaction.patch, this.patch]), this.markerSnapshotAfter, this.groupingInterval);
    };

    return Transaction;

  })();

  module.exports = DefaultHistoryProvider = (function() {
    function DefaultHistoryProvider(buffer) {
      this.buffer = buffer;
      this.maxUndoEntries = this.buffer.maxUndoEntries;
      this.nextCheckpointId = 1;
      this.undoStack = [];
      this.redoStack = [];
    }

    DefaultHistoryProvider.prototype.createCheckpoint = function(options) {
      var checkpoint;
      checkpoint = new Checkpoint(this.nextCheckpointId++, options != null ? options.markers : void 0, options != null ? options.isBarrier : void 0);
      this.undoStack.push(checkpoint);
      return checkpoint.id;
    };

    DefaultHistoryProvider.prototype.groupChangesSinceCheckpoint = function(checkpointId, options) {
      var checkpointIndex, composedPatches, deleteCheckpoint, entry, i, j, markerSnapshotAfter, markerSnapshotBefore, patchesSinceCheckpoint, ref, ref1;
      deleteCheckpoint = (ref = options != null ? options.deleteCheckpoint : void 0) != null ? ref : false;
      markerSnapshotAfter = options != null ? options.markers : void 0;
      checkpointIndex = null;
      markerSnapshotBefore = null;
      patchesSinceCheckpoint = [];
      ref1 = this.undoStack;
      for (i = j = ref1.length - 1; j >= 0; i = j += -1) {
        entry = ref1[i];
        if (checkpointIndex != null) {
          break;
        }
        switch (entry.constructor) {
          case Checkpoint:
            if (entry.id === checkpointId) {
              checkpointIndex = i;
              markerSnapshotBefore = entry.snapshot;
            } else if (entry.isBarrier) {
              return false;
            }
            break;
          case Transaction:
            patchesSinceCheckpoint.unshift(entry.patch);
            break;
          case Patch:
            patchesSinceCheckpoint.unshift(entry);
            break;
          default:
            throw new Error("Unexpected undo stack entry type: " + entry.constructor.name);
        }
      }
      if (checkpointIndex != null) {
        composedPatches = Patch.compose(patchesSinceCheckpoint);
        if (patchesSinceCheckpoint.length > 0) {
          this.undoStack.splice(checkpointIndex + 1);
          this.undoStack.push(new Transaction(markerSnapshotBefore, composedPatches, markerSnapshotAfter));
        }
        if (deleteCheckpoint) {
          this.undoStack.splice(checkpointIndex, 1);
        }
        return composedPatches.getChanges();
      } else {
        return false;
      }
    };

    DefaultHistoryProvider.prototype.getChangesSinceCheckpoint = function(checkpointId) {
      var checkpointIndex, entry, i, j, patchesSinceCheckpoint, ref;
      checkpointIndex = null;
      patchesSinceCheckpoint = [];
      ref = this.undoStack;
      for (i = j = ref.length - 1; j >= 0; i = j += -1) {
        entry = ref[i];
        if (checkpointIndex != null) {
          break;
        }
        switch (entry.constructor) {
          case Checkpoint:
            if (entry.id === checkpointId) {
              checkpointIndex = i;
            }
            break;
          case Transaction:
            patchesSinceCheckpoint.unshift(entry.patch);
            break;
          case Patch:
            patchesSinceCheckpoint.unshift(entry);
            break;
          default:
            throw new Error("Unexpected undo stack entry type: " + entry.constructor.name);
        }
      }
      if (checkpointIndex != null) {
        return Patch.compose(patchesSinceCheckpoint).getChanges();
      } else {
        return null;
      }
    };

    DefaultHistoryProvider.prototype.groupLastChanges = function() {
      var composedPatch, entry, i, j, markerSnapshotAfter, markerSnapshotBefore, patchesSinceCheckpoint, ref;
      markerSnapshotAfter = null;
      markerSnapshotBefore = null;
      patchesSinceCheckpoint = [];
      ref = this.undoStack;
      for (i = j = ref.length - 1; j >= 0; i = j += -1) {
        entry = ref[i];
        switch (entry.constructor) {
          case Checkpoint:
            if (entry.isBarrier) {
              return false;
            }
            break;
          case Transaction:
            if (patchesSinceCheckpoint.length === 0) {
              markerSnapshotAfter = entry.markerSnapshotAfter;
            } else if (patchesSinceCheckpoint.length === 1) {
              markerSnapshotBefore = entry.markerSnapshotBefore;
            }
            patchesSinceCheckpoint.unshift(entry.patch);
            break;
          case Patch:
            patchesSinceCheckpoint.unshift(entry);
            break;
          default:
            throw new Error("Unexpected undo stack entry type: " + entry.constructor.name);
        }
        if (patchesSinceCheckpoint.length === 2) {
          composedPatch = Patch.compose(patchesSinceCheckpoint);
          this.undoStack.splice(i);
          this.undoStack.push(new Transaction(markerSnapshotBefore, composedPatch, markerSnapshotAfter));
          return true;
        }
      }
    };

    DefaultHistoryProvider.prototype.enforceUndoStackSizeLimit = function() {
      if (this.undoStack.length > this.maxUndoEntries) {
        return this.undoStack.splice(0, this.undoStack.length - this.maxUndoEntries);
      }
    };

    DefaultHistoryProvider.prototype.applyGroupingInterval = function(groupingInterval) {
      var previousEntry, topEntry;
      topEntry = this.undoStack[this.undoStack.length - 1];
      previousEntry = this.undoStack[this.undoStack.length - 2];
      if (topEntry instanceof Transaction) {
        topEntry.groupingInterval = groupingInterval;
      } else {
        return;
      }
      if (groupingInterval === 0) {
        return;
      }
      if (previousEntry instanceof Transaction && topEntry.shouldGroupWith(previousEntry)) {
        return this.undoStack.splice(this.undoStack.length - 2, 2, topEntry.groupWith(previousEntry));
      }
    };

    DefaultHistoryProvider.prototype.pushChange = function(arg) {
      var newExtent, newStart, newText, oldExtent, oldText, patch;
      newStart = arg.newStart, oldExtent = arg.oldExtent, newExtent = arg.newExtent, oldText = arg.oldText, newText = arg.newText;
      patch = new Patch;
      patch.splice(newStart, oldExtent, newExtent, oldText, newText);
      return this.pushPatch(patch);
    };

    DefaultHistoryProvider.prototype.pushPatch = function(patch) {
      this.undoStack.push(patch);
      return this.clearRedoStack();
    };

    DefaultHistoryProvider.prototype.undo = function() {
      var entry, i, j, patch, ref, ref1, snapshotBelow, spliceIndex;
      snapshotBelow = null;
      patch = null;
      spliceIndex = null;
      ref = this.undoStack;
      for (i = j = ref.length - 1; j >= 0; i = j += -1) {
        entry = ref[i];
        if (spliceIndex != null) {
          break;
        }
        switch (entry.constructor) {
          case Checkpoint:
            if (entry.isBarrier) {
              return false;
            }
            break;
          case Transaction:
            snapshotBelow = entry.markerSnapshotBefore;
            patch = entry.patch.invert();
            spliceIndex = i;
            break;
          case Patch:
            patch = entry.invert();
            spliceIndex = i;
            break;
          default:
            throw new Error("Unexpected entry type when popping undoStack: " + entry.constructor.name);
        }
      }
      if (spliceIndex != null) {
        (ref1 = this.redoStack).push.apply(ref1, this.undoStack.splice(spliceIndex).reverse());
        return {
          textUpdates: patch.getChanges(),
          markers: snapshotBelow
        };
      } else {
        return false;
      }
    };

    DefaultHistoryProvider.prototype.redo = function() {
      var entry, i, j, patch, ref, ref1, snapshotBelow, spliceIndex;
      snapshotBelow = null;
      patch = null;
      spliceIndex = null;
      ref = this.redoStack;
      for (i = j = ref.length - 1; j >= 0; i = j += -1) {
        entry = ref[i];
        if (spliceIndex != null) {
          break;
        }
        switch (entry.constructor) {
          case Checkpoint:
            if (entry.isBarrier) {
              throw new Error("Invalid redo stack state");
            }
            break;
          case Transaction:
            snapshotBelow = entry.markerSnapshotAfter;
            patch = entry.patch;
            spliceIndex = i;
            break;
          case Patch:
            patch = entry;
            spliceIndex = i;
            break;
          default:
            throw new Error("Unexpected entry type when popping redoStack: " + entry.constructor.name);
        }
      }
      while (this.redoStack[spliceIndex - 1] instanceof Checkpoint) {
        spliceIndex--;
      }
      if (spliceIndex != null) {
        (ref1 = this.undoStack).push.apply(ref1, this.redoStack.splice(spliceIndex).reverse());
        return {
          textUpdates: patch.getChanges(),
          markers: snapshotBelow
        };
      } else {
        return false;
      }
    };

    DefaultHistoryProvider.prototype.revertToCheckpoint = function(checkpointId) {
      var entry, i, j, patchesSinceCheckpoint, ref, snapshotBelow, spliceIndex;
      snapshotBelow = null;
      spliceIndex = null;
      patchesSinceCheckpoint = [];
      ref = this.undoStack;
      for (i = j = ref.length - 1; j >= 0; i = j += -1) {
        entry = ref[i];
        if (spliceIndex != null) {
          break;
        }
        switch (entry.constructor) {
          case Checkpoint:
            if (entry.id === checkpointId) {
              snapshotBelow = entry.snapshot;
              spliceIndex = i;
            } else if (entry.isBarrier) {
              return false;
            }
            break;
          case Transaction:
            patchesSinceCheckpoint.push(entry.patch.invert());
            break;
          default:
            patchesSinceCheckpoint.push(entry.invert());
        }
      }
      if (spliceIndex != null) {
        this.undoStack.splice(spliceIndex);
        return {
          textUpdates: Patch.compose(patchesSinceCheckpoint).getChanges(),
          markers: snapshotBelow
        };
      } else {
        return false;
      }
    };

    DefaultHistoryProvider.prototype.clear = function() {
      this.clearUndoStack();
      return this.clearRedoStack();
    };

    DefaultHistoryProvider.prototype.clearUndoStack = function() {
      return this.undoStack.length = 0;
    };

    DefaultHistoryProvider.prototype.clearRedoStack = function() {
      return this.redoStack.length = 0;
    };

    DefaultHistoryProvider.prototype.toString = function() {
      var entry, j, len, output, ref;
      output = '';
      ref = this.undoStack;
      for (j = 0, len = ref.length; j < len; j++) {
        entry = ref[j];
        switch (entry.constructor) {
          case Checkpoint:
            output += "Checkpoint, ";
            break;
          case Transaction:
            output += "Transaction, ";
            break;
          case Patch:
            output += "Patch, ";
            break;
          default:
            output += "Unknown {" + (JSON.stringify(entry)) + "}, ";
        }
      }
      return '[' + output.slice(0, -2) + ']';
    };

    DefaultHistoryProvider.prototype.serialize = function(options) {
      return {
        version: SerializationVersion,
        nextCheckpointId: this.nextCheckpointId,
        undoStack: this.serializeStack(this.undoStack, options),
        redoStack: this.serializeStack(this.redoStack, options),
        maxUndoEntries: this.maxUndoEntries
      };
    };

    DefaultHistoryProvider.prototype.deserialize = function(state) {
      if (state.version !== SerializationVersion) {
        return;
      }
      this.nextCheckpointId = state.nextCheckpointId;
      this.maxUndoEntries = state.maxUndoEntries;
      this.undoStack = this.deserializeStack(state.undoStack);
      return this.redoStack = this.deserializeStack(state.redoStack);
    };

    DefaultHistoryProvider.prototype.getSnapshot = function(maxEntries) {
      var entry, j, k, redoStack, ref, ref1, undoStack, undoStackPatches;
      undoStackPatches = [];
      undoStack = [];
      ref = this.undoStack;
      for (j = ref.length - 1; j >= 0; j += -1) {
        entry = ref[j];
        switch (entry.constructor) {
          case Checkpoint:
            undoStack.unshift(snapshotFromCheckpoint(entry));
            break;
          case Transaction:
            undoStack.unshift(snapshotFromTransaction(entry));
            undoStackPatches.unshift(entry.patch);
        }
        if (undoStack.length === maxEntries) {
          break;
        }
      }
      redoStack = [];
      ref1 = this.redoStack;
      for (k = ref1.length - 1; k >= 0; k += -1) {
        entry = ref1[k];
        switch (entry.constructor) {
          case Checkpoint:
            redoStack.unshift(snapshotFromCheckpoint(entry));
            break;
          case Transaction:
            redoStack.unshift(snapshotFromTransaction(entry));
        }
        if (redoStack.length === maxEntries) {
          break;
        }
      }
      return {
        nextCheckpointId: this.nextCheckpointId,
        undoStackChanges: Patch.compose(undoStackPatches).getChanges(),
        undoStack: undoStack,
        redoStack: redoStack
      };
    };

    DefaultHistoryProvider.prototype.restoreFromSnapshot = function(arg) {
      var redoStack, undoStack;
      this.nextCheckpointId = arg.nextCheckpointId, undoStack = arg.undoStack, redoStack = arg.redoStack;
      this.undoStack = undoStack.map(function(entry) {
        switch (entry.type) {
          case 'transaction':
            return transactionFromSnapshot(entry);
          case 'checkpoint':
            return checkpointFromSnapshot(entry);
        }
      });
      return this.redoStack = redoStack.map(function(entry) {
        switch (entry.type) {
          case 'transaction':
            return transactionFromSnapshot(entry);
          case 'checkpoint':
            return checkpointFromSnapshot(entry);
        }
      });
    };


    /*
    Section: Private
     */

    DefaultHistoryProvider.prototype.getCheckpointIndex = function(checkpointId) {
      var entry, i, j, ref;
      ref = this.undoStack;
      for (i = j = ref.length - 1; j >= 0; i = j += -1) {
        entry = ref[i];
        if (entry instanceof Checkpoint && entry.id === checkpointId) {
          return i;
        }
      }
      return null;
    };

    DefaultHistoryProvider.prototype.serializeStack = function(stack, options) {
      var entry, j, len, results;
      results = [];
      for (j = 0, len = stack.length; j < len; j++) {
        entry = stack[j];
        switch (entry.constructor) {
          case Checkpoint:
            results.push({
              type: 'checkpoint',
              id: entry.id,
              snapshot: this.serializeSnapshot(entry.snapshot, options),
              isBarrier: entry.isBarrier
            });
            break;
          case Transaction:
            results.push({
              type: 'transaction',
              markerSnapshotBefore: this.serializeSnapshot(entry.markerSnapshotBefore, options),
              markerSnapshotAfter: this.serializeSnapshot(entry.markerSnapshotAfter, options),
              patch: entry.patch.serialize().toString('base64')
            });
            break;
          case Patch:
            results.push({
              type: 'patch',
              data: entry.serialize().toString('base64')
            });
            break;
          default:
            throw new Error("Unexpected undoStack entry type during serialization: " + entry.constructor.name);
        }
      }
      return results;
    };

    DefaultHistoryProvider.prototype.deserializeStack = function(stack) {
      var entry, j, len, results;
      results = [];
      for (j = 0, len = stack.length; j < len; j++) {
        entry = stack[j];
        switch (entry.type) {
          case 'checkpoint':
            results.push(new Checkpoint(entry.id, MarkerLayer.deserializeSnapshot(entry.snapshot), entry.isBarrier));
            break;
          case 'transaction':
            results.push(new Transaction(MarkerLayer.deserializeSnapshot(entry.markerSnapshotBefore), Patch.deserialize(Buffer.from(entry.patch, 'base64')), MarkerLayer.deserializeSnapshot(entry.markerSnapshotAfter)));
            break;
          case 'patch':
            results.push(Patch.deserialize(Buffer.from(entry.data, 'base64')));
            break;
          default:
            throw new Error("Unexpected undoStack entry type during deserialization: " + entry.type);
        }
      }
      return results;
    };

    DefaultHistoryProvider.prototype.serializeSnapshot = function(snapshot, options) {
      var layerId, layerSnapshot, markerId, markerSnapshot, ref, serializedLayerSnapshots, serializedMarkerSnapshot, serializedMarkerSnapshots;
      if (!options.markerLayers) {
        return;
      }
      serializedLayerSnapshots = {};
      for (layerId in snapshot) {
        layerSnapshot = snapshot[layerId];
        if (!((ref = this.buffer.getMarkerLayer(layerId)) != null ? ref.persistent : void 0)) {
          continue;
        }
        serializedMarkerSnapshots = {};
        for (markerId in layerSnapshot) {
          markerSnapshot = layerSnapshot[markerId];
          serializedMarkerSnapshot = Object.assign({}, markerSnapshot);
          delete serializedMarkerSnapshot.marker;
          serializedMarkerSnapshots[markerId] = serializedMarkerSnapshot;
        }
        serializedLayerSnapshots[layerId] = serializedMarkerSnapshots;
      }
      return serializedLayerSnapshots;
    };

    return DefaultHistoryProvider;

  })();

  snapshotFromCheckpoint = function(checkpoint) {
    return {
      type: 'checkpoint',
      id: checkpoint.id,
      markers: checkpoint.snapshot
    };
  };

  checkpointFromSnapshot = function(arg) {
    var id, markers;
    id = arg.id, markers = arg.markers;
    return new Checkpoint(id, markers, false);
  };

  snapshotFromTransaction = function(transaction) {
    var change, changes, j, len, ref;
    changes = [];
    ref = transaction.patch.getChanges();
    for (j = 0, len = ref.length; j < len; j += 1) {
      change = ref[j];
      changes.push({
        oldStart: change.oldStart,
        oldEnd: change.oldEnd,
        newStart: change.newStart,
        newEnd: change.newEnd,
        oldText: change.oldText,
        newText: change.newText
      });
    }
    return {
      type: 'transaction',
      changes: changes,
      markersBefore: transaction.markerSnapshotBefore,
      markersAfter: transaction.markerSnapshotAfter
    };
  };

  transactionFromSnapshot = function(arg) {
    var changes, markersAfter, markersBefore;
    changes = arg.changes, markersBefore = arg.markersBefore, markersAfter = arg.markersAfter;
    return new Transaction(markersBefore, patchFromChanges(changes), markersAfter);
  };

}).call(this);
