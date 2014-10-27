(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var _ = Package.underscore._;
var EJSON = Package.ejson.EJSON;
var IdMap = Package['id-map'].IdMap;
var OrderedDict = Package['ordered-dict'].OrderedDict;
var Tracker = Package.tracker.Tracker;
var Deps = Package.tracker.Deps;
var Random = Package.random.Random;
var GeoJSON = Package['geojson-utils'].GeoJSON;

/* Package-scope variables */
var LocalCollection, Minimongo, MinimongoTest, MinimongoError, isArray, isPlainObject, isIndexable, isOperatorObject, isNumericKey, regexpElementMatcher, equalityElementMatcher, ELEMENT_OPERATORS, makeLookupFunction, expandArraysInBranches, projectionDetails, pathsToTree, combineImportantPathsIntoProjection;

(function () {

////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                    //
// packages/minimongo/minimongo.js                                                                    //
//                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                      //
// XXX type checking on selectors (graceful error if malformed)                                       // 1
                                                                                                      // 2
// LocalCollection: a set of documents that supports queries and modifiers.                           // 3
                                                                                                      // 4
// Cursor: a specification for a particular subset of documents, w/                                   // 5
// a defined order, limit, and offset.  creating a Cursor with LocalCollection.find(),                // 6
                                                                                                      // 7
// ObserveHandle: the return value of a live query.                                                   // 8
                                                                                                      // 9
LocalCollection = function (name) {                                                                   // 10
  var self = this;                                                                                    // 11
  self.name = name;                                                                                   // 12
  // _id -> document (also containing id)                                                             // 13
  self._docs = new LocalCollection._IdMap;                                                            // 14
                                                                                                      // 15
  self._observeQueue = new Meteor._SynchronousQueue();                                                // 16
                                                                                                      // 17
  self.next_qid = 1; // live query id generator                                                       // 18
                                                                                                      // 19
  // qid -> live query object. keys:                                                                  // 20
  //  ordered: bool. ordered queries have addedBefore/movedBefore callbacks.                          // 21
  //  results: array (ordered) or object (unordered) of current results                               // 22
  //    (aliased with self._docs!)                                                                    // 23
  //  resultsSnapshot: snapshot of results. null if not paused.                                       // 24
  //  cursor: Cursor object for the query.                                                            // 25
  //  selector, sorter, (callbacks): functions                                                        // 26
  self.queries = {};                                                                                  // 27
                                                                                                      // 28
  // null if not saving originals; an IdMap from id to original document value if                     // 29
  // saving originals. See comments before saveOriginals().                                           // 30
  self._savedOriginals = null;                                                                        // 31
                                                                                                      // 32
  // True when observers are paused and we should not send callbacks.                                 // 33
  self.paused = false;                                                                                // 34
};                                                                                                    // 35
                                                                                                      // 36
Minimongo = {};                                                                                       // 37
                                                                                                      // 38
// Object exported only for unit testing.                                                             // 39
// Use it to export private functions to test in Tinytest.                                            // 40
MinimongoTest = {};                                                                                   // 41
                                                                                                      // 42
LocalCollection._applyChanges = function (doc, changeFields) {                                        // 43
  _.each(changeFields, function (value, key) {                                                        // 44
    if (value === undefined)                                                                          // 45
      delete doc[key];                                                                                // 46
    else                                                                                              // 47
      doc[key] = value;                                                                               // 48
  });                                                                                                 // 49
};                                                                                                    // 50
                                                                                                      // 51
MinimongoError = function (message) {                                                                 // 52
  var e = new Error(message);                                                                         // 53
  e.name = "MinimongoError";                                                                          // 54
  return e;                                                                                           // 55
};                                                                                                    // 56
                                                                                                      // 57
                                                                                                      // 58
// options may include sort, skip, limit, reactive                                                    // 59
// sort may be any of these forms:                                                                    // 60
//     {a: 1, b: -1}                                                                                  // 61
//     [["a", "asc"], ["b", "desc"]]                                                                  // 62
//     ["a", ["b", "desc"]]                                                                           // 63
//   (in the first form you're beholden to key enumeration order in                                   // 64
//   your javascript VM)                                                                              // 65
//                                                                                                    // 66
// reactive: if given, and false, don't register with Tracker (default                                // 67
// is true)                                                                                           // 68
//                                                                                                    // 69
// XXX possibly should support retrieving a subset of fields? and                                     // 70
// have it be a hint (ignored on the client, when not copying the                                     // 71
// doc?)                                                                                              // 72
//                                                                                                    // 73
// XXX sort does not yet support subkeys ('a.b') .. fix that!                                         // 74
// XXX add one more sort form: "key"                                                                  // 75
// XXX tests                                                                                          // 76
LocalCollection.prototype.find = function (selector, options) {                                       // 77
  // default syntax for everything is to omit the selector argument.                                  // 78
  // but if selector is explicitly passed in as false or undefined, we                                // 79
  // want a selector that matches nothing.                                                            // 80
  if (arguments.length === 0)                                                                         // 81
    selector = {};                                                                                    // 82
                                                                                                      // 83
  return new LocalCollection.Cursor(this, selector, options);                                         // 84
};                                                                                                    // 85
                                                                                                      // 86
// don't call this ctor directly.  use LocalCollection.find().                                        // 87
                                                                                                      // 88
LocalCollection.Cursor = function (collection, selector, options) {                                   // 89
  var self = this;                                                                                    // 90
  if (!options) options = {};                                                                         // 91
                                                                                                      // 92
  self.collection = collection;                                                                       // 93
  self.sorter = null;                                                                                 // 94
                                                                                                      // 95
  if (LocalCollection._selectorIsId(selector)) {                                                      // 96
    // stash for fast path                                                                            // 97
    self._selectorId = selector;                                                                      // 98
    self.matcher = new Minimongo.Matcher(selector, self);                                             // 99
  } else {                                                                                            // 100
    self._selectorId = undefined;                                                                     // 101
    self.matcher = new Minimongo.Matcher(selector, self);                                             // 102
    if (self.matcher.hasGeoQuery() || options.sort) {                                                 // 103
      self.sorter = new Minimongo.Sorter(options.sort || [],                                          // 104
                                         { matcher: self.matcher });                                  // 105
    }                                                                                                 // 106
  }                                                                                                   // 107
  self.skip = options.skip;                                                                           // 108
  self.limit = options.limit;                                                                         // 109
  self.fields = options.fields;                                                                       // 110
                                                                                                      // 111
  if (self.fields)                                                                                    // 112
    self.projectionFn = LocalCollection._compileProjection(self.fields);                              // 113
                                                                                                      // 114
  self._transform = LocalCollection.wrapTransform(options.transform);                                 // 115
                                                                                                      // 116
  // by default, queries register w/ Tracker when it is available.                                    // 117
  if (typeof Tracker !== "undefined")                                                                 // 118
    self.reactive = (options.reactive === undefined) ? true : options.reactive;                       // 119
};                                                                                                    // 120
                                                                                                      // 121
// Since we don't actually have a "nextObject" interface, there's really no                           // 122
// reason to have a "rewind" interface.  All it did was make multiple calls                           // 123
// to fetch/map/forEach return nothing the second time.                                               // 124
// XXX COMPAT WITH 0.8.1                                                                              // 125
LocalCollection.Cursor.prototype.rewind = function () {                                               // 126
};                                                                                                    // 127
                                                                                                      // 128
LocalCollection.prototype.findOne = function (selector, options) {                                    // 129
  if (arguments.length === 0)                                                                         // 130
    selector = {};                                                                                    // 131
                                                                                                      // 132
  // NOTE: by setting limit 1 here, we end up using very inefficient                                  // 133
  // code that recomputes the whole query on each update. The upside is                               // 134
  // that when you reactively depend on a findOne you only get                                        // 135
  // invalidated when the found object changes, not any object in the                                 // 136
  // collection. Most findOne will be by id, which has a fast path, so                                // 137
  // this might not be a big deal. In most cases, invalidation causes                                 // 138
  // the called to re-query anyway, so this should be a net performance                               // 139
  // improvement.                                                                                     // 140
  options = options || {};                                                                            // 141
  options.limit = 1;                                                                                  // 142
                                                                                                      // 143
  return this.find(selector, options).fetch()[0];                                                     // 144
};                                                                                                    // 145
                                                                                                      // 146
/**                                                                                                   // 147
 * @summary Call `callback` once for each matching document, sequentially and synchronously.          // 148
 * @locus Anywhere                                                                                    // 149
 * @method  forEach                                                                                   // 150
 * @instance                                                                                          // 151
 * @memberOf Mongo.Cursor                                                                             // 152
 * @param {Function} callback Function to call. It will be called with three arguments: the document, a 0-based index, and <em>cursor</em> itself.
 * @param {Any} [thisArg] An object which will be the value of `this` inside `callback`.              // 154
 */                                                                                                   // 155
LocalCollection.Cursor.prototype.forEach = function (callback, thisArg) {                             // 156
  var self = this;                                                                                    // 157
                                                                                                      // 158
  var objects = self._getRawObjects({ordered: true});                                                 // 159
                                                                                                      // 160
  if (self.reactive) {                                                                                // 161
    self._depend({                                                                                    // 162
      addedBefore: true,                                                                              // 163
      removed: true,                                                                                  // 164
      changed: true,                                                                                  // 165
      movedBefore: true});                                                                            // 166
  }                                                                                                   // 167
                                                                                                      // 168
  _.each(objects, function (elt, i) {                                                                 // 169
    if (self.projectionFn) {                                                                          // 170
      elt = self.projectionFn(elt);                                                                   // 171
    } else {                                                                                          // 172
      // projection functions always clone the pieces they use, but if not we                         // 173
      // have to do it here.                                                                          // 174
      elt = EJSON.clone(elt);                                                                         // 175
    }                                                                                                 // 176
                                                                                                      // 177
    if (self._transform)                                                                              // 178
      elt = self._transform(elt);                                                                     // 179
    callback.call(thisArg, elt, i, self);                                                             // 180
  });                                                                                                 // 181
};                                                                                                    // 182
                                                                                                      // 183
LocalCollection.Cursor.prototype.getTransform = function () {                                         // 184
  return this._transform;                                                                             // 185
};                                                                                                    // 186
                                                                                                      // 187
/**                                                                                                   // 188
 * @summary Map callback over all matching documents.  Returns an Array.                              // 189
 * @locus Anywhere                                                                                    // 190
 * @method map                                                                                        // 191
 * @instance                                                                                          // 192
 * @memberOf Mongo.Cursor                                                                             // 193
 * @param {Function} callback Function to call. It will be called with three arguments: the document, a 0-based index, and <em>cursor</em> itself.
 * @param {Any} [thisArg] An object which will be the value of `this` inside `callback`.              // 195
 */                                                                                                   // 196
LocalCollection.Cursor.prototype.map = function (callback, thisArg) {                                 // 197
  var self = this;                                                                                    // 198
  var res = [];                                                                                       // 199
  self.forEach(function (doc, index) {                                                                // 200
    res.push(callback.call(thisArg, doc, index, self));                                               // 201
  });                                                                                                 // 202
  return res;                                                                                         // 203
};                                                                                                    // 204
                                                                                                      // 205
/**                                                                                                   // 206
 * @summary Return all matching documents as an Array.                                                // 207
 * @memberOf Mongo.Cursor                                                                             // 208
 * @method  fetch                                                                                     // 209
 * @instance                                                                                          // 210
 * @locus Anywhere                                                                                    // 211
 */                                                                                                   // 212
LocalCollection.Cursor.prototype.fetch = function () {                                                // 213
  var self = this;                                                                                    // 214
  var res = [];                                                                                       // 215
  self.forEach(function (doc) {                                                                       // 216
    res.push(doc);                                                                                    // 217
  });                                                                                                 // 218
  return res;                                                                                         // 219
};                                                                                                    // 220
                                                                                                      // 221
/**                                                                                                   // 222
 * @summary Returns the number of documents that match a query.                                       // 223
 * @memberOf Mongo.Cursor                                                                             // 224
 * @method  count                                                                                     // 225
 * @instance                                                                                          // 226
 * @locus Anywhere                                                                                    // 227
 */                                                                                                   // 228
LocalCollection.Cursor.prototype.count = function () {                                                // 229
  var self = this;                                                                                    // 230
                                                                                                      // 231
  if (self.reactive)                                                                                  // 232
    self._depend({added: true, removed: true},                                                        // 233
                 true /* allow the observe to be unordered */);                                       // 234
                                                                                                      // 235
  return self._getRawObjects({ordered: true}).length;                                                 // 236
};                                                                                                    // 237
                                                                                                      // 238
LocalCollection.Cursor.prototype._publishCursor = function (sub) {                                    // 239
  var self = this;                                                                                    // 240
  if (! self.collection.name)                                                                         // 241
    throw new Error("Can't publish a cursor from a collection without a name.");                      // 242
  var collection = self.collection.name;                                                              // 243
                                                                                                      // 244
  // XXX minimongo should not depend on mongo-livedata!                                               // 245
  return Mongo.Collection._publishCursor(self, sub, collection);                                      // 246
};                                                                                                    // 247
                                                                                                      // 248
LocalCollection.Cursor.prototype._getCollectionName = function () {                                   // 249
  var self = this;                                                                                    // 250
  return self.collection.name;                                                                        // 251
};                                                                                                    // 252
                                                                                                      // 253
LocalCollection._observeChangesCallbacksAreOrdered = function (callbacks) {                           // 254
  if (callbacks.added && callbacks.addedBefore)                                                       // 255
    throw new Error("Please specify only one of added() and addedBefore()");                          // 256
  return !!(callbacks.addedBefore || callbacks.movedBefore);                                          // 257
};                                                                                                    // 258
                                                                                                      // 259
LocalCollection._observeCallbacksAreOrdered = function (callbacks) {                                  // 260
  if (callbacks.addedAt && callbacks.added)                                                           // 261
    throw new Error("Please specify only one of added() and addedAt()");                              // 262
  if (callbacks.changedAt && callbacks.changed)                                                       // 263
    throw new Error("Please specify only one of changed() and changedAt()");                          // 264
  if (callbacks.removed && callbacks.removedAt)                                                       // 265
    throw new Error("Please specify only one of removed() and removedAt()");                          // 266
                                                                                                      // 267
  return !!(callbacks.addedAt || callbacks.movedTo || callbacks.changedAt                             // 268
            || callbacks.removedAt);                                                                  // 269
};                                                                                                    // 270
                                                                                                      // 271
// the handle that comes back from observe.                                                           // 272
LocalCollection.ObserveHandle = function () {};                                                       // 273
                                                                                                      // 274
// options to contain:                                                                                // 275
//  * callbacks for observe():                                                                        // 276
//    - addedAt (document, atIndex)                                                                   // 277
//    - added (document)                                                                              // 278
//    - changedAt (newDocument, oldDocument, atIndex)                                                 // 279
//    - changed (newDocument, oldDocument)                                                            // 280
//    - removedAt (document, atIndex)                                                                 // 281
//    - removed (document)                                                                            // 282
//    - movedTo (document, oldIndex, newIndex)                                                        // 283
//                                                                                                    // 284
// attributes available on returned query handle:                                                     // 285
//  * stop(): end updates                                                                             // 286
//  * collection: the collection this query is querying                                               // 287
//                                                                                                    // 288
// iff x is a returned query handle, (x instanceof                                                    // 289
// LocalCollection.ObserveHandle) is true                                                             // 290
//                                                                                                    // 291
// initial results delivered through added callback                                                   // 292
// XXX maybe callbacks should take a list of objects, to expose transactions?                         // 293
// XXX maybe support field limiting (to limit what you're notified on)                                // 294
                                                                                                      // 295
_.extend(LocalCollection.Cursor.prototype, {                                                          // 296
  /**                                                                                                 // 297
   * @summary Watch a query.  Receive callbacks as the result set changes.                            // 298
   * @locus Anywhere                                                                                  // 299
   * @memberOf Mongo.Cursor                                                                           // 300
   * @instance                                                                                        // 301
   * @param {Object} callbacks Functions to call to deliver the result set as it changes              // 302
   */                                                                                                 // 303
  observe: function (options) {                                                                       // 304
    var self = this;                                                                                  // 305
    return LocalCollection._observeFromObserveChanges(self, options);                                 // 306
  },                                                                                                  // 307
                                                                                                      // 308
  /**                                                                                                 // 309
   * @summary Watch a query.  Receive callbacks as the result set changes.  Only the differences between the old and new documents are passed to the callbacks.
   * @locus Anywhere                                                                                  // 311
   * @memberOf Mongo.Cursor                                                                           // 312
   * @instance                                                                                        // 313
   * @param {Object} callbacks Functions to call to deliver the result set as it changes              // 314
   */                                                                                                 // 315
  observeChanges: function (options) {                                                                // 316
    var self = this;                                                                                  // 317
                                                                                                      // 318
    var ordered = LocalCollection._observeChangesCallbacksAreOrdered(options);                        // 319
                                                                                                      // 320
    // there are several places that assume you aren't combining skip/limit with                      // 321
    // unordered observe.  eg, update's EJSON.clone, and the "there are several"                      // 322
    // comment in _modifyAndNotify                                                                    // 323
    // XXX allow skip/limit with unordered observe                                                    // 324
    if (!options._allow_unordered && !ordered && (self.skip || self.limit))                           // 325
      throw new Error("must use ordered observe with skip or limit");                                 // 326
                                                                                                      // 327
    if (self.fields && (self.fields._id === 0 || self.fields._id === false))                          // 328
      throw Error("You may not observe a cursor with {fields: {_id: 0}}");                            // 329
                                                                                                      // 330
    var query = {                                                                                     // 331
      matcher: self.matcher, // not fast pathed                                                       // 332
      sorter: ordered && self.sorter,                                                                 // 333
      distances: (                                                                                    // 334
        self.matcher.hasGeoQuery() && ordered && new LocalCollection._IdMap),                         // 335
      resultsSnapshot: null,                                                                          // 336
      ordered: ordered,                                                                               // 337
      cursor: self,                                                                                   // 338
      projectionFn: self.projectionFn                                                                 // 339
    };                                                                                                // 340
    var qid;                                                                                          // 341
                                                                                                      // 342
    // Non-reactive queries call added[Before] and then never call anything                           // 343
    // else.                                                                                          // 344
    if (self.reactive) {                                                                              // 345
      qid = self.collection.next_qid++;                                                               // 346
      self.collection.queries[qid] = query;                                                           // 347
    }                                                                                                 // 348
    query.results = self._getRawObjects({                                                             // 349
      ordered: ordered, distances: query.distances});                                                 // 350
    if (self.collection.paused)                                                                       // 351
      query.resultsSnapshot = (ordered ? [] : new LocalCollection._IdMap);                            // 352
                                                                                                      // 353
    // wrap callbacks we were passed. callbacks only fire when not paused and                         // 354
    // are never undefined                                                                            // 355
    // Filters out blacklisted fields according to cursor's projection.                               // 356
    // XXX wrong place for this?                                                                      // 357
                                                                                                      // 358
    // furthermore, callbacks enqueue until the operation we're working on is                         // 359
    // done.                                                                                          // 360
    var wrapCallback = function (f, fieldsIndex, ignoreEmptyFields) {                                 // 361
      if (!f)                                                                                         // 362
        return function () {};                                                                        // 363
      return function (/*args*/) {                                                                    // 364
        var context = this;                                                                           // 365
        var args = arguments;                                                                         // 366
                                                                                                      // 367
        if (self.collection.paused)                                                                   // 368
          return;                                                                                     // 369
                                                                                                      // 370
        if (fieldsIndex !== undefined && self.projectionFn) {                                         // 371
          args[fieldsIndex] = self.projectionFn(args[fieldsIndex]);                                   // 372
          if (ignoreEmptyFields && _.isEmpty(args[fieldsIndex]))                                      // 373
            return;                                                                                   // 374
        }                                                                                             // 375
                                                                                                      // 376
        self.collection._observeQueue.queueTask(function () {                                         // 377
          f.apply(context, args);                                                                     // 378
        });                                                                                           // 379
      };                                                                                              // 380
    };                                                                                                // 381
    query.added = wrapCallback(options.added, 1);                                                     // 382
    query.changed = wrapCallback(options.changed, 1, true);                                           // 383
    query.removed = wrapCallback(options.removed);                                                    // 384
    if (ordered) {                                                                                    // 385
      query.addedBefore = wrapCallback(options.addedBefore, 1);                                       // 386
      query.movedBefore = wrapCallback(options.movedBefore);                                          // 387
    }                                                                                                 // 388
                                                                                                      // 389
    if (!options._suppress_initial && !self.collection.paused) {                                      // 390
      // XXX unify ordered and unordered interface                                                    // 391
      var each = ordered                                                                              // 392
            ? _.bind(_.each, null, query.results)                                                     // 393
            : _.bind(query.results.forEach, query.results);                                           // 394
      each(function (doc) {                                                                           // 395
        var fields = EJSON.clone(doc);                                                                // 396
                                                                                                      // 397
        delete fields._id;                                                                            // 398
        if (ordered)                                                                                  // 399
          query.addedBefore(doc._id, fields, null);                                                   // 400
        query.added(doc._id, fields);                                                                 // 401
      });                                                                                             // 402
    }                                                                                                 // 403
                                                                                                      // 404
    var handle = new LocalCollection.ObserveHandle;                                                   // 405
    _.extend(handle, {                                                                                // 406
      collection: self.collection,                                                                    // 407
      stop: function () {                                                                             // 408
        if (self.reactive)                                                                            // 409
          delete self.collection.queries[qid];                                                        // 410
      }                                                                                               // 411
    });                                                                                               // 412
                                                                                                      // 413
    if (self.reactive && Tracker.active) {                                                            // 414
      // XXX in many cases, the same observe will be recreated when                                   // 415
      // the current autorun is rerun.  we could save work by                                         // 416
      // letting it linger across rerun and potentially get                                           // 417
      // repurposed if the same observe is performed, using logic                                     // 418
      // similar to that of Meteor.subscribe.                                                         // 419
      Tracker.onInvalidate(function () {                                                              // 420
        handle.stop();                                                                                // 421
      });                                                                                             // 422
    }                                                                                                 // 423
    // run the observe callbacks resulting from the initial contents                                  // 424
    // before we leave the observe.                                                                   // 425
    self.collection._observeQueue.drain();                                                            // 426
                                                                                                      // 427
    return handle;                                                                                    // 428
  }                                                                                                   // 429
});                                                                                                   // 430
                                                                                                      // 431
// Returns a collection of matching objects, but doesn't deep copy them.                              // 432
//                                                                                                    // 433
// If ordered is set, returns a sorted array, respecting sorter, skip, and limit                      // 434
// properties of the query.  if sorter is falsey, no sort -- you get the natural                      // 435
// order.                                                                                             // 436
//                                                                                                    // 437
// If ordered is not set, returns an object mapping from ID to doc (sorter, skip                      // 438
// and limit should not be set).                                                                      // 439
//                                                                                                    // 440
// If ordered is set and this cursor is a $near geoquery, then this function                          // 441
// will use an _IdMap to track each distance from the $near argument point in                         // 442
// order to use it as a sort key. If an _IdMap is passed in the 'distances'                           // 443
// argument, this function will clear it and use it for this purpose (otherwise                       // 444
// it will just create its own _IdMap). The observeChanges implementation uses                        // 445
// this to remember the distances after this function returns.                                        // 446
LocalCollection.Cursor.prototype._getRawObjects = function (options) {                                // 447
  var self = this;                                                                                    // 448
  options = options || {};                                                                            // 449
                                                                                                      // 450
  // XXX use OrderedDict instead of array, and make IdMap and OrderedDict                             // 451
  // compatible                                                                                       // 452
  var results = options.ordered ? [] : new LocalCollection._IdMap;                                    // 453
                                                                                                      // 454
  // fast path for single ID value                                                                    // 455
  if (self._selectorId !== undefined) {                                                               // 456
    // If you have non-zero skip and ask for a single id, you get                                     // 457
    // nothing. This is so it matches the behavior of the '{_id: foo}'                                // 458
    // path.                                                                                          // 459
    if (self.skip)                                                                                    // 460
      return results;                                                                                 // 461
                                                                                                      // 462
    var selectedDoc = self.collection._docs.get(self._selectorId);                                    // 463
    if (selectedDoc) {                                                                                // 464
      if (options.ordered)                                                                            // 465
        results.push(selectedDoc);                                                                    // 466
      else                                                                                            // 467
        results.set(self._selectorId, selectedDoc);                                                   // 468
    }                                                                                                 // 469
    return results;                                                                                   // 470
  }                                                                                                   // 471
                                                                                                      // 472
  // slow path for arbitrary selector, sort, skip, limit                                              // 473
                                                                                                      // 474
  // in the observeChanges case, distances is actually part of the "query" (ie,                       // 475
  // live results set) object.  in other cases, distances is only used inside                         // 476
  // this function.                                                                                   // 477
  var distances;                                                                                      // 478
  if (self.matcher.hasGeoQuery() && options.ordered) {                                                // 479
    if (options.distances) {                                                                          // 480
      distances = options.distances;                                                                  // 481
      distances.clear();                                                                              // 482
    } else {                                                                                          // 483
      distances = new LocalCollection._IdMap();                                                       // 484
    }                                                                                                 // 485
  }                                                                                                   // 486
                                                                                                      // 487
  self.collection._docs.forEach(function (doc, id) {                                                  // 488
    var matchResult = self.matcher.documentMatches(doc);                                              // 489
    if (matchResult.result) {                                                                         // 490
      if (options.ordered) {                                                                          // 491
        results.push(doc);                                                                            // 492
        if (distances && matchResult.distance !== undefined)                                          // 493
          distances.set(id, matchResult.distance);                                                    // 494
      } else {                                                                                        // 495
        results.set(id, doc);                                                                         // 496
      }                                                                                               // 497
    }                                                                                                 // 498
    // Fast path for limited unsorted queries.                                                        // 499
    // XXX 'length' check here seems wrong for ordered                                                // 500
    if (self.limit && !self.skip && !self.sorter &&                                                   // 501
        results.length === self.limit)                                                                // 502
      return false;  // break                                                                         // 503
    return true;  // continue                                                                         // 504
  });                                                                                                 // 505
                                                                                                      // 506
  if (!options.ordered)                                                                               // 507
    return results;                                                                                   // 508
                                                                                                      // 509
  if (self.sorter) {                                                                                  // 510
    var comparator = self.sorter.getComparator({distances: distances});                               // 511
    results.sort(comparator);                                                                         // 512
  }                                                                                                   // 513
                                                                                                      // 514
  var idx_start = self.skip || 0;                                                                     // 515
  var idx_end = self.limit ? (self.limit + idx_start) : results.length;                               // 516
  return results.slice(idx_start, idx_end);                                                           // 517
};                                                                                                    // 518
                                                                                                      // 519
// XXX Maybe we need a version of observe that just calls a callback if                               // 520
// anything changed.                                                                                  // 521
LocalCollection.Cursor.prototype._depend = function (changers, _allow_unordered) {                    // 522
  var self = this;                                                                                    // 523
                                                                                                      // 524
  if (Tracker.active) {                                                                               // 525
    var v = new Tracker.Dependency;                                                                   // 526
    v.depend();                                                                                       // 527
    var notifyChange = _.bind(v.changed, v);                                                          // 528
                                                                                                      // 529
    var options = {                                                                                   // 530
      _suppress_initial: true,                                                                        // 531
      _allow_unordered: _allow_unordered                                                              // 532
    };                                                                                                // 533
    _.each(['added', 'changed', 'removed', 'addedBefore', 'movedBefore'],                             // 534
           function (fnName) {                                                                        // 535
             if (changers[fnName])                                                                    // 536
               options[fnName] = notifyChange;                                                        // 537
           });                                                                                        // 538
                                                                                                      // 539
    // observeChanges will stop() when this computation is invalidated                                // 540
    self.observeChanges(options);                                                                     // 541
  }                                                                                                   // 542
};                                                                                                    // 543
                                                                                                      // 544
// XXX enforce rule that field names can't start with '$' or contain '.'                              // 545
// (real mongodb does in fact enforce this)                                                           // 546
// XXX possibly enforce that 'undefined' does not appear (we assume                                   // 547
// this in our handling of null and $exists)                                                          // 548
LocalCollection.prototype.insert = function (doc, callback) {                                         // 549
  var self = this;                                                                                    // 550
  doc = EJSON.clone(doc);                                                                             // 551
                                                                                                      // 552
  if (!_.has(doc, '_id')) {                                                                           // 553
    // if you really want to use ObjectIDs, set this global.                                          // 554
    // Mongo.Collection specifies its own ids and does not use this code.                             // 555
    doc._id = LocalCollection._useOID ? new LocalCollection._ObjectID()                               // 556
                                      : Random.id();                                                  // 557
  }                                                                                                   // 558
  var id = doc._id;                                                                                   // 559
                                                                                                      // 560
  if (self._docs.has(id))                                                                             // 561
    throw MinimongoError("Duplicate _id '" + id + "'");                                               // 562
                                                                                                      // 563
  self._saveOriginal(id, undefined);                                                                  // 564
  self._docs.set(id, doc);                                                                            // 565
                                                                                                      // 566
  var queriesToRecompute = [];                                                                        // 567
  // trigger live queries that match                                                                  // 568
  for (var qid in self.queries) {                                                                     // 569
    var query = self.queries[qid];                                                                    // 570
    var matchResult = query.matcher.documentMatches(doc);                                             // 571
    if (matchResult.result) {                                                                         // 572
      if (query.distances && matchResult.distance !== undefined)                                      // 573
        query.distances.set(id, matchResult.distance);                                                // 574
      if (query.cursor.skip || query.cursor.limit)                                                    // 575
        queriesToRecompute.push(qid);                                                                 // 576
      else                                                                                            // 577
        LocalCollection._insertInResults(query, doc);                                                 // 578
    }                                                                                                 // 579
  }                                                                                                   // 580
                                                                                                      // 581
  _.each(queriesToRecompute, function (qid) {                                                         // 582
    if (self.queries[qid])                                                                            // 583
      LocalCollection._recomputeResults(self.queries[qid]);                                           // 584
  });                                                                                                 // 585
  self._observeQueue.drain();                                                                         // 586
                                                                                                      // 587
  // Defer because the caller likely doesn't expect the callback to be run                            // 588
  // immediately.                                                                                     // 589
  if (callback)                                                                                       // 590
    Meteor.defer(function () {                                                                        // 591
      callback(null, id);                                                                             // 592
    });                                                                                               // 593
  return id;                                                                                          // 594
};                                                                                                    // 595
                                                                                                      // 596
// Iterates over a subset of documents that could match selector; calls                               // 597
// f(doc, id) on each of them.  Specifically, if selector specifies                                   // 598
// specific _id's, it only looks at those.  doc is *not* cloned: it is the                            // 599
// same object that is in _docs.                                                                      // 600
LocalCollection.prototype._eachPossiblyMatchingDoc = function (selector, f) {                         // 601
  var self = this;                                                                                    // 602
  var specificIds = LocalCollection._idsMatchedBySelector(selector);                                  // 603
  if (specificIds) {                                                                                  // 604
    for (var i = 0; i < specificIds.length; ++i) {                                                    // 605
      var id = specificIds[i];                                                                        // 606
      var doc = self._docs.get(id);                                                                   // 607
      if (doc) {                                                                                      // 608
        var breakIfFalse = f(doc, id);                                                                // 609
        if (breakIfFalse === false)                                                                   // 610
          break;                                                                                      // 611
      }                                                                                               // 612
    }                                                                                                 // 613
  } else {                                                                                            // 614
    self._docs.forEach(f);                                                                            // 615
  }                                                                                                   // 616
};                                                                                                    // 617
                                                                                                      // 618
LocalCollection.prototype.remove = function (selector, callback) {                                    // 619
  var self = this;                                                                                    // 620
                                                                                                      // 621
  // Easy special case: if we're not calling observeChanges callbacks and we're                       // 622
  // not saving originals and we got asked to remove everything, then just empty                      // 623
  // everything directly.                                                                             // 624
  if (self.paused && !self._savedOriginals && EJSON.equals(selector, {})) {                           // 625
    var result = self._docs.size();                                                                   // 626
    self._docs.clear();                                                                               // 627
    _.each(self.queries, function (query) {                                                           // 628
      if (query.ordered) {                                                                            // 629
        query.results = [];                                                                           // 630
      } else {                                                                                        // 631
        query.results.clear();                                                                        // 632
      }                                                                                               // 633
    });                                                                                               // 634
    if (callback) {                                                                                   // 635
      Meteor.defer(function () {                                                                      // 636
        callback(null, result);                                                                       // 637
      });                                                                                             // 638
    }                                                                                                 // 639
    return result;                                                                                    // 640
  }                                                                                                   // 641
                                                                                                      // 642
  var matcher = new Minimongo.Matcher(selector, self);                                                // 643
  var remove = [];                                                                                    // 644
  self._eachPossiblyMatchingDoc(selector, function (doc, id) {                                        // 645
    if (matcher.documentMatches(doc).result)                                                          // 646
      remove.push(id);                                                                                // 647
  });                                                                                                 // 648
                                                                                                      // 649
  var queriesToRecompute = [];                                                                        // 650
  var queryRemove = [];                                                                               // 651
  for (var i = 0; i < remove.length; i++) {                                                           // 652
    var removeId = remove[i];                                                                         // 653
    var removeDoc = self._docs.get(removeId);                                                         // 654
    _.each(self.queries, function (query, qid) {                                                      // 655
      if (query.matcher.documentMatches(removeDoc).result) {                                          // 656
        if (query.cursor.skip || query.cursor.limit)                                                  // 657
          queriesToRecompute.push(qid);                                                               // 658
        else                                                                                          // 659
          queryRemove.push({qid: qid, doc: removeDoc});                                               // 660
      }                                                                                               // 661
    });                                                                                               // 662
    self._saveOriginal(removeId, removeDoc);                                                          // 663
    self._docs.remove(removeId);                                                                      // 664
  }                                                                                                   // 665
                                                                                                      // 666
  // run live query callbacks _after_ we've removed the documents.                                    // 667
  _.each(queryRemove, function (remove) {                                                             // 668
    var query = self.queries[remove.qid];                                                             // 669
    if (query) {                                                                                      // 670
      query.distances && query.distances.remove(remove.doc._id);                                      // 671
      LocalCollection._removeFromResults(query, remove.doc);                                          // 672
    }                                                                                                 // 673
  });                                                                                                 // 674
  _.each(queriesToRecompute, function (qid) {                                                         // 675
    var query = self.queries[qid];                                                                    // 676
    if (query)                                                                                        // 677
      LocalCollection._recomputeResults(query);                                                       // 678
  });                                                                                                 // 679
  self._observeQueue.drain();                                                                         // 680
  result = remove.length;                                                                             // 681
  if (callback)                                                                                       // 682
    Meteor.defer(function () {                                                                        // 683
      callback(null, result);                                                                         // 684
    });                                                                                               // 685
  return result;                                                                                      // 686
};                                                                                                    // 687
                                                                                                      // 688
// XXX atomicity: if multi is true, and one modification fails, do                                    // 689
// we rollback the whole operation, or what?                                                          // 690
LocalCollection.prototype.update = function (selector, mod, options, callback) {                      // 691
  var self = this;                                                                                    // 692
  if (! callback && options instanceof Function) {                                                    // 693
    callback = options;                                                                               // 694
    options = null;                                                                                   // 695
  }                                                                                                   // 696
  if (!options) options = {};                                                                         // 697
                                                                                                      // 698
  var matcher = new Minimongo.Matcher(selector, self);                                                // 699
                                                                                                      // 700
  // Save the original results of any query that we might need to                                     // 701
  // _recomputeResults on, because _modifyAndNotify will mutate the objects in                        // 702
  // it. (We don't need to save the original results of paused queries because                        // 703
  // they already have a resultsSnapshot and we won't be diffing in                                   // 704
  // _recomputeResults.)                                                                              // 705
  var qidToOriginalResults = {};                                                                      // 706
  _.each(self.queries, function (query, qid) {                                                        // 707
    // XXX for now, skip/limit implies ordered observe, so query.results is                           // 708
    // always an array                                                                                // 709
    if ((query.cursor.skip || query.cursor.limit) && !query.paused)                                   // 710
      qidToOriginalResults[qid] = EJSON.clone(query.results);                                         // 711
  });                                                                                                 // 712
  var recomputeQids = {};                                                                             // 713
                                                                                                      // 714
  var updateCount = 0;                                                                                // 715
                                                                                                      // 716
  self._eachPossiblyMatchingDoc(selector, function (doc, id) {                                        // 717
    var queryResult = matcher.documentMatches(doc);                                                   // 718
    if (queryResult.result) {                                                                         // 719
      // XXX Should we save the original even if mod ends up being a no-op?                           // 720
      self._saveOriginal(id, doc);                                                                    // 721
      self._modifyAndNotify(doc, mod, recomputeQids, queryResult.arrayIndices);                       // 722
      ++updateCount;                                                                                  // 723
      if (!options.multi)                                                                             // 724
        return false;  // break                                                                       // 725
    }                                                                                                 // 726
    return true;                                                                                      // 727
  });                                                                                                 // 728
                                                                                                      // 729
  _.each(recomputeQids, function (dummy, qid) {                                                       // 730
    var query = self.queries[qid];                                                                    // 731
    if (query)                                                                                        // 732
      LocalCollection._recomputeResults(query,                                                        // 733
                                        qidToOriginalResults[qid]);                                   // 734
  });                                                                                                 // 735
  self._observeQueue.drain();                                                                         // 736
                                                                                                      // 737
  // If we are doing an upsert, and we didn't modify any documents yet, then                          // 738
  // it's time to do an insert. Figure out what document we are inserting, and                        // 739
  // generate an id for it.                                                                           // 740
  var insertedId;                                                                                     // 741
  if (updateCount === 0 && options.upsert) {                                                          // 742
    var newDoc = LocalCollection._removeDollarOperators(selector);                                    // 743
    LocalCollection._modify(newDoc, mod, {isInsert: true});                                           // 744
    if (! newDoc._id && options.insertedId)                                                           // 745
      newDoc._id = options.insertedId;                                                                // 746
    insertedId = self.insert(newDoc);                                                                 // 747
    updateCount = 1;                                                                                  // 748
  }                                                                                                   // 749
                                                                                                      // 750
  // Return the number of affected documents, or in the upsert case, an object                        // 751
  // containing the number of affected docs and the id of the doc that was                            // 752
  // inserted, if any.                                                                                // 753
  var result;                                                                                         // 754
  if (options._returnObject) {                                                                        // 755
    result = {                                                                                        // 756
      numberAffected: updateCount                                                                     // 757
    };                                                                                                // 758
    if (insertedId !== undefined)                                                                     // 759
      result.insertedId = insertedId;                                                                 // 760
  } else {                                                                                            // 761
    result = updateCount;                                                                             // 762
  }                                                                                                   // 763
                                                                                                      // 764
  if (callback)                                                                                       // 765
    Meteor.defer(function () {                                                                        // 766
      callback(null, result);                                                                         // 767
    });                                                                                               // 768
  return result;                                                                                      // 769
};                                                                                                    // 770
                                                                                                      // 771
// A convenience wrapper on update. LocalCollection.upsert(sel, mod) is                               // 772
// equivalent to LocalCollection.update(sel, mod, { upsert: true, _returnObject:                      // 773
// true }).                                                                                           // 774
LocalCollection.prototype.upsert = function (selector, mod, options, callback) {                      // 775
  var self = this;                                                                                    // 776
  if (! callback && typeof options === "function") {                                                  // 777
    callback = options;                                                                               // 778
    options = {};                                                                                     // 779
  }                                                                                                   // 780
  return self.update(selector, mod, _.extend({}, options, {                                           // 781
    upsert: true,                                                                                     // 782
    _returnObject: true                                                                               // 783
  }), callback);                                                                                      // 784
};                                                                                                    // 785
                                                                                                      // 786
LocalCollection.prototype._modifyAndNotify = function (                                               // 787
    doc, mod, recomputeQids, arrayIndices) {                                                          // 788
  var self = this;                                                                                    // 789
                                                                                                      // 790
  var matched_before = {};                                                                            // 791
  for (var qid in self.queries) {                                                                     // 792
    var query = self.queries[qid];                                                                    // 793
    if (query.ordered) {                                                                              // 794
      matched_before[qid] = query.matcher.documentMatches(doc).result;                                // 795
    } else {                                                                                          // 796
      // Because we don't support skip or limit (yet) in unordered queries, we                        // 797
      // can just do a direct lookup.                                                                 // 798
      matched_before[qid] = query.results.has(doc._id);                                               // 799
    }                                                                                                 // 800
  }                                                                                                   // 801
                                                                                                      // 802
  var old_doc = EJSON.clone(doc);                                                                     // 803
                                                                                                      // 804
  LocalCollection._modify(doc, mod, {arrayIndices: arrayIndices});                                    // 805
                                                                                                      // 806
  for (qid in self.queries) {                                                                         // 807
    query = self.queries[qid];                                                                        // 808
    var before = matched_before[qid];                                                                 // 809
    var afterMatch = query.matcher.documentMatches(doc);                                              // 810
    var after = afterMatch.result;                                                                    // 811
    if (after && query.distances && afterMatch.distance !== undefined)                                // 812
      query.distances.set(doc._id, afterMatch.distance);                                              // 813
                                                                                                      // 814
    if (query.cursor.skip || query.cursor.limit) {                                                    // 815
      // We need to recompute any query where the doc may have been in the                            // 816
      // cursor's window either before or after the update. (Note that if skip                        // 817
      // or limit is set, "before" and "after" being true do not necessarily                          // 818
      // mean that the document is in the cursor's output after skip/limit is                         // 819
      // applied... but if they are false, then the document definitely is NOT                        // 820
      // in the output. So it's safe to skip recompute if neither before or                           // 821
      // after are true.)                                                                             // 822
      if (before || after)                                                                            // 823
        recomputeQids[qid] = true;                                                                    // 824
    } else if (before && !after) {                                                                    // 825
      LocalCollection._removeFromResults(query, doc);                                                 // 826
    } else if (!before && after) {                                                                    // 827
      LocalCollection._insertInResults(query, doc);                                                   // 828
    } else if (before && after) {                                                                     // 829
      LocalCollection._updateInResults(query, doc, old_doc);                                          // 830
    }                                                                                                 // 831
  }                                                                                                   // 832
};                                                                                                    // 833
                                                                                                      // 834
// XXX the sorted-query logic below is laughably inefficient. we'll                                   // 835
// need to come up with a better datastructure for this.                                              // 836
//                                                                                                    // 837
// XXX the logic for observing with a skip or a limit is even more                                    // 838
// laughably inefficient. we recompute the whole results every time!                                  // 839
                                                                                                      // 840
LocalCollection._insertInResults = function (query, doc) {                                            // 841
  var fields = EJSON.clone(doc);                                                                      // 842
  delete fields._id;                                                                                  // 843
  if (query.ordered) {                                                                                // 844
    if (!query.sorter) {                                                                              // 845
      query.addedBefore(doc._id, fields, null);                                                       // 846
      query.results.push(doc);                                                                        // 847
    } else {                                                                                          // 848
      var i = LocalCollection._insertInSortedList(                                                    // 849
        query.sorter.getComparator({distances: query.distances}),                                     // 850
        query.results, doc);                                                                          // 851
      var next = query.results[i+1];                                                                  // 852
      if (next)                                                                                       // 853
        next = next._id;                                                                              // 854
      else                                                                                            // 855
        next = null;                                                                                  // 856
      query.addedBefore(doc._id, fields, next);                                                       // 857
    }                                                                                                 // 858
    query.added(doc._id, fields);                                                                     // 859
  } else {                                                                                            // 860
    query.added(doc._id, fields);                                                                     // 861
    query.results.set(doc._id, doc);                                                                  // 862
  }                                                                                                   // 863
};                                                                                                    // 864
                                                                                                      // 865
LocalCollection._removeFromResults = function (query, doc) {                                          // 866
  if (query.ordered) {                                                                                // 867
    var i = LocalCollection._findInOrderedResults(query, doc);                                        // 868
    query.removed(doc._id);                                                                           // 869
    query.results.splice(i, 1);                                                                       // 870
  } else {                                                                                            // 871
    var id = doc._id;  // in case callback mutates doc                                                // 872
    query.removed(doc._id);                                                                           // 873
    query.results.remove(id);                                                                         // 874
  }                                                                                                   // 875
};                                                                                                    // 876
                                                                                                      // 877
LocalCollection._updateInResults = function (query, doc, old_doc) {                                   // 878
  if (!EJSON.equals(doc._id, old_doc._id))                                                            // 879
    throw new Error("Can't change a doc's _id while updating");                                       // 880
  var changedFields = LocalCollection._makeChangedFields(doc, old_doc);                               // 881
  if (!query.ordered) {                                                                               // 882
    if (!_.isEmpty(changedFields)) {                                                                  // 883
      query.changed(doc._id, changedFields);                                                          // 884
      query.results.set(doc._id, doc);                                                                // 885
    }                                                                                                 // 886
    return;                                                                                           // 887
  }                                                                                                   // 888
                                                                                                      // 889
  var orig_idx = LocalCollection._findInOrderedResults(query, doc);                                   // 890
                                                                                                      // 891
  if (!_.isEmpty(changedFields))                                                                      // 892
    query.changed(doc._id, changedFields);                                                            // 893
  if (!query.sorter)                                                                                  // 894
    return;                                                                                           // 895
                                                                                                      // 896
  // just take it out and put it back in again, and see if the index                                  // 897
  // changes                                                                                          // 898
  query.results.splice(orig_idx, 1);                                                                  // 899
  var new_idx = LocalCollection._insertInSortedList(                                                  // 900
    query.sorter.getComparator({distances: query.distances}),                                         // 901
    query.results, doc);                                                                              // 902
  if (orig_idx !== new_idx) {                                                                         // 903
    var next = query.results[new_idx+1];                                                              // 904
    if (next)                                                                                         // 905
      next = next._id;                                                                                // 906
    else                                                                                              // 907
      next = null;                                                                                    // 908
    query.movedBefore && query.movedBefore(doc._id, next);                                            // 909
  }                                                                                                   // 910
};                                                                                                    // 911
                                                                                                      // 912
// Recomputes the results of a query and runs observe callbacks for the                               // 913
// difference between the previous results and the current results (unless                            // 914
// paused). Used for skip/limit queries.                                                              // 915
//                                                                                                    // 916
// When this is used by insert or remove, it can just use query.results for the                       // 917
// old results (and there's no need to pass in oldResults), because these                             // 918
// operations don't mutate the documents in the collection. Update needs to pass                      // 919
// in an oldResults which was deep-copied before the modifier was applied.                            // 920
LocalCollection._recomputeResults = function (query, oldResults) {                                    // 921
  if (!oldResults)                                                                                    // 922
    oldResults = query.results;                                                                       // 923
  if (query.distances)                                                                                // 924
    query.distances.clear();                                                                          // 925
  query.results = query.cursor._getRawObjects({                                                       // 926
    ordered: query.ordered, distances: query.distances});                                             // 927
                                                                                                      // 928
  if (!query.paused) {                                                                                // 929
    LocalCollection._diffQueryChanges(                                                                // 930
      query.ordered, oldResults, query.results, query);                                               // 931
  }                                                                                                   // 932
};                                                                                                    // 933
                                                                                                      // 934
                                                                                                      // 935
LocalCollection._findInOrderedResults = function (query, doc) {                                       // 936
  if (!query.ordered)                                                                                 // 937
    throw new Error("Can't call _findInOrderedResults on unordered query");                           // 938
  for (var i = 0; i < query.results.length; i++)                                                      // 939
    if (query.results[i] === doc)                                                                     // 940
      return i;                                                                                       // 941
  throw Error("object missing from query");                                                           // 942
};                                                                                                    // 943
                                                                                                      // 944
// This binary search puts a value between any equal values, and the first                            // 945
// lesser value.                                                                                      // 946
LocalCollection._binarySearch = function (cmp, array, value) {                                        // 947
  var first = 0, rangeLength = array.length;                                                          // 948
                                                                                                      // 949
  while (rangeLength > 0) {                                                                           // 950
    var halfRange = Math.floor(rangeLength/2);                                                        // 951
    if (cmp(value, array[first + halfRange]) >= 0) {                                                  // 952
      first += halfRange + 1;                                                                         // 953
      rangeLength -= halfRange + 1;                                                                   // 954
    } else {                                                                                          // 955
      rangeLength = halfRange;                                                                        // 956
    }                                                                                                 // 957
  }                                                                                                   // 958
  return first;                                                                                       // 959
};                                                                                                    // 960
                                                                                                      // 961
LocalCollection._insertInSortedList = function (cmp, array, value) {                                  // 962
  if (array.length === 0) {                                                                           // 963
    array.push(value);                                                                                // 964
    return 0;                                                                                         // 965
  }                                                                                                   // 966
                                                                                                      // 967
  var idx = LocalCollection._binarySearch(cmp, array, value);                                         // 968
  array.splice(idx, 0, value);                                                                        // 969
  return idx;                                                                                         // 970
};                                                                                                    // 971
                                                                                                      // 972
// To track what documents are affected by a piece of code, call saveOriginals()                      // 973
// before it and retrieveOriginals() after it. retrieveOriginals returns an                           // 974
// object whose keys are the ids of the documents that were affected since the                        // 975
// call to saveOriginals(), and the values are equal to the document's contents                       // 976
// at the time of saveOriginals. (In the case of an inserted document, undefined                      // 977
// is the value.) You must alternate between calls to saveOriginals() and                             // 978
// retrieveOriginals().                                                                               // 979
LocalCollection.prototype.saveOriginals = function () {                                               // 980
  var self = this;                                                                                    // 981
  if (self._savedOriginals)                                                                           // 982
    throw new Error("Called saveOriginals twice without retrieveOriginals");                          // 983
  self._savedOriginals = new LocalCollection._IdMap;                                                  // 984
};                                                                                                    // 985
LocalCollection.prototype.retrieveOriginals = function () {                                           // 986
  var self = this;                                                                                    // 987
  if (!self._savedOriginals)                                                                          // 988
    throw new Error("Called retrieveOriginals without saveOriginals");                                // 989
                                                                                                      // 990
  var originals = self._savedOriginals;                                                               // 991
  self._savedOriginals = null;                                                                        // 992
  return originals;                                                                                   // 993
};                                                                                                    // 994
                                                                                                      // 995
LocalCollection.prototype._saveOriginal = function (id, doc) {                                        // 996
  var self = this;                                                                                    // 997
  // Are we even trying to save originals?                                                            // 998
  if (!self._savedOriginals)                                                                          // 999
    return;                                                                                           // 1000
  // Have we previously mutated the original (and so 'doc' is not actually                            // 1001
  // original)?  (Note the 'has' check rather than truth: we store undefined                          // 1002
  // here for inserted docs!)                                                                         // 1003
  if (self._savedOriginals.has(id))                                                                   // 1004
    return;                                                                                           // 1005
  self._savedOriginals.set(id, EJSON.clone(doc));                                                     // 1006
};                                                                                                    // 1007
                                                                                                      // 1008
// Pause the observers. No callbacks from observers will fire until                                   // 1009
// 'resumeObservers' is called.                                                                       // 1010
LocalCollection.prototype.pauseObservers = function () {                                              // 1011
  // No-op if already paused.                                                                         // 1012
  if (this.paused)                                                                                    // 1013
    return;                                                                                           // 1014
                                                                                                      // 1015
  // Set the 'paused' flag such that new observer messages don't fire.                                // 1016
  this.paused = true;                                                                                 // 1017
                                                                                                      // 1018
  // Take a snapshot of the query results for each query.                                             // 1019
  for (var qid in this.queries) {                                                                     // 1020
    var query = this.queries[qid];                                                                    // 1021
                                                                                                      // 1022
    query.resultsSnapshot = EJSON.clone(query.results);                                               // 1023
  }                                                                                                   // 1024
};                                                                                                    // 1025
                                                                                                      // 1026
// Resume the observers. Observers immediately receive change                                         // 1027
// notifications to bring them to the current state of the                                            // 1028
// database. Note that this is not just replaying all the changes that                                // 1029
// happened during the pause, it is a smarter 'coalesced' diff.                                       // 1030
LocalCollection.prototype.resumeObservers = function () {                                             // 1031
  var self = this;                                                                                    // 1032
  // No-op if not paused.                                                                             // 1033
  if (!this.paused)                                                                                   // 1034
    return;                                                                                           // 1035
                                                                                                      // 1036
  // Unset the 'paused' flag. Make sure to do this first, otherwise                                   // 1037
  // observer methods won't actually fire when we trigger them.                                       // 1038
  this.paused = false;                                                                                // 1039
                                                                                                      // 1040
  for (var qid in this.queries) {                                                                     // 1041
    var query = self.queries[qid];                                                                    // 1042
    // Diff the current results against the snapshot and send to observers.                           // 1043
    // pass the query object for its observer callbacks.                                              // 1044
    LocalCollection._diffQueryChanges(                                                                // 1045
      query.ordered, query.resultsSnapshot, query.results, query);                                    // 1046
    query.resultsSnapshot = null;                                                                     // 1047
  }                                                                                                   // 1048
  self._observeQueue.drain();                                                                         // 1049
};                                                                                                    // 1050
                                                                                                      // 1051
                                                                                                      // 1052
// NB: used by livedata                                                                               // 1053
LocalCollection._idStringify = function (id) {                                                        // 1054
  if (id instanceof LocalCollection._ObjectID) {                                                      // 1055
    return id.valueOf();                                                                              // 1056
  } else if (typeof id === 'string') {                                                                // 1057
    if (id === "") {                                                                                  // 1058
      return id;                                                                                      // 1059
    } else if (id.substr(0, 1) === "-" || // escape previously dashed strings                         // 1060
               id.substr(0, 1) === "~" || // escape escaped numbers, true, false                      // 1061
               LocalCollection._looksLikeObjectID(id) || // escape object-id-form strings             // 1062
               id.substr(0, 1) === '{') { // escape object-form strings, for maybe implementing later // 1063
      return "-" + id;                                                                                // 1064
    } else {                                                                                          // 1065
      return id; // other strings go through unchanged.                                               // 1066
    }                                                                                                 // 1067
  } else if (id === undefined) {                                                                      // 1068
    return '-';                                                                                       // 1069
  } else if (typeof id === 'object' && id !== null) {                                                 // 1070
    throw new Error("Meteor does not currently support objects other than ObjectID as ids");          // 1071
  } else { // Numbers, true, false, null                                                              // 1072
    return "~" + JSON.stringify(id);                                                                  // 1073
  }                                                                                                   // 1074
};                                                                                                    // 1075
                                                                                                      // 1076
                                                                                                      // 1077
// NB: used by livedata                                                                               // 1078
LocalCollection._idParse = function (id) {                                                            // 1079
  if (id === "") {                                                                                    // 1080
    return id;                                                                                        // 1081
  } else if (id === '-') {                                                                            // 1082
    return undefined;                                                                                 // 1083
  } else if (id.substr(0, 1) === '-') {                                                               // 1084
    return id.substr(1);                                                                              // 1085
  } else if (id.substr(0, 1) === '~') {                                                               // 1086
    return JSON.parse(id.substr(1));                                                                  // 1087
  } else if (LocalCollection._looksLikeObjectID(id)) {                                                // 1088
    return new LocalCollection._ObjectID(id);                                                         // 1089
  } else {                                                                                            // 1090
    return id;                                                                                        // 1091
  }                                                                                                   // 1092
};                                                                                                    // 1093
                                                                                                      // 1094
LocalCollection._makeChangedFields = function (newDoc, oldDoc) {                                      // 1095
  var fields = {};                                                                                    // 1096
  LocalCollection._diffObjects(oldDoc, newDoc, {                                                      // 1097
    leftOnly: function (key, value) {                                                                 // 1098
      fields[key] = undefined;                                                                        // 1099
    },                                                                                                // 1100
    rightOnly: function (key, value) {                                                                // 1101
      fields[key] = value;                                                                            // 1102
    },                                                                                                // 1103
    both: function (key, leftValue, rightValue) {                                                     // 1104
      if (!EJSON.equals(leftValue, rightValue))                                                       // 1105
        fields[key] = rightValue;                                                                     // 1106
    }                                                                                                 // 1107
  });                                                                                                 // 1108
  return fields;                                                                                      // 1109
};                                                                                                    // 1110
                                                                                                      // 1111
////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                    //
// packages/minimongo/wrap_transform.js                                                               //
//                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                      //
// Wrap a transform function to return objects that have the _id field                                // 1
// of the untransformed document. This ensures that subsystems such as                                // 2
// the observe-sequence package that call `observe` can keep track of                                 // 3
// the documents identities.                                                                          // 4
//                                                                                                    // 5
// - Require that it returns objects                                                                  // 6
// - If the return value has an _id field, verify that it matches the                                 // 7
//   original _id field                                                                               // 8
// - If the return value doesn't have an _id field, add it back.                                      // 9
LocalCollection.wrapTransform = function (transform) {                                                // 10
  if (!transform)                                                                                     // 11
    return null;                                                                                      // 12
                                                                                                      // 13
  return function (doc) {                                                                             // 14
    if (!_.has(doc, '_id')) {                                                                         // 15
      // XXX do we ever have a transform on the oplog's collection? because that                      // 16
      // collection has no _id.                                                                       // 17
      throw new Error("can only transform documents with _id");                                       // 18
    }                                                                                                 // 19
                                                                                                      // 20
    var id = doc._id;                                                                                 // 21
    // XXX consider making tracker a weak dependency and checking Package.tracker here                // 22
    var transformed = Tracker.nonreactive(function () {                                               // 23
      return transform(doc);                                                                          // 24
    });                                                                                               // 25
                                                                                                      // 26
    if (!isPlainObject(transformed)) {                                                                // 27
      throw new Error("transform must return object");                                                // 28
    }                                                                                                 // 29
                                                                                                      // 30
    if (_.has(transformed, '_id')) {                                                                  // 31
      if (!EJSON.equals(transformed._id, id)) {                                                       // 32
        throw new Error("transformed document can't have different _id");                             // 33
      }                                                                                               // 34
    } else {                                                                                          // 35
      transformed._id = id;                                                                           // 36
    }                                                                                                 // 37
    return transformed;                                                                               // 38
  };                                                                                                  // 39
};                                                                                                    // 40
                                                                                                      // 41
////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                    //
// packages/minimongo/helpers.js                                                                      //
//                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                      //
// Like _.isArray, but doesn't regard polyfilled Uint8Arrays on old browsers as                       // 1
// arrays.                                                                                            // 2
// XXX maybe this should be EJSON.isArray                                                             // 3
isArray = function (x) {                                                                              // 4
  return _.isArray(x) && !EJSON.isBinary(x);                                                          // 5
};                                                                                                    // 6
                                                                                                      // 7
// XXX maybe this should be EJSON.isObject, though EJSON doesn't know about                           // 8
// RegExp                                                                                             // 9
// XXX note that _type(undefined) === 3!!!!                                                           // 10
isPlainObject = LocalCollection._isPlainObject = function (x) {                                       // 11
  return x && LocalCollection._f._type(x) === 3;                                                      // 12
};                                                                                                    // 13
                                                                                                      // 14
isIndexable = function (x) {                                                                          // 15
  return isArray(x) || isPlainObject(x);                                                              // 16
};                                                                                                    // 17
                                                                                                      // 18
// Returns true if this is an object with at least one key and all keys begin                         // 19
// with $.  Unless inconsistentOK is set, throws if some keys begin with $ and                        // 20
// others don't.                                                                                      // 21
isOperatorObject = function (valueSelector, inconsistentOK) {                                         // 22
  if (!isPlainObject(valueSelector))                                                                  // 23
    return false;                                                                                     // 24
                                                                                                      // 25
  var theseAreOperators = undefined;                                                                  // 26
  _.each(valueSelector, function (value, selKey) {                                                    // 27
    var thisIsOperator = selKey.substr(0, 1) === '$';                                                 // 28
    if (theseAreOperators === undefined) {                                                            // 29
      theseAreOperators = thisIsOperator;                                                             // 30
    } else if (theseAreOperators !== thisIsOperator) {                                                // 31
      if (!inconsistentOK)                                                                            // 32
        throw new Error("Inconsistent operator: " +                                                   // 33
                        JSON.stringify(valueSelector));                                               // 34
      theseAreOperators = false;                                                                      // 35
    }                                                                                                 // 36
  });                                                                                                 // 37
  return !!theseAreOperators;  // {} has no operators                                                 // 38
};                                                                                                    // 39
                                                                                                      // 40
                                                                                                      // 41
// string can be converted to integer                                                                 // 42
isNumericKey = function (s) {                                                                         // 43
  return /^[0-9]+$/.test(s);                                                                          // 44
};                                                                                                    // 45
                                                                                                      // 46
////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                    //
// packages/minimongo/selector.js                                                                     //
//                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                      //
// The minimongo selector compiler!                                                                   // 1
                                                                                                      // 2
// Terminology:                                                                                       // 3
//  - a "selector" is the EJSON object representing a selector                                        // 4
//  - a "matcher" is its compiled form (whether a full Minimongo.Matcher                              // 5
//    object or one of the component lambdas that matches parts of it)                                // 6
//  - a "result object" is an object with a "result" field and maybe                                  // 7
//    distance and arrayIndices.                                                                      // 8
//  - a "branched value" is an object with a "value" field and maybe                                  // 9
//    "dontIterate" and "arrayIndices".                                                               // 10
//  - a "document" is a top-level object that can be stored in a collection.                          // 11
//  - a "lookup function" is a function that takes in a document and returns                          // 12
//    an array of "branched values".                                                                  // 13
//  - a "branched matcher" maps from an array of branched values to a result                          // 14
//    object.                                                                                         // 15
//  - an "element matcher" maps from a single value to a bool.                                        // 16
                                                                                                      // 17
// Main entry point.                                                                                  // 18
//   var matcher = new Minimongo.Matcher({a: {$gt: 5}});                                              // 19
//   if (matcher.documentMatches({a: 7})) ...                                                         // 20
Minimongo.Matcher = function (selector) {                                                             // 21
  var self = this;                                                                                    // 22
  // A set (object mapping string -> *) of all of the document paths looked                           // 23
  // at by the selector. Also includes the empty string if it may look at any                         // 24
  // path (eg, $where).                                                                               // 25
  self._paths = {};                                                                                   // 26
  // Set to true if compilation finds a $near.                                                        // 27
  self._hasGeoQuery = false;                                                                          // 28
  // Set to true if compilation finds a $where.                                                       // 29
  self._hasWhere = false;                                                                             // 30
  // Set to false if compilation finds anything other than a simple equality or                       // 31
  // one or more of '$gt', '$gte', '$lt', '$lte', '$ne', '$in', '$nin' used with                      // 32
  // scalars as operands.                                                                             // 33
  self._isSimple = true;                                                                              // 34
  // Set to a dummy document which always matches this Matcher. Or set to null                        // 35
  // if such document is too hard to find.                                                            // 36
  self._matchingDocument = undefined;                                                                 // 37
  // A clone of the original selector. It may just be a function if the user                          // 38
  // passed in a function; otherwise is definitely an object (eg, IDs are                             // 39
  // translated into {_id: ID} first. Used by canBecomeTrueByModifier and                             // 40
  // Sorter._useWithMatcher.                                                                          // 41
  self._selector = null;                                                                              // 42
  self._docMatcher = self._compileSelector(selector);                                                 // 43
};                                                                                                    // 44
                                                                                                      // 45
_.extend(Minimongo.Matcher.prototype, {                                                               // 46
  documentMatches: function (doc) {                                                                   // 47
    if (!doc || typeof doc !== "object") {                                                            // 48
      throw Error("documentMatches needs a document");                                                // 49
    }                                                                                                 // 50
    return this._docMatcher(doc);                                                                     // 51
  },                                                                                                  // 52
  hasGeoQuery: function () {                                                                          // 53
    return this._hasGeoQuery;                                                                         // 54
  },                                                                                                  // 55
  hasWhere: function () {                                                                             // 56
    return this._hasWhere;                                                                            // 57
  },                                                                                                  // 58
  isSimple: function () {                                                                             // 59
    return this._isSimple;                                                                            // 60
  },                                                                                                  // 61
                                                                                                      // 62
  // Given a selector, return a function that takes one argument, a                                   // 63
  // document. It returns a result object.                                                            // 64
  _compileSelector: function (selector) {                                                             // 65
    var self = this;                                                                                  // 66
    // you can pass a literal function instead of a selector                                          // 67
    if (selector instanceof Function) {                                                               // 68
      self._isSimple = false;                                                                         // 69
      self._selector = selector;                                                                      // 70
      self._recordPathUsed('');                                                                       // 71
      return function (doc) {                                                                         // 72
        return {result: !!selector.call(doc)};                                                        // 73
      };                                                                                              // 74
    }                                                                                                 // 75
                                                                                                      // 76
    // shorthand -- scalars match _id                                                                 // 77
    if (LocalCollection._selectorIsId(selector)) {                                                    // 78
      self._selector = {_id: selector};                                                               // 79
      self._recordPathUsed('_id');                                                                    // 80
      return function (doc) {                                                                         // 81
        return {result: EJSON.equals(doc._id, selector)};                                             // 82
      };                                                                                              // 83
    }                                                                                                 // 84
                                                                                                      // 85
    // protect against dangerous selectors.  falsey and {_id: falsey} are both                        // 86
    // likely programmer error, and not what you want, particularly for                               // 87
    // destructive operations.                                                                        // 88
    if (!selector || (('_id' in selector) && !selector._id)) {                                        // 89
      self._isSimple = false;                                                                         // 90
      return nothingMatcher;                                                                          // 91
    }                                                                                                 // 92
                                                                                                      // 93
    // Top level can't be an array or true or binary.                                                 // 94
    if (typeof(selector) === 'boolean' || isArray(selector) ||                                        // 95
        EJSON.isBinary(selector))                                                                     // 96
      throw new Error("Invalid selector: " + selector);                                               // 97
                                                                                                      // 98
    self._selector = EJSON.clone(selector);                                                           // 99
    return compileDocumentSelector(selector, self, {isRoot: true});                                   // 100
  },                                                                                                  // 101
  _recordPathUsed: function (path) {                                                                  // 102
    this._paths[path] = true;                                                                         // 103
  },                                                                                                  // 104
  // Returns a list of key paths the given selector is looking for. It includes                       // 105
  // the empty string if there is a $where.                                                           // 106
  _getPaths: function () {                                                                            // 107
    return _.keys(this._paths);                                                                       // 108
  }                                                                                                   // 109
});                                                                                                   // 110
                                                                                                      // 111
                                                                                                      // 112
// Takes in a selector that could match a full document (eg, the original                             // 113
// selector). Returns a function mapping document->result object.                                     // 114
//                                                                                                    // 115
// matcher is the Matcher object we are compiling.                                                    // 116
//                                                                                                    // 117
// If this is the root document selector (ie, not wrapped in $and or the like),                       // 118
// then isRoot is true. (This is used by $near.)                                                      // 119
var compileDocumentSelector = function (docSelector, matcher, options) {                              // 120
  options = options || {};                                                                            // 121
  var docMatchers = [];                                                                               // 122
  _.each(docSelector, function (subSelector, key) {                                                   // 123
    if (key.substr(0, 1) === '$') {                                                                   // 124
      // Outer operators are either logical operators (they recurse back into                         // 125
      // this function), or $where.                                                                   // 126
      if (!_.has(LOGICAL_OPERATORS, key))                                                             // 127
        throw new Error("Unrecognized logical operator: " + key);                                     // 128
      matcher._isSimple = false;                                                                      // 129
      docMatchers.push(LOGICAL_OPERATORS[key](subSelector, matcher,                                   // 130
                                              options.inElemMatch));                                  // 131
    } else {                                                                                          // 132
      // Record this path, but only if we aren't in an elemMatcher, since in an                       // 133
      // elemMatch this is a path inside an object in an array, not in the doc                        // 134
      // root.                                                                                        // 135
      if (!options.inElemMatch)                                                                       // 136
        matcher._recordPathUsed(key);                                                                 // 137
      var lookUpByIndex = makeLookupFunction(key);                                                    // 138
      var valueMatcher =                                                                              // 139
        compileValueSelector(subSelector, matcher, options.isRoot);                                   // 140
      docMatchers.push(function (doc) {                                                               // 141
        var branchValues = lookUpByIndex(doc);                                                        // 142
        return valueMatcher(branchValues);                                                            // 143
      });                                                                                             // 144
    }                                                                                                 // 145
  });                                                                                                 // 146
                                                                                                      // 147
  return andDocumentMatchers(docMatchers);                                                            // 148
};                                                                                                    // 149
                                                                                                      // 150
// Takes in a selector that could match a key-indexed value in a document; eg,                        // 151
// {$gt: 5, $lt: 9}, or a regular expression, or any non-expression object (to                        // 152
// indicate equality).  Returns a branched matcher: a function mapping                                // 153
// [branched value]->result object.                                                                   // 154
var compileValueSelector = function (valueSelector, matcher, isRoot) {                                // 155
  if (valueSelector instanceof RegExp) {                                                              // 156
    matcher._isSimple = false;                                                                        // 157
    return convertElementMatcherToBranchedMatcher(                                                    // 158
      regexpElementMatcher(valueSelector));                                                           // 159
  } else if (isOperatorObject(valueSelector)) {                                                       // 160
    return operatorBranchedMatcher(valueSelector, matcher, isRoot);                                   // 161
  } else {                                                                                            // 162
    return convertElementMatcherToBranchedMatcher(                                                    // 163
      equalityElementMatcher(valueSelector));                                                         // 164
  }                                                                                                   // 165
};                                                                                                    // 166
                                                                                                      // 167
// Given an element matcher (which evaluates a single value), returns a branched                      // 168
// value (which evaluates the element matcher on all the branches and returns a                       // 169
// more structured return value possibly including arrayIndices).                                     // 170
var convertElementMatcherToBranchedMatcher = function (                                               // 171
    elementMatcher, options) {                                                                        // 172
  options = options || {};                                                                            // 173
  return function (branches) {                                                                        // 174
    var expanded = branches;                                                                          // 175
    if (!options.dontExpandLeafArrays) {                                                              // 176
      expanded = expandArraysInBranches(                                                              // 177
        branches, options.dontIncludeLeafArrays);                                                     // 178
    }                                                                                                 // 179
    var ret = {};                                                                                     // 180
    ret.result = _.any(expanded, function (element) {                                                 // 181
      var matched = elementMatcher(element.value);                                                    // 182
                                                                                                      // 183
      // Special case for $elemMatch: it means "true, and use this as an array                        // 184
      // index if I didn't already have one".                                                         // 185
      if (typeof matched === 'number') {                                                              // 186
        // XXX This code dates from when we only stored a single array index                          // 187
        // (for the outermost array). Should we be also including deeper array                        // 188
        // indices from the $elemMatch match?                                                         // 189
        if (!element.arrayIndices)                                                                    // 190
          element.arrayIndices = [matched];                                                           // 191
        matched = true;                                                                               // 192
      }                                                                                               // 193
                                                                                                      // 194
      // If some element matched, and it's tagged with array indices, include                         // 195
      // those indices in our result object.                                                          // 196
      if (matched && element.arrayIndices)                                                            // 197
        ret.arrayIndices = element.arrayIndices;                                                      // 198
                                                                                                      // 199
      return matched;                                                                                 // 200
    });                                                                                               // 201
    return ret;                                                                                       // 202
  };                                                                                                  // 203
};                                                                                                    // 204
                                                                                                      // 205
// Takes a RegExp object and returns an element matcher.                                              // 206
regexpElementMatcher = function (regexp) {                                                            // 207
  return function (value) {                                                                           // 208
    if (value instanceof RegExp) {                                                                    // 209
      // Comparing two regexps means seeing if the regexps are identical                              // 210
      // (really!). Underscore knows how.                                                             // 211
      return _.isEqual(value, regexp);                                                                // 212
    }                                                                                                 // 213
    // Regexps only work against strings.                                                             // 214
    if (typeof value !== 'string')                                                                    // 215
      return false;                                                                                   // 216
    return regexp.test(value);                                                                        // 217
  };                                                                                                  // 218
};                                                                                                    // 219
                                                                                                      // 220
// Takes something that is not an operator object and returns an element matcher                      // 221
// for equality with that thing.                                                                      // 222
equalityElementMatcher = function (elementSelector) {                                                 // 223
  if (isOperatorObject(elementSelector))                                                              // 224
    throw Error("Can't create equalityValueSelector for operator object");                            // 225
                                                                                                      // 226
  // Special-case: null and undefined are equal (if you got undefined in there                        // 227
  // somewhere, or if you got it due to some branch being non-existent in the                         // 228
  // weird special case), even though they aren't with EJSON.equals.                                  // 229
  if (elementSelector == null) {  // undefined or null                                                // 230
    return function (value) {                                                                         // 231
      return value == null;  // undefined or null                                                     // 232
    };                                                                                                // 233
  }                                                                                                   // 234
                                                                                                      // 235
  return function (value) {                                                                           // 236
    return LocalCollection._f._equal(elementSelector, value);                                         // 237
  };                                                                                                  // 238
};                                                                                                    // 239
                                                                                                      // 240
// Takes an operator object (an object with $ keys) and returns a branched                            // 241
// matcher for it.                                                                                    // 242
var operatorBranchedMatcher = function (valueSelector, matcher, isRoot) {                             // 243
  // Each valueSelector works separately on the various branches.  So one                             // 244
  // operator can match one branch and another can match another branch.  This                        // 245
  // is OK.                                                                                           // 246
                                                                                                      // 247
  var operatorMatchers = [];                                                                          // 248
  _.each(valueSelector, function (operand, operator) {                                                // 249
    // XXX we should actually implement $eq, which is new in 2.6                                      // 250
    var simpleRange = _.contains(['$lt', '$lte', '$gt', '$gte'], operator) &&                         // 251
      _.isNumber(operand);                                                                            // 252
    var simpleInequality = operator === '$ne' && !_.isObject(operand);                                // 253
    var simpleInclusion = _.contains(['$in', '$nin'], operator) &&                                    // 254
      _.isArray(operand) && !_.any(operand, _.isObject);                                              // 255
                                                                                                      // 256
    if (! (operator === '$eq' || simpleRange ||                                                       // 257
           simpleInclusion || simpleInequality)) {                                                    // 258
      matcher._isSimple = false;                                                                      // 259
    }                                                                                                 // 260
                                                                                                      // 261
    if (_.has(VALUE_OPERATORS, operator)) {                                                           // 262
      operatorMatchers.push(                                                                          // 263
        VALUE_OPERATORS[operator](operand, valueSelector, matcher, isRoot));                          // 264
    } else if (_.has(ELEMENT_OPERATORS, operator)) {                                                  // 265
      var options = ELEMENT_OPERATORS[operator];                                                      // 266
      operatorMatchers.push(                                                                          // 267
        convertElementMatcherToBranchedMatcher(                                                       // 268
          options.compileElementSelector(                                                             // 269
            operand, valueSelector, matcher),                                                         // 270
          options));                                                                                  // 271
    } else {                                                                                          // 272
      throw new Error("Unrecognized operator: " + operator);                                          // 273
    }                                                                                                 // 274
  });                                                                                                 // 275
                                                                                                      // 276
  return andBranchedMatchers(operatorMatchers);                                                       // 277
};                                                                                                    // 278
                                                                                                      // 279
var compileArrayOfDocumentSelectors = function (                                                      // 280
    selectors, matcher, inElemMatch) {                                                                // 281
  if (!isArray(selectors) || _.isEmpty(selectors))                                                    // 282
    throw Error("$and/$or/$nor must be nonempty array");                                              // 283
  return _.map(selectors, function (subSelector) {                                                    // 284
    if (!isPlainObject(subSelector))                                                                  // 285
      throw Error("$or/$and/$nor entries need to be full objects");                                   // 286
    return compileDocumentSelector(                                                                   // 287
      subSelector, matcher, {inElemMatch: inElemMatch});                                              // 288
  });                                                                                                 // 289
};                                                                                                    // 290
                                                                                                      // 291
// Operators that appear at the top level of a document selector.                                     // 292
var LOGICAL_OPERATORS = {                                                                             // 293
  $and: function (subSelector, matcher, inElemMatch) {                                                // 294
    var matchers = compileArrayOfDocumentSelectors(                                                   // 295
      subSelector, matcher, inElemMatch);                                                             // 296
    return andDocumentMatchers(matchers);                                                             // 297
  },                                                                                                  // 298
                                                                                                      // 299
  $or: function (subSelector, matcher, inElemMatch) {                                                 // 300
    var matchers = compileArrayOfDocumentSelectors(                                                   // 301
      subSelector, matcher, inElemMatch);                                                             // 302
                                                                                                      // 303
    // Special case: if there is only one matcher, use it directly, *preserving*                      // 304
    // any arrayIndices it returns.                                                                   // 305
    if (matchers.length === 1)                                                                        // 306
      return matchers[0];                                                                             // 307
                                                                                                      // 308
    return function (doc) {                                                                           // 309
      var result = _.any(matchers, function (f) {                                                     // 310
        return f(doc).result;                                                                         // 311
      });                                                                                             // 312
      // $or does NOT set arrayIndices when it has multiple                                           // 313
      // sub-expressions. (Tested against MongoDB.)                                                   // 314
      return {result: result};                                                                        // 315
    };                                                                                                // 316
  },                                                                                                  // 317
                                                                                                      // 318
  $nor: function (subSelector, matcher, inElemMatch) {                                                // 319
    var matchers = compileArrayOfDocumentSelectors(                                                   // 320
      subSelector, matcher, inElemMatch);                                                             // 321
    return function (doc) {                                                                           // 322
      var result = _.all(matchers, function (f) {                                                     // 323
        return !f(doc).result;                                                                        // 324
      });                                                                                             // 325
      // Never set arrayIndices, because we only match if nothing in particular                       // 326
      // "matched" (and because this is consistent with MongoDB).                                     // 327
      return {result: result};                                                                        // 328
    };                                                                                                // 329
  },                                                                                                  // 330
                                                                                                      // 331
  $where: function (selectorValue, matcher) {                                                         // 332
    // Record that *any* path may be used.                                                            // 333
    matcher._recordPathUsed('');                                                                      // 334
    matcher._hasWhere = true;                                                                         // 335
    if (!(selectorValue instanceof Function)) {                                                       // 336
      // XXX MongoDB seems to have more complex logic to decide where or or not                       // 337
      // to add "return"; not sure exactly what it is.                                                // 338
      selectorValue = Function("obj", "return " + selectorValue);                                     // 339
    }                                                                                                 // 340
    return function (doc) {                                                                           // 341
      // We make the document available as both `this` and `obj`.                                     // 342
      // XXX not sure what we should do if this throws                                                // 343
      return {result: selectorValue.call(doc, doc)};                                                  // 344
    };                                                                                                // 345
  },                                                                                                  // 346
                                                                                                      // 347
  // This is just used as a comment in the query (in MongoDB, it also ends up in                      // 348
  // query logs); it has no effect on the actual selection.                                           // 349
  $comment: function () {                                                                             // 350
    return function () {                                                                              // 351
      return {result: true};                                                                          // 352
    };                                                                                                // 353
  }                                                                                                   // 354
};                                                                                                    // 355
                                                                                                      // 356
// Returns a branched matcher that matches iff the given matcher does not.                            // 357
// Note that this implicitly "deMorganizes" the wrapped function.  ie, it                             // 358
// means that ALL branch values need to fail to match innerBranchedMatcher.                           // 359
var invertBranchedMatcher = function (branchedMatcher) {                                              // 360
  return function (branchValues) {                                                                    // 361
    var invertMe = branchedMatcher(branchValues);                                                     // 362
    // We explicitly choose to strip arrayIndices here: it doesn't make sense to                      // 363
    // say "update the array element that does not match something", at least                         // 364
    // in mongo-land.                                                                                 // 365
    return {result: !invertMe.result};                                                                // 366
  };                                                                                                  // 367
};                                                                                                    // 368
                                                                                                      // 369
// Operators that (unlike LOGICAL_OPERATORS) pertain to individual paths in a                         // 370
// document, but (unlike ELEMENT_OPERATORS) do not have a simple definition as                        // 371
// "match each branched value independently and combine with                                          // 372
// convertElementMatcherToBranchedMatcher".                                                           // 373
var VALUE_OPERATORS = {                                                                               // 374
  $not: function (operand, valueSelector, matcher) {                                                  // 375
    return invertBranchedMatcher(compileValueSelector(operand, matcher));                             // 376
  },                                                                                                  // 377
  $ne: function (operand) {                                                                           // 378
    return invertBranchedMatcher(convertElementMatcherToBranchedMatcher(                              // 379
      equalityElementMatcher(operand)));                                                              // 380
  },                                                                                                  // 381
  $nin: function (operand) {                                                                          // 382
    return invertBranchedMatcher(convertElementMatcherToBranchedMatcher(                              // 383
      ELEMENT_OPERATORS.$in.compileElementSelector(operand)));                                        // 384
  },                                                                                                  // 385
  $exists: function (operand) {                                                                       // 386
    var exists = convertElementMatcherToBranchedMatcher(function (value) {                            // 387
      return value !== undefined;                                                                     // 388
    });                                                                                               // 389
    return operand ? exists : invertBranchedMatcher(exists);                                          // 390
  },                                                                                                  // 391
  // $options just provides options for $regex; its logic is inside $regex                            // 392
  $options: function (operand, valueSelector) {                                                       // 393
    if (!_.has(valueSelector, '$regex'))                                                              // 394
      throw Error("$options needs a $regex");                                                         // 395
    return everythingMatcher;                                                                         // 396
  },                                                                                                  // 397
  // $maxDistance is basically an argument to $near                                                   // 398
  $maxDistance: function (operand, valueSelector) {                                                   // 399
    if (!valueSelector.$near)                                                                         // 400
      throw Error("$maxDistance needs a $near");                                                      // 401
    return everythingMatcher;                                                                         // 402
  },                                                                                                  // 403
  $all: function (operand, valueSelector, matcher) {                                                  // 404
    if (!isArray(operand))                                                                            // 405
      throw Error("$all requires array");                                                             // 406
    // Not sure why, but this seems to be what MongoDB does.                                          // 407
    if (_.isEmpty(operand))                                                                           // 408
      return nothingMatcher;                                                                          // 409
                                                                                                      // 410
    var branchedMatchers = [];                                                                        // 411
    _.each(operand, function (criterion) {                                                            // 412
      // XXX handle $all/$elemMatch combination                                                       // 413
      if (isOperatorObject(criterion))                                                                // 414
        throw Error("no $ expressions in $all");                                                      // 415
      // This is always a regexp or equality selector.                                                // 416
      branchedMatchers.push(compileValueSelector(criterion, matcher));                                // 417
    });                                                                                               // 418
    // andBranchedMatchers does NOT require all selectors to return true on the                       // 419
    // SAME branch.                                                                                   // 420
    return andBranchedMatchers(branchedMatchers);                                                     // 421
  },                                                                                                  // 422
  $near: function (operand, valueSelector, matcher, isRoot) {                                         // 423
    if (!isRoot)                                                                                      // 424
      throw Error("$near can't be inside another $ operator");                                        // 425
    matcher._hasGeoQuery = true;                                                                      // 426
                                                                                                      // 427
    // There are two kinds of geodata in MongoDB: coordinate pairs and                                // 428
    // GeoJSON. They use different distance metrics, too. GeoJSON queries are                         // 429
    // marked with a $geometry property.                                                              // 430
                                                                                                      // 431
    var maxDistance, point, distance;                                                                 // 432
    if (isPlainObject(operand) && _.has(operand, '$geometry')) {                                      // 433
      // GeoJSON "2dsphere" mode.                                                                     // 434
      maxDistance = operand.$maxDistance;                                                             // 435
      point = operand.$geometry;                                                                      // 436
      distance = function (value) {                                                                   // 437
        // XXX: for now, we don't calculate the actual distance between, say,                         // 438
        // polygon and circle. If people care about this use-case it will get                         // 439
        // a priority.                                                                                // 440
        if (!value || !value.type)                                                                    // 441
          return null;                                                                                // 442
        if (value.type === "Point") {                                                                 // 443
          return GeoJSON.pointDistance(point, value);                                                 // 444
        } else {                                                                                      // 445
          return GeoJSON.geometryWithinRadius(value, point, maxDistance)                              // 446
            ? 0 : maxDistance + 1;                                                                    // 447
        }                                                                                             // 448
      };                                                                                              // 449
    } else {                                                                                          // 450
      maxDistance = valueSelector.$maxDistance;                                                       // 451
      if (!isArray(operand) && !isPlainObject(operand))                                               // 452
        throw Error("$near argument must be coordinate pair or GeoJSON");                             // 453
      point = pointToArray(operand);                                                                  // 454
      distance = function (value) {                                                                   // 455
        if (!isArray(value) && !isPlainObject(value))                                                 // 456
          return null;                                                                                // 457
        return distanceCoordinatePairs(point, value);                                                 // 458
      };                                                                                              // 459
    }                                                                                                 // 460
                                                                                                      // 461
    return function (branchedValues) {                                                                // 462
      // There might be multiple points in the document that match the given                          // 463
      // field. Only one of them needs to be within $maxDistance, but we need to                      // 464
      // evaluate all of them and use the nearest one for the implicit sort                           // 465
      // specifier. (That's why we can't just use ELEMENT_OPERATORS here.)                            // 466
      //                                                                                              // 467
      // Note: This differs from MongoDB's implementation, where a document will                      // 468
      // actually show up *multiple times* in the result set, with one entry for                      // 469
      // each within-$maxDistance branching point.                                                    // 470
      branchedValues = expandArraysInBranches(branchedValues);                                        // 471
      var result = {result: false};                                                                   // 472
      _.each(branchedValues, function (branch) {                                                      // 473
        var curDistance = distance(branch.value);                                                     // 474
        // Skip branches that aren't real points or are too far away.                                 // 475
        if (curDistance === null || curDistance > maxDistance)                                        // 476
          return;                                                                                     // 477
        // Skip anything that's a tie.                                                                // 478
        if (result.distance !== undefined && result.distance <= curDistance)                          // 479
          return;                                                                                     // 480
        result.result = true;                                                                         // 481
        result.distance = curDistance;                                                                // 482
        if (!branch.arrayIndices)                                                                     // 483
          delete result.arrayIndices;                                                                 // 484
        else                                                                                          // 485
          result.arrayIndices = branch.arrayIndices;                                                  // 486
      });                                                                                             // 487
      return result;                                                                                  // 488
    };                                                                                                // 489
  }                                                                                                   // 490
};                                                                                                    // 491
                                                                                                      // 492
// Helpers for $near.                                                                                 // 493
var distanceCoordinatePairs = function (a, b) {                                                       // 494
  a = pointToArray(a);                                                                                // 495
  b = pointToArray(b);                                                                                // 496
  var x = a[0] - b[0];                                                                                // 497
  var y = a[1] - b[1];                                                                                // 498
  if (_.isNaN(x) || _.isNaN(y))                                                                       // 499
    return null;                                                                                      // 500
  return Math.sqrt(x * x + y * y);                                                                    // 501
};                                                                                                    // 502
// Makes sure we get 2 elements array and assume the first one to be x and                            // 503
// the second one to y no matter what user passes.                                                    // 504
// In case user passes { lon: x, lat: y } returns [x, y]                                              // 505
var pointToArray = function (point) {                                                                 // 506
  return _.map(point, _.identity);                                                                    // 507
};                                                                                                    // 508
                                                                                                      // 509
// Helper for $lt/$gt/$lte/$gte.                                                                      // 510
var makeInequality = function (cmpValueComparator) {                                                  // 511
  return {                                                                                            // 512
    compileElementSelector: function (operand) {                                                      // 513
      // Arrays never compare false with non-arrays for any inequality.                               // 514
      // XXX This was behavior we observed in pre-release MongoDB 2.5, but                            // 515
      //     it seems to have been reverted.                                                          // 516
      //     See https://jira.mongodb.org/browse/SERVER-11444                                         // 517
      if (isArray(operand)) {                                                                         // 518
        return function () {                                                                          // 519
          return false;                                                                               // 520
        };                                                                                            // 521
      }                                                                                               // 522
                                                                                                      // 523
      // Special case: consider undefined and null the same (so true with                             // 524
      // $gte/$lte).                                                                                  // 525
      if (operand === undefined)                                                                      // 526
        operand = null;                                                                               // 527
                                                                                                      // 528
      var operandType = LocalCollection._f._type(operand);                                            // 529
                                                                                                      // 530
      return function (value) {                                                                       // 531
        if (value === undefined)                                                                      // 532
          value = null;                                                                               // 533
        // Comparisons are never true among things of different type (except                          // 534
        // null vs undefined).                                                                        // 535
        if (LocalCollection._f._type(value) !== operandType)                                          // 536
          return false;                                                                               // 537
        return cmpValueComparator(LocalCollection._f._cmp(value, operand));                           // 538
      };                                                                                              // 539
    }                                                                                                 // 540
  };                                                                                                  // 541
};                                                                                                    // 542
                                                                                                      // 543
// Each element selector contains:                                                                    // 544
//  - compileElementSelector, a function with args:                                                   // 545
//    - operand - the "right hand side" of the operator                                               // 546
//    - valueSelector - the "context" for the operator (so that $regex can find                       // 547
//      $options)                                                                                     // 548
//    - matcher - the Matcher this is going into (so that $elemMatch can compile                      // 549
//      more things)                                                                                  // 550
//    returning a function mapping a single value to bool.                                            // 551
//  - dontExpandLeafArrays, a bool which prevents expandArraysInBranches from                         // 552
//    being called                                                                                    // 553
//  - dontIncludeLeafArrays, a bool which causes an argument to be passed to                          // 554
//    expandArraysInBranches if it is called                                                          // 555
ELEMENT_OPERATORS = {                                                                                 // 556
  $lt: makeInequality(function (cmpValue) {                                                           // 557
    return cmpValue < 0;                                                                              // 558
  }),                                                                                                 // 559
  $gt: makeInequality(function (cmpValue) {                                                           // 560
    return cmpValue > 0;                                                                              // 561
  }),                                                                                                 // 562
  $lte: makeInequality(function (cmpValue) {                                                          // 563
    return cmpValue <= 0;                                                                             // 564
  }),                                                                                                 // 565
  $gte: makeInequality(function (cmpValue) {                                                          // 566
    return cmpValue >= 0;                                                                             // 567
  }),                                                                                                 // 568
  $mod: {                                                                                             // 569
    compileElementSelector: function (operand) {                                                      // 570
      if (!(isArray(operand) && operand.length === 2                                                  // 571
            && typeof(operand[0]) === 'number'                                                        // 572
            && typeof(operand[1]) === 'number')) {                                                    // 573
        throw Error("argument to $mod must be an array of two numbers");                              // 574
      }                                                                                               // 575
      // XXX could require to be ints or round or something                                           // 576
      var divisor = operand[0];                                                                       // 577
      var remainder = operand[1];                                                                     // 578
      return function (value) {                                                                       // 579
        return typeof value === 'number' && value % divisor === remainder;                            // 580
      };                                                                                              // 581
    }                                                                                                 // 582
  },                                                                                                  // 583
  $in: {                                                                                              // 584
    compileElementSelector: function (operand) {                                                      // 585
      if (!isArray(operand))                                                                          // 586
        throw Error("$in needs an array");                                                            // 587
                                                                                                      // 588
      var elementMatchers = [];                                                                       // 589
      _.each(operand, function (option) {                                                             // 590
        if (option instanceof RegExp)                                                                 // 591
          elementMatchers.push(regexpElementMatcher(option));                                         // 592
        else if (isOperatorObject(option))                                                            // 593
          throw Error("cannot nest $ under $in");                                                     // 594
        else                                                                                          // 595
          elementMatchers.push(equalityElementMatcher(option));                                       // 596
      });                                                                                             // 597
                                                                                                      // 598
      return function (value) {                                                                       // 599
        // Allow {a: {$in: [null]}} to match when 'a' does not exist.                                 // 600
        if (value === undefined)                                                                      // 601
          value = null;                                                                               // 602
        return _.any(elementMatchers, function (e) {                                                  // 603
          return e(value);                                                                            // 604
        });                                                                                           // 605
      };                                                                                              // 606
    }                                                                                                 // 607
  },                                                                                                  // 608
  $size: {                                                                                            // 609
    // {a: [[5, 5]]} must match {a: {$size: 1}} but not {a: {$size: 2}}, so we                        // 610
    // don't want to consider the element [5,5] in the leaf array [[5,5]] as a                        // 611
    // possible value.                                                                                // 612
    dontExpandLeafArrays: true,                                                                       // 613
    compileElementSelector: function (operand) {                                                      // 614
      if (typeof operand === 'string') {                                                              // 615
        // Don't ask me why, but by experimentation, this seems to be what Mongo                      // 616
        // does.                                                                                      // 617
        operand = 0;                                                                                  // 618
      } else if (typeof operand !== 'number') {                                                       // 619
        throw Error("$size needs a number");                                                          // 620
      }                                                                                               // 621
      return function (value) {                                                                       // 622
        return isArray(value) && value.length === operand;                                            // 623
      };                                                                                              // 624
    }                                                                                                 // 625
  },                                                                                                  // 626
  $type: {                                                                                            // 627
    // {a: [5]} must not match {a: {$type: 4}} (4 means array), but it should                         // 628
    // match {a: {$type: 1}} (1 means number), and {a: [[5]]} must match {$a:                         // 629
    // {$type: 4}}. Thus, when we see a leaf array, we *should* expand it but                         // 630
    // should *not* include it itself.                                                                // 631
    dontIncludeLeafArrays: true,                                                                      // 632
    compileElementSelector: function (operand) {                                                      // 633
      if (typeof operand !== 'number')                                                                // 634
        throw Error("$type needs a number");                                                          // 635
      return function (value) {                                                                       // 636
        return value !== undefined                                                                    // 637
          && LocalCollection._f._type(value) === operand;                                             // 638
      };                                                                                              // 639
    }                                                                                                 // 640
  },                                                                                                  // 641
  $regex: {                                                                                           // 642
    compileElementSelector: function (operand, valueSelector) {                                       // 643
      if (!(typeof operand === 'string' || operand instanceof RegExp))                                // 644
        throw Error("$regex has to be a string or RegExp");                                           // 645
                                                                                                      // 646
      var regexp;                                                                                     // 647
      if (valueSelector.$options !== undefined) {                                                     // 648
        // Options passed in $options (even the empty string) always overrides                        // 649
        // options in the RegExp object itself. (See also                                             // 650
        // Mongo.Collection._rewriteSelector.)                                                        // 651
                                                                                                      // 652
        // Be clear that we only support the JS-supported options, not extended                       // 653
        // ones (eg, Mongo supports x and s). Ideally we would implement x and s                      // 654
        // by transforming the regexp, but not today...                                               // 655
        if (/[^gim]/.test(valueSelector.$options))                                                    // 656
          throw new Error("Only the i, m, and g regexp options are supported");                       // 657
                                                                                                      // 658
        var regexSource = operand instanceof RegExp ? operand.source : operand;                       // 659
        regexp = new RegExp(regexSource, valueSelector.$options);                                     // 660
      } else if (operand instanceof RegExp) {                                                         // 661
        regexp = operand;                                                                             // 662
      } else {                                                                                        // 663
        regexp = new RegExp(operand);                                                                 // 664
      }                                                                                               // 665
      return regexpElementMatcher(regexp);                                                            // 666
    }                                                                                                 // 667
  },                                                                                                  // 668
  $elemMatch: {                                                                                       // 669
    dontExpandLeafArrays: true,                                                                       // 670
    compileElementSelector: function (operand, valueSelector, matcher) {                              // 671
      if (!isPlainObject(operand))                                                                    // 672
        throw Error("$elemMatch need an object");                                                     // 673
                                                                                                      // 674
      var subMatcher, isDocMatcher;                                                                   // 675
      if (isOperatorObject(operand, true)) {                                                          // 676
        subMatcher = compileValueSelector(operand, matcher);                                          // 677
        isDocMatcher = false;                                                                         // 678
      } else {                                                                                        // 679
        // This is NOT the same as compileValueSelector(operand), and not just                        // 680
        // because of the slightly different calling convention.                                      // 681
        // {$elemMatch: {x: 3}} means "an element has a field x:3", not                               // 682
        // "consists only of a field x:3". Also, regexps and sub-$ are allowed.                       // 683
        subMatcher = compileDocumentSelector(operand, matcher,                                        // 684
                                             {inElemMatch: true});                                    // 685
        isDocMatcher = true;                                                                          // 686
      }                                                                                               // 687
                                                                                                      // 688
      return function (value) {                                                                       // 689
        if (!isArray(value))                                                                          // 690
          return false;                                                                               // 691
        for (var i = 0; i < value.length; ++i) {                                                      // 692
          var arrayElement = value[i];                                                                // 693
          var arg;                                                                                    // 694
          if (isDocMatcher) {                                                                         // 695
            // We can only match {$elemMatch: {b: 3}} against objects.                                // 696
            // (We can also match against arrays, if there's numeric indices,                         // 697
            // eg {$elemMatch: {'0.b': 3}} or {$elemMatch: {0: 3}}.)                                  // 698
            if (!isPlainObject(arrayElement) && !isArray(arrayElement))                               // 699
              return false;                                                                           // 700
            arg = arrayElement;                                                                       // 701
          } else {                                                                                    // 702
            // dontIterate ensures that {a: {$elemMatch: {$gt: 5}}} matches                           // 703
            // {a: [8]} but not {a: [[8]]}                                                            // 704
            arg = [{value: arrayElement, dontIterate: true}];                                         // 705
          }                                                                                           // 706
          // XXX support $near in $elemMatch by propagating $distance?                                // 707
          if (subMatcher(arg).result)                                                                 // 708
            return i;   // specially understood to mean "use as arrayIndices"                         // 709
        }                                                                                             // 710
        return false;                                                                                 // 711
      };                                                                                              // 712
    }                                                                                                 // 713
  }                                                                                                   // 714
};                                                                                                    // 715
                                                                                                      // 716
// makeLookupFunction(key) returns a lookup function.                                                 // 717
//                                                                                                    // 718
// A lookup function takes in a document and returns an array of matching                             // 719
// branches.  If no arrays are found while looking up the key, this array will                        // 720
// have exactly one branches (possibly 'undefined', if some segment of the key                        // 721
// was not found).                                                                                    // 722
//                                                                                                    // 723
// If arrays are found in the middle, this can have more than one element, since                      // 724
// we "branch". When we "branch", if there are more key segments to look up,                          // 725
// then we only pursue branches that are plain objects (not arrays or scalars).                       // 726
// This means we can actually end up with no branches!                                                // 727
//                                                                                                    // 728
// We do *NOT* branch on arrays that are found at the end (ie, at the last                            // 729
// dotted member of the key). We just return that array; if you want to                               // 730
// effectively "branch" over the array's values, post-process the lookup                              // 731
// function with expandArraysInBranches.                                                              // 732
//                                                                                                    // 733
// Each branch is an object with keys:                                                                // 734
//  - value: the value at the branch                                                                  // 735
//  - dontIterate: an optional bool; if true, it means that 'value' is an array                       // 736
//    that expandArraysInBranches should NOT expand. This specifically happens                        // 737
//    when there is a numeric index in the key, and ensures the                                       // 738
//    perhaps-surprising MongoDB behavior where {'a.0': 5} does NOT                                   // 739
//    match {a: [[5]]}.                                                                               // 740
//  - arrayIndices: if any array indexing was done during lookup (either due to                       // 741
//    explicit numeric indices or implicit branching), this will be an array of                       // 742
//    the array indices used, from outermost to innermost; it is falsey or                            // 743
//    absent if no array index is used. If an explicit numeric index is used,                         // 744
//    the index will be followed in arrayIndices by the string 'x'.                                   // 745
//                                                                                                    // 746
//    Note: arrayIndices is used for two purposes. First, it is used to                               // 747
//    implement the '$' modifier feature, which only ever looks at its first                          // 748
//    element.                                                                                        // 749
//                                                                                                    // 750
//    Second, it is used for sort key generation, which needs to be able to tell                      // 751
//    the difference between different paths. Moreover, it needs to                                   // 752
//    differentiate between explicit and implicit branching, which is why                             // 753
//    there's the somewhat hacky 'x' entry: this means that explicit and                              // 754
//    implicit array lookups will have different full arrayIndices paths. (That                       // 755
//    code only requires that different paths have different arrayIndices; it                         // 756
//    doesn't actually "parse" arrayIndices. As an alternative, arrayIndices                          // 757
//    could contain objects with flags like "implicit", but I think that only                         // 758
//    makes the code surrounding them more complex.)                                                  // 759
//                                                                                                    // 760
//    (By the way, this field ends up getting passed around a lot without                             // 761
//    cloning, so never mutate any arrayIndices field/var in this package!)                           // 762
//                                                                                                    // 763
//                                                                                                    // 764
// At the top level, you may only pass in a plain object or array.                                    // 765
//                                                                                                    // 766
// See the test 'minimongo - lookup' for some examples of what lookup functions                       // 767
// return.                                                                                            // 768
makeLookupFunction = function (key, options) {                                                        // 769
  options = options || {};                                                                            // 770
  var parts = key.split('.');                                                                         // 771
  var firstPart = parts.length ? parts[0] : '';                                                       // 772
  var firstPartIsNumeric = isNumericKey(firstPart);                                                   // 773
  var nextPartIsNumeric = parts.length >= 2 && isNumericKey(parts[1]);                                // 774
  var lookupRest;                                                                                     // 775
  if (parts.length > 1) {                                                                             // 776
    lookupRest = makeLookupFunction(parts.slice(1).join('.'));                                        // 777
  }                                                                                                   // 778
                                                                                                      // 779
  var elideUnnecessaryFields = function (retVal) {                                                    // 780
    if (!retVal.dontIterate)                                                                          // 781
      delete retVal.dontIterate;                                                                      // 782
    if (retVal.arrayIndices && !retVal.arrayIndices.length)                                           // 783
      delete retVal.arrayIndices;                                                                     // 784
    return retVal;                                                                                    // 785
  };                                                                                                  // 786
                                                                                                      // 787
  // Doc will always be a plain object or an array.                                                   // 788
  // apply an explicit numeric index, an array.                                                       // 789
  return function (doc, arrayIndices) {                                                               // 790
    if (!arrayIndices)                                                                                // 791
      arrayIndices = [];                                                                              // 792
                                                                                                      // 793
    if (isArray(doc)) {                                                                               // 794
      // If we're being asked to do an invalid lookup into an array (non-integer                      // 795
      // or out-of-bounds), return no results (which is different from returning                      // 796
      // a single undefined result, in that `null` equality checks won't match).                      // 797
      if (!(firstPartIsNumeric && firstPart < doc.length))                                            // 798
        return [];                                                                                    // 799
                                                                                                      // 800
      // Remember that we used this array index. Include an 'x' to indicate that                      // 801
      // the previous index came from being considered as an explicit array                           // 802
      // index (not branching).                                                                       // 803
      arrayIndices = arrayIndices.concat(+firstPart, 'x');                                            // 804
    }                                                                                                 // 805
                                                                                                      // 806
    // Do our first lookup.                                                                           // 807
    var firstLevel = doc[firstPart];                                                                  // 808
                                                                                                      // 809
    // If there is no deeper to dig, return what we found.                                            // 810
    //                                                                                                // 811
    // If what we found is an array, most value selectors will choose to treat                        // 812
    // the elements of the array as matchable values in their own right, but                          // 813
    // that's done outside of the lookup function. (Exceptions to this are $size                      // 814
    // and stuff relating to $elemMatch.  eg, {a: {$size: 2}} does not match {a:                      // 815
    // [[1, 2]]}.)                                                                                    // 816
    //                                                                                                // 817
    // That said, if we just did an *explicit* array lookup (on doc) to find                          // 818
    // firstLevel, and firstLevel is an array too, we do NOT want value                               // 819
    // selectors to iterate over it.  eg, {'a.0': 5} does not match {a: [[5]]}.                       // 820
    // So in that case, we mark the return value as "don't iterate".                                  // 821
    if (!lookupRest) {                                                                                // 822
      return [elideUnnecessaryFields({                                                                // 823
        value: firstLevel,                                                                            // 824
        dontIterate: isArray(doc) && isArray(firstLevel),                                             // 825
        arrayIndices: arrayIndices})];                                                                // 826
    }                                                                                                 // 827
                                                                                                      // 828
    // We need to dig deeper.  But if we can't, because what we've found is not                       // 829
    // an array or plain object, we're done. If we just did a numeric index into                      // 830
    // an array, we return nothing here (this is a change in Mongo 2.5 from                           // 831
    // Mongo 2.4, where {'a.0.b': null} stopped matching {a: [5]}). Otherwise,                        // 832
    // return a single `undefined` (which can, for example, match via equality                        // 833
    // with `null`).                                                                                  // 834
    if (!isIndexable(firstLevel)) {                                                                   // 835
      if (isArray(doc))                                                                               // 836
        return [];                                                                                    // 837
      return [elideUnnecessaryFields({value: undefined,                                               // 838
                                      arrayIndices: arrayIndices})];                                  // 839
    }                                                                                                 // 840
                                                                                                      // 841
    var result = [];                                                                                  // 842
    var appendToResult = function (more) {                                                            // 843
      Array.prototype.push.apply(result, more);                                                       // 844
    };                                                                                                // 845
                                                                                                      // 846
    // Dig deeper: look up the rest of the parts on whatever we've found.                             // 847
    // (lookupRest is smart enough to not try to do invalid lookups into                              // 848
    // firstLevel if it's an array.)                                                                  // 849
    appendToResult(lookupRest(firstLevel, arrayIndices));                                             // 850
                                                                                                      // 851
    // If we found an array, then in *addition* to potentially treating the next                      // 852
    // part as a literal integer lookup, we should also "branch": try to look up                      // 853
    // the rest of the parts on each array element in parallel.                                       // 854
    //                                                                                                // 855
    // In this case, we *only* dig deeper into array elements that are plain                          // 856
    // objects. (Recall that we only got this far if we have further to dig.)                         // 857
    // This makes sense: we certainly don't dig deeper into non-indexable                             // 858
    // objects. And it would be weird to dig into an array: it's simpler to have                      // 859
    // a rule that explicit integer indexes only apply to an outer array, not to                      // 860
    // an array you find after a branching search.                                                    // 861
    //                                                                                                // 862
    // In the special case of a numeric part in a *sort selector* (not a query                        // 863
    // selector), we skip the branching: we ONLY allow the numeric part to mean                       // 864
    // "look up this index" in that case, not "also look up this index in all                         // 865
    // the elements of the array".                                                                    // 866
    if (isArray(firstLevel) && !(nextPartIsNumeric && options.forSort)) {                             // 867
      _.each(firstLevel, function (branch, arrayIndex) {                                              // 868
        if (isPlainObject(branch)) {                                                                  // 869
          appendToResult(lookupRest(                                                                  // 870
            branch,                                                                                   // 871
            arrayIndices.concat(arrayIndex)));                                                        // 872
        }                                                                                             // 873
      });                                                                                             // 874
    }                                                                                                 // 875
                                                                                                      // 876
    return result;                                                                                    // 877
  };                                                                                                  // 878
};                                                                                                    // 879
MinimongoTest.makeLookupFunction = makeLookupFunction;                                                // 880
                                                                                                      // 881
expandArraysInBranches = function (branches, skipTheArrays) {                                         // 882
  var branchesOut = [];                                                                               // 883
  _.each(branches, function (branch) {                                                                // 884
    var thisIsArray = isArray(branch.value);                                                          // 885
    // We include the branch itself, *UNLESS* we it's an array that we're going                       // 886
    // to iterate and we're told to skip arrays.  (That's right, we include some                      // 887
    // arrays even skipTheArrays is true: these are arrays that were found via                        // 888
    // explicit numerical indices.)                                                                   // 889
    if (!(skipTheArrays && thisIsArray && !branch.dontIterate)) {                                     // 890
      branchesOut.push({                                                                              // 891
        value: branch.value,                                                                          // 892
        arrayIndices: branch.arrayIndices                                                             // 893
      });                                                                                             // 894
    }                                                                                                 // 895
    if (thisIsArray && !branch.dontIterate) {                                                         // 896
      _.each(branch.value, function (leaf, i) {                                                       // 897
        branchesOut.push({                                                                            // 898
          value: leaf,                                                                                // 899
          arrayIndices: (branch.arrayIndices || []).concat(i)                                         // 900
        });                                                                                           // 901
      });                                                                                             // 902
    }                                                                                                 // 903
  });                                                                                                 // 904
  return branchesOut;                                                                                 // 905
};                                                                                                    // 906
                                                                                                      // 907
var nothingMatcher = function (docOrBranchedValues) {                                                 // 908
  return {result: false};                                                                             // 909
};                                                                                                    // 910
                                                                                                      // 911
var everythingMatcher = function (docOrBranchedValues) {                                              // 912
  return {result: true};                                                                              // 913
};                                                                                                    // 914
                                                                                                      // 915
                                                                                                      // 916
// NB: We are cheating and using this function to implement "AND" for both                            // 917
// "document matchers" and "branched matchers". They both return result objects                       // 918
// but the argument is different: for the former it's a whole doc, whereas for                        // 919
// the latter it's an array of "branched values".                                                     // 920
var andSomeMatchers = function (subMatchers) {                                                        // 921
  if (subMatchers.length === 0)                                                                       // 922
    return everythingMatcher;                                                                         // 923
  if (subMatchers.length === 1)                                                                       // 924
    return subMatchers[0];                                                                            // 925
                                                                                                      // 926
  return function (docOrBranches) {                                                                   // 927
    var ret = {};                                                                                     // 928
    ret.result = _.all(subMatchers, function (f) {                                                    // 929
      var subResult = f(docOrBranches);                                                               // 930
      // Copy a 'distance' number out of the first sub-matcher that has                               // 931
      // one. Yes, this means that if there are multiple $near fields in a                            // 932
      // query, something arbitrary happens; this appears to be consistent with                       // 933
      // Mongo.                                                                                       // 934
      if (subResult.result && subResult.distance !== undefined                                        // 935
          && ret.distance === undefined) {                                                            // 936
        ret.distance = subResult.distance;                                                            // 937
      }                                                                                               // 938
      // Similarly, propagate arrayIndices from sub-matchers... but to match                          // 939
      // MongoDB behavior, this time the *last* sub-matcher with arrayIndices                         // 940
      // wins.                                                                                        // 941
      if (subResult.result && subResult.arrayIndices) {                                               // 942
        ret.arrayIndices = subResult.arrayIndices;                                                    // 943
      }                                                                                               // 944
      return subResult.result;                                                                        // 945
    });                                                                                               // 946
                                                                                                      // 947
    // If we didn't actually match, forget any extra metadata we came up with.                        // 948
    if (!ret.result) {                                                                                // 949
      delete ret.distance;                                                                            // 950
      delete ret.arrayIndices;                                                                        // 951
    }                                                                                                 // 952
    return ret;                                                                                       // 953
  };                                                                                                  // 954
};                                                                                                    // 955
                                                                                                      // 956
var andDocumentMatchers = andSomeMatchers;                                                            // 957
var andBranchedMatchers = andSomeMatchers;                                                            // 958
                                                                                                      // 959
                                                                                                      // 960
// helpers used by compiled selector code                                                             // 961
LocalCollection._f = {                                                                                // 962
  // XXX for _all and _in, consider building 'inquery' at compile time..                              // 963
                                                                                                      // 964
  _type: function (v) {                                                                               // 965
    if (typeof v === "number")                                                                        // 966
      return 1;                                                                                       // 967
    if (typeof v === "string")                                                                        // 968
      return 2;                                                                                       // 969
    if (typeof v === "boolean")                                                                       // 970
      return 8;                                                                                       // 971
    if (isArray(v))                                                                                   // 972
      return 4;                                                                                       // 973
    if (v === null)                                                                                   // 974
      return 10;                                                                                      // 975
    if (v instanceof RegExp)                                                                          // 976
      // note that typeof(/x/) === "object"                                                           // 977
      return 11;                                                                                      // 978
    if (typeof v === "function")                                                                      // 979
      return 13;                                                                                      // 980
    if (v instanceof Date)                                                                            // 981
      return 9;                                                                                       // 982
    if (EJSON.isBinary(v))                                                                            // 983
      return 5;                                                                                       // 984
    if (v instanceof LocalCollection._ObjectID)                                                       // 985
      return 7;                                                                                       // 986
    return 3; // object                                                                               // 987
                                                                                                      // 988
    // XXX support some/all of these:                                                                 // 989
    // 14, symbol                                                                                     // 990
    // 15, javascript code with scope                                                                 // 991
    // 16, 18: 32-bit/64-bit integer                                                                  // 992
    // 17, timestamp                                                                                  // 993
    // 255, minkey                                                                                    // 994
    // 127, maxkey                                                                                    // 995
  },                                                                                                  // 996
                                                                                                      // 997
  // deep equality test: use for literal document and array matches                                   // 998
  _equal: function (a, b) {                                                                           // 999
    return EJSON.equals(a, b, {keyOrderSensitive: true});                                             // 1000
  },                                                                                                  // 1001
                                                                                                      // 1002
  // maps a type code to a value that can be used to sort values of                                   // 1003
  // different types                                                                                  // 1004
  _typeorder: function (t) {                                                                          // 1005
    // http://www.mongodb.org/display/DOCS/What+is+the+Compare+Order+for+BSON+Types                   // 1006
    // XXX what is the correct sort position for Javascript code?                                     // 1007
    // ('100' in the matrix below)                                                                    // 1008
    // XXX minkey/maxkey                                                                              // 1009
    return [-1,  // (not a type)                                                                      // 1010
            1,   // number                                                                            // 1011
            2,   // string                                                                            // 1012
            3,   // object                                                                            // 1013
            4,   // array                                                                             // 1014
            5,   // binary                                                                            // 1015
            -1,  // deprecated                                                                        // 1016
            6,   // ObjectID                                                                          // 1017
            7,   // bool                                                                              // 1018
            8,   // Date                                                                              // 1019
            0,   // null                                                                              // 1020
            9,   // RegExp                                                                            // 1021
            -1,  // deprecated                                                                        // 1022
            100, // JS code                                                                           // 1023
            2,   // deprecated (symbol)                                                               // 1024
            100, // JS code                                                                           // 1025
            1,   // 32-bit int                                                                        // 1026
            8,   // Mongo timestamp                                                                   // 1027
            1    // 64-bit int                                                                        // 1028
           ][t];                                                                                      // 1029
  },                                                                                                  // 1030
                                                                                                      // 1031
  // compare two values of unknown type according to BSON ordering                                    // 1032
  // semantics. (as an extension, consider 'undefined' to be less than                                // 1033
  // any other value.) return negative if a is less, positive if b is                                 // 1034
  // less, or 0 if equal                                                                              // 1035
  _cmp: function (a, b) {                                                                             // 1036
    if (a === undefined)                                                                              // 1037
      return b === undefined ? 0 : -1;                                                                // 1038
    if (b === undefined)                                                                              // 1039
      return 1;                                                                                       // 1040
    var ta = LocalCollection._f._type(a);                                                             // 1041
    var tb = LocalCollection._f._type(b);                                                             // 1042
    var oa = LocalCollection._f._typeorder(ta);                                                       // 1043
    var ob = LocalCollection._f._typeorder(tb);                                                       // 1044
    if (oa !== ob)                                                                                    // 1045
      return oa < ob ? -1 : 1;                                                                        // 1046
    if (ta !== tb)                                                                                    // 1047
      // XXX need to implement this if we implement Symbol or integers, or                            // 1048
      // Timestamp                                                                                    // 1049
      throw Error("Missing type coercion logic in _cmp");                                             // 1050
    if (ta === 7) { // ObjectID                                                                       // 1051
      // Convert to string.                                                                           // 1052
      ta = tb = 2;                                                                                    // 1053
      a = a.toHexString();                                                                            // 1054
      b = b.toHexString();                                                                            // 1055
    }                                                                                                 // 1056
    if (ta === 9) { // Date                                                                           // 1057
      // Convert to millis.                                                                           // 1058
      ta = tb = 1;                                                                                    // 1059
      a = a.getTime();                                                                                // 1060
      b = b.getTime();                                                                                // 1061
    }                                                                                                 // 1062
                                                                                                      // 1063
    if (ta === 1) // double                                                                           // 1064
      return a - b;                                                                                   // 1065
    if (tb === 2) // string                                                                           // 1066
      return a < b ? -1 : (a === b ? 0 : 1);                                                          // 1067
    if (ta === 3) { // Object                                                                         // 1068
      // this could be much more efficient in the expected case ...                                   // 1069
      var to_array = function (obj) {                                                                 // 1070
        var ret = [];                                                                                 // 1071
        for (var key in obj) {                                                                        // 1072
          ret.push(key);                                                                              // 1073
          ret.push(obj[key]);                                                                         // 1074
        }                                                                                             // 1075
        return ret;                                                                                   // 1076
      };                                                                                              // 1077
      return LocalCollection._f._cmp(to_array(a), to_array(b));                                       // 1078
    }                                                                                                 // 1079
    if (ta === 4) { // Array                                                                          // 1080
      for (var i = 0; ; i++) {                                                                        // 1081
        if (i === a.length)                                                                           // 1082
          return (i === b.length) ? 0 : -1;                                                           // 1083
        if (i === b.length)                                                                           // 1084
          return 1;                                                                                   // 1085
        var s = LocalCollection._f._cmp(a[i], b[i]);                                                  // 1086
        if (s !== 0)                                                                                  // 1087
          return s;                                                                                   // 1088
      }                                                                                               // 1089
    }                                                                                                 // 1090
    if (ta === 5) { // binary                                                                         // 1091
      // Surprisingly, a small binary blob is always less than a large one in                         // 1092
      // Mongo.                                                                                       // 1093
      if (a.length !== b.length)                                                                      // 1094
        return a.length - b.length;                                                                   // 1095
      for (i = 0; i < a.length; i++) {                                                                // 1096
        if (a[i] < b[i])                                                                              // 1097
          return -1;                                                                                  // 1098
        if (a[i] > b[i])                                                                              // 1099
          return 1;                                                                                   // 1100
      }                                                                                               // 1101
      return 0;                                                                                       // 1102
    }                                                                                                 // 1103
    if (ta === 8) { // boolean                                                                        // 1104
      if (a) return b ? 0 : 1;                                                                        // 1105
      return b ? -1 : 0;                                                                              // 1106
    }                                                                                                 // 1107
    if (ta === 10) // null                                                                            // 1108
      return 0;                                                                                       // 1109
    if (ta === 11) // regexp                                                                          // 1110
      throw Error("Sorting not supported on regular expression"); // XXX                              // 1111
    // 13: javascript code                                                                            // 1112
    // 14: symbol                                                                                     // 1113
    // 15: javascript code with scope                                                                 // 1114
    // 16: 32-bit integer                                                                             // 1115
    // 17: timestamp                                                                                  // 1116
    // 18: 64-bit integer                                                                             // 1117
    // 255: minkey                                                                                    // 1118
    // 127: maxkey                                                                                    // 1119
    if (ta === 13) // javascript code                                                                 // 1120
      throw Error("Sorting not supported on Javascript code"); // XXX                                 // 1121
    throw Error("Unknown type to sort");                                                              // 1122
  }                                                                                                   // 1123
};                                                                                                    // 1124
                                                                                                      // 1125
// Oddball function used by upsert.                                                                   // 1126
LocalCollection._removeDollarOperators = function (selector) {                                        // 1127
  var selectorDoc = {};                                                                               // 1128
  for (var k in selector)                                                                             // 1129
    if (k.substr(0, 1) !== '$')                                                                       // 1130
      selectorDoc[k] = selector[k];                                                                   // 1131
  return selectorDoc;                                                                                 // 1132
};                                                                                                    // 1133
                                                                                                      // 1134
////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                    //
// packages/minimongo/sort.js                                                                         //
//                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                      //
// Give a sort spec, which can be in any of these forms:                                              // 1
//   {"key1": 1, "key2": -1}                                                                          // 2
//   [["key1", "asc"], ["key2", "desc"]]                                                              // 3
//   ["key1", ["key2", "desc"]]                                                                       // 4
//                                                                                                    // 5
// (.. with the first form being dependent on the key enumeration                                     // 6
// behavior of your javascript VM, which usually does what you mean in                                // 7
// this case if the key names don't look like integers ..)                                            // 8
//                                                                                                    // 9
// return a function that takes two objects, and returns -1 if the                                    // 10
// first object comes first in order, 1 if the second object comes                                    // 11
// first, or 0 if neither object comes before the other.                                              // 12
                                                                                                      // 13
Minimongo.Sorter = function (spec, options) {                                                         // 14
  var self = this;                                                                                    // 15
  options = options || {};                                                                            // 16
                                                                                                      // 17
  self._sortSpecParts = [];                                                                           // 18
                                                                                                      // 19
  var addSpecPart = function (path, ascending) {                                                      // 20
    if (!path)                                                                                        // 21
      throw Error("sort keys must be non-empty");                                                     // 22
    if (path.charAt(0) === '$')                                                                       // 23
      throw Error("unsupported sort key: " + path);                                                   // 24
    self._sortSpecParts.push({                                                                        // 25
      path: path,                                                                                     // 26
      lookup: makeLookupFunction(path, {forSort: true}),                                              // 27
      ascending: ascending                                                                            // 28
    });                                                                                               // 29
  };                                                                                                  // 30
                                                                                                      // 31
  if (spec instanceof Array) {                                                                        // 32
    for (var i = 0; i < spec.length; i++) {                                                           // 33
      if (typeof spec[i] === "string") {                                                              // 34
        addSpecPart(spec[i], true);                                                                   // 35
      } else {                                                                                        // 36
        addSpecPart(spec[i][0], spec[i][1] !== "desc");                                               // 37
      }                                                                                               // 38
    }                                                                                                 // 39
  } else if (typeof spec === "object") {                                                              // 40
    _.each(spec, function (value, key) {                                                              // 41
      addSpecPart(key, value >= 0);                                                                   // 42
    });                                                                                               // 43
  } else {                                                                                            // 44
    throw Error("Bad sort specification: " + JSON.stringify(spec));                                   // 45
  }                                                                                                   // 46
                                                                                                      // 47
  // To implement affectedByModifier, we piggy-back on top of Matcher's                               // 48
  // affectedByModifier code; we create a selector that is affected by the same                       // 49
  // modifiers as this sort order. This is only implemented on the server.                            // 50
  if (self.affectedByModifier) {                                                                      // 51
    var selector = {};                                                                                // 52
    _.each(self._sortSpecParts, function (spec) {                                                     // 53
      selector[spec.path] = 1;                                                                        // 54
    });                                                                                               // 55
    self._selectorForAffectedByModifier = new Minimongo.Matcher(selector);                            // 56
  }                                                                                                   // 57
                                                                                                      // 58
  self._keyComparator = composeComparators(                                                           // 59
    _.map(self._sortSpecParts, function (spec, i) {                                                   // 60
      return self._keyFieldComparator(i);                                                             // 61
    }));                                                                                              // 62
                                                                                                      // 63
  // If you specify a matcher for this Sorter, _keyFilter may be set to a                             // 64
  // function which selects whether or not a given "sort key" (tuple of values                        // 65
  // for the different sort spec fields) is compatible with the selector.                             // 66
  self._keyFilter = null;                                                                             // 67
  options.matcher && self._useWithMatcher(options.matcher);                                           // 68
};                                                                                                    // 69
                                                                                                      // 70
// In addition to these methods, sorter_project.js defines combineIntoProjection                      // 71
// on the server only.                                                                                // 72
_.extend(Minimongo.Sorter.prototype, {                                                                // 73
  getComparator: function (options) {                                                                 // 74
    var self = this;                                                                                  // 75
                                                                                                      // 76
    // If we have no distances, just use the comparator from the source                               // 77
    // specification (which defaults to "everything is equal".                                        // 78
    if (!options || !options.distances) {                                                             // 79
      return self._getBaseComparator();                                                               // 80
    }                                                                                                 // 81
                                                                                                      // 82
    var distances = options.distances;                                                                // 83
                                                                                                      // 84
    // Return a comparator which first tries the sort specification, and if that                      // 85
    // says "it's equal", breaks ties using $near distances.                                          // 86
    return composeComparators([self._getBaseComparator(), function (a, b) {                           // 87
      if (!distances.has(a._id))                                                                      // 88
        throw Error("Missing distance for " + a._id);                                                 // 89
      if (!distances.has(b._id))                                                                      // 90
        throw Error("Missing distance for " + b._id);                                                 // 91
      return distances.get(a._id) - distances.get(b._id);                                             // 92
    }]);                                                                                              // 93
  },                                                                                                  // 94
                                                                                                      // 95
  _getPaths: function () {                                                                            // 96
    var self = this;                                                                                  // 97
    return _.pluck(self._sortSpecParts, 'path');                                                      // 98
  },                                                                                                  // 99
                                                                                                      // 100
  // Finds the minimum key from the doc, according to the sort specs.  (We say                        // 101
  // "minimum" here but this is with respect to the sort spec, so "descending"                        // 102
  // sort fields mean we're finding the max for that field.)                                          // 103
  //                                                                                                  // 104
  // Note that this is NOT "find the minimum value of the first field, the                            // 105
  // minimum value of the second field, etc"... it's "choose the                                      // 106
  // lexicographically minimum value of the key vector, allowing only keys which                      // 107
  // you can find along the same paths".  ie, for a doc {a: [{x: 0, y: 5}, {x:                        // 108
  // 1, y: 3}]} with sort spec {'a.x': 1, 'a.y': 1}, the only keys are [0,5] and                      // 109
  // [1,3], and the minimum key is [0,5]; notably, [0,3] is NOT a key.                                // 110
  _getMinKeyFromDoc: function (doc) {                                                                 // 111
    var self = this;                                                                                  // 112
    var minKey = null;                                                                                // 113
                                                                                                      // 114
    self._generateKeysFromDoc(doc, function (key) {                                                   // 115
      if (!self._keyCompatibleWithSelector(key))                                                      // 116
        return;                                                                                       // 117
                                                                                                      // 118
      if (minKey === null) {                                                                          // 119
        minKey = key;                                                                                 // 120
        return;                                                                                       // 121
      }                                                                                               // 122
      if (self._compareKeys(key, minKey) < 0) {                                                       // 123
        minKey = key;                                                                                 // 124
      }                                                                                               // 125
    });                                                                                               // 126
                                                                                                      // 127
    // This could happen if our key filter somehow filters out all the keys even                      // 128
    // though somehow the selector matches.                                                           // 129
    if (minKey === null)                                                                              // 130
      throw Error("sort selector found no keys in doc?");                                             // 131
    return minKey;                                                                                    // 132
  },                                                                                                  // 133
                                                                                                      // 134
  _keyCompatibleWithSelector: function (key) {                                                        // 135
    var self = this;                                                                                  // 136
    return !self._keyFilter || self._keyFilter(key);                                                  // 137
  },                                                                                                  // 138
                                                                                                      // 139
  // Iterates over each possible "key" from doc (ie, over each branch), calling                       // 140
  // 'cb' with the key.                                                                               // 141
  _generateKeysFromDoc: function (doc, cb) {                                                          // 142
    var self = this;                                                                                  // 143
                                                                                                      // 144
    if (self._sortSpecParts.length === 0)                                                             // 145
      throw new Error("can't generate keys without a spec");                                          // 146
                                                                                                      // 147
    // maps index -> ({'' -> value} or {path -> value})                                               // 148
    var valuesByIndexAndPath = [];                                                                    // 149
                                                                                                      // 150
    var pathFromIndices = function (indices) {                                                        // 151
      return indices.join(',') + ',';                                                                 // 152
    };                                                                                                // 153
                                                                                                      // 154
    var knownPaths = null;                                                                            // 155
                                                                                                      // 156
    _.each(self._sortSpecParts, function (spec, whichField) {                                         // 157
      // Expand any leaf arrays that we find, and ignore those arrays                                 // 158
      // themselves.  (We never sort based on an array itself.)                                       // 159
      var branches = expandArraysInBranches(spec.lookup(doc), true);                                  // 160
                                                                                                      // 161
      // If there are no values for a key (eg, key goes to an empty array),                           // 162
      // pretend we found one null value.                                                             // 163
      if (!branches.length)                                                                           // 164
        branches = [{value: null}];                                                                   // 165
                                                                                                      // 166
      var usedPaths = false;                                                                          // 167
      valuesByIndexAndPath[whichField] = {};                                                          // 168
      _.each(branches, function (branch) {                                                            // 169
        if (!branch.arrayIndices) {                                                                   // 170
          // If there are no array indices for a branch, then it must be the                          // 171
          // only branch, because the only thing that produces multiple branches                      // 172
          // is the use of arrays.                                                                    // 173
          if (branches.length > 1)                                                                    // 174
            throw Error("multiple branches but no array used?");                                      // 175
          valuesByIndexAndPath[whichField][''] = branch.value;                                        // 176
          return;                                                                                     // 177
        }                                                                                             // 178
                                                                                                      // 179
        usedPaths = true;                                                                             // 180
        var path = pathFromIndices(branch.arrayIndices);                                              // 181
        if (_.has(valuesByIndexAndPath[whichField], path))                                            // 182
          throw Error("duplicate path: " + path);                                                     // 183
        valuesByIndexAndPath[whichField][path] = branch.value;                                        // 184
                                                                                                      // 185
        // If two sort fields both go into arrays, they have to go into the                           // 186
        // exact same arrays and we have to find the same paths.  This is                             // 187
        // roughly the same condition that makes MongoDB throw this strange                           // 188
        // error message.  eg, the main thing is that if sort spec is {a: 1,                          // 189
        // b:1} then a and b cannot both be arrays.                                                   // 190
        //                                                                                            // 191
        // (In MongoDB it seems to be OK to have {a: 1, 'a.x.y': 1} where 'a'                         // 192
        // and 'a.x.y' are both arrays, but we don't allow this for now.                              // 193
        // #NestedArraySort                                                                           // 194
        // XXX achieve full compatibility here                                                        // 195
        if (knownPaths && !_.has(knownPaths, path)) {                                                 // 196
          throw Error("cannot index parallel arrays");                                                // 197
        }                                                                                             // 198
      });                                                                                             // 199
                                                                                                      // 200
      if (knownPaths) {                                                                               // 201
        // Similarly to above, paths must match everywhere, unless this is a                          // 202
        // non-array field.                                                                           // 203
        if (!_.has(valuesByIndexAndPath[whichField], '') &&                                           // 204
            _.size(knownPaths) !== _.size(valuesByIndexAndPath[whichField])) {                        // 205
          throw Error("cannot index parallel arrays!");                                               // 206
        }                                                                                             // 207
      } else if (usedPaths) {                                                                         // 208
        knownPaths = {};                                                                              // 209
        _.each(valuesByIndexAndPath[whichField], function (x, path) {                                 // 210
          knownPaths[path] = true;                                                                    // 211
        });                                                                                           // 212
      }                                                                                               // 213
    });                                                                                               // 214
                                                                                                      // 215
    if (!knownPaths) {                                                                                // 216
      // Easy case: no use of arrays.                                                                 // 217
      var soleKey = _.map(valuesByIndexAndPath, function (values) {                                   // 218
        if (!_.has(values, ''))                                                                       // 219
          throw Error("no value in sole key case?");                                                  // 220
        return values[''];                                                                            // 221
      });                                                                                             // 222
      cb(soleKey);                                                                                    // 223
      return;                                                                                         // 224
    }                                                                                                 // 225
                                                                                                      // 226
    _.each(knownPaths, function (x, path) {                                                           // 227
      var key = _.map(valuesByIndexAndPath, function (values) {                                       // 228
        if (_.has(values, ''))                                                                        // 229
          return values[''];                                                                          // 230
        if (!_.has(values, path))                                                                     // 231
          throw Error("missing path?");                                                               // 232
        return values[path];                                                                          // 233
      });                                                                                             // 234
      cb(key);                                                                                        // 235
    });                                                                                               // 236
  },                                                                                                  // 237
                                                                                                      // 238
  // Takes in two keys: arrays whose lengths match the number of spec                                 // 239
  // parts. Returns negative, 0, or positive based on using the sort spec to                          // 240
  // compare fields.                                                                                  // 241
  _compareKeys: function (key1, key2) {                                                               // 242
    var self = this;                                                                                  // 243
    if (key1.length !== self._sortSpecParts.length ||                                                 // 244
        key2.length !== self._sortSpecParts.length) {                                                 // 245
      throw Error("Key has wrong length");                                                            // 246
    }                                                                                                 // 247
                                                                                                      // 248
    return self._keyComparator(key1, key2);                                                           // 249
  },                                                                                                  // 250
                                                                                                      // 251
  // Given an index 'i', returns a comparator that compares two key arrays based                      // 252
  // on field 'i'.                                                                                    // 253
  _keyFieldComparator: function (i) {                                                                 // 254
    var self = this;                                                                                  // 255
    var invert = !self._sortSpecParts[i].ascending;                                                   // 256
    return function (key1, key2) {                                                                    // 257
      var compare = LocalCollection._f._cmp(key1[i], key2[i]);                                        // 258
      if (invert)                                                                                     // 259
        compare = -compare;                                                                           // 260
      return compare;                                                                                 // 261
    };                                                                                                // 262
  },                                                                                                  // 263
                                                                                                      // 264
  // Returns a comparator that represents the sort specification (but not                             // 265
  // including a possible geoquery distance tie-breaker).                                             // 266
  _getBaseComparator: function () {                                                                   // 267
    var self = this;                                                                                  // 268
                                                                                                      // 269
    // If we're only sorting on geoquery distance and no specs, just say                              // 270
    // everything is equal.                                                                           // 271
    if (!self._sortSpecParts.length) {                                                                // 272
      return function (doc1, doc2) {                                                                  // 273
        return 0;                                                                                     // 274
      };                                                                                              // 275
    }                                                                                                 // 276
                                                                                                      // 277
    return function (doc1, doc2) {                                                                    // 278
      var key1 = self._getMinKeyFromDoc(doc1);                                                        // 279
      var key2 = self._getMinKeyFromDoc(doc2);                                                        // 280
      return self._compareKeys(key1, key2);                                                           // 281
    };                                                                                                // 282
  },                                                                                                  // 283
                                                                                                      // 284
  // In MongoDB, if you have documents                                                                // 285
  //    {_id: 'x', a: [1, 10]} and                                                                    // 286
  //    {_id: 'y', a: [5, 15]},                                                                       // 287
  // then C.find({}, {sort: {a: 1}}) puts x before y (1 comes before 5).                              // 288
  // But  C.find({a: {$gt: 3}}, {sort: {a: 1}}) puts y before x (1 does not                           // 289
  // match the selector, and 5 comes before 10).                                                      // 290
  //                                                                                                  // 291
  // The way this works is pretty subtle!  For example, if the documents                              // 292
  // are instead {_id: 'x', a: [{x: 1}, {x: 10}]}) and                                                // 293
  //             {_id: 'y', a: [{x: 5}, {x: 15}]}),                                                   // 294
  // then C.find({'a.x': {$gt: 3}}, {sort: {'a.x': 1}}) and                                           // 295
  //      C.find({a: {$elemMatch: {x: {$gt: 3}}}}, {sort: {'a.x': 1}})                                // 296
  // both follow this rule (y before x).  (ie, you do have to apply this                              // 297
  // through $elemMatch.)                                                                             // 298
  //                                                                                                  // 299
  // So if you pass a matcher to this sorter's constructor, we will attempt to                        // 300
  // skip sort keys that don't match the selector. The logic here is pretty                           // 301
  // subtle and undocumented; we've gotten as close as we can figure out based                        // 302
  // on our understanding of Mongo's behavior.                                                        // 303
  _useWithMatcher: function (matcher) {                                                               // 304
    var self = this;                                                                                  // 305
                                                                                                      // 306
    if (self._keyFilter)                                                                              // 307
      throw Error("called _useWithMatcher twice?");                                                   // 308
                                                                                                      // 309
    // If we are only sorting by distance, then we're not going to bother to                          // 310
    // build a key filter.                                                                            // 311
    // XXX figure out how geoqueries interact with this stuff                                         // 312
    if (_.isEmpty(self._sortSpecParts))                                                               // 313
      return;                                                                                         // 314
                                                                                                      // 315
    var selector = matcher._selector;                                                                 // 316
                                                                                                      // 317
    // If the user just passed a literal function to find(), then we can't get a                      // 318
    // key filter from it.                                                                            // 319
    if (selector instanceof Function)                                                                 // 320
      return;                                                                                         // 321
                                                                                                      // 322
    var constraintsByPath = {};                                                                       // 323
    _.each(self._sortSpecParts, function (spec, i) {                                                  // 324
      constraintsByPath[spec.path] = [];                                                              // 325
    });                                                                                               // 326
                                                                                                      // 327
    _.each(selector, function (subSelector, key) {                                                    // 328
      // XXX support $and and $or                                                                     // 329
                                                                                                      // 330
      var constraints = constraintsByPath[key];                                                       // 331
      if (!constraints)                                                                               // 332
        return;                                                                                       // 333
                                                                                                      // 334
      // XXX it looks like the real MongoDB implementation isn't "does the                            // 335
      // regexp match" but "does the value fall into a range named by the                             // 336
      // literal prefix of the regexp", ie "foo" in /^foo(bar|baz)+/  But                             // 337
      // "does the regexp match" is a good approximation.                                             // 338
      if (subSelector instanceof RegExp) {                                                            // 339
        // As far as we can tell, using either of the options that both we and                        // 340
        // MongoDB support ('i' and 'm') disables use of the key filter. This                         // 341
        // makes sense: MongoDB mostly appears to be calculating ranges of an                         // 342
        // index to use, which means it only cares about regexps that match                           // 343
        // one range (with a literal prefix), and both 'i' and 'm' prevent the                        // 344
        // literal prefix of the regexp from actually meaning one range.                              // 345
        if (subSelector.ignoreCase || subSelector.multiline)                                          // 346
          return;                                                                                     // 347
        constraints.push(regexpElementMatcher(subSelector));                                          // 348
        return;                                                                                       // 349
      }                                                                                               // 350
                                                                                                      // 351
      if (isOperatorObject(subSelector)) {                                                            // 352
        _.each(subSelector, function (operand, operator) {                                            // 353
          if (_.contains(['$lt', '$lte', '$gt', '$gte'], operator)) {                                 // 354
            // XXX this depends on us knowing that these operators don't use any                      // 355
            // of the arguments to compileElementSelector other than operand.                         // 356
            constraints.push(                                                                         // 357
              ELEMENT_OPERATORS[operator].compileElementSelector(operand));                           // 358
          }                                                                                           // 359
                                                                                                      // 360
          // See comments in the RegExp block above.                                                  // 361
          if (operator === '$regex' && !subSelector.$options) {                                       // 362
            constraints.push(                                                                         // 363
              ELEMENT_OPERATORS.$regex.compileElementSelector(                                        // 364
                operand, subSelector));                                                               // 365
          }                                                                                           // 366
                                                                                                      // 367
          // XXX support {$exists: true}, $mod, $type, $in, $elemMatch                                // 368
        });                                                                                           // 369
        return;                                                                                       // 370
      }                                                                                               // 371
                                                                                                      // 372
      // OK, it's an equality thing.                                                                  // 373
      constraints.push(equalityElementMatcher(subSelector));                                          // 374
    });                                                                                               // 375
                                                                                                      // 376
    // It appears that the first sort field is treated differently from the                           // 377
    // others; we shouldn't create a key filter unless the first sort field is                        // 378
    // restricted, though after that point we can restrict the other sort fields                      // 379
    // or not as we wish.                                                                             // 380
    if (_.isEmpty(constraintsByPath[self._sortSpecParts[0].path]))                                    // 381
      return;                                                                                         // 382
                                                                                                      // 383
    self._keyFilter = function (key) {                                                                // 384
      return _.all(self._sortSpecParts, function (specPart, index) {                                  // 385
        return _.all(constraintsByPath[specPart.path], function (f) {                                 // 386
          return f(key[index]);                                                                       // 387
        });                                                                                           // 388
      });                                                                                             // 389
    };                                                                                                // 390
  }                                                                                                   // 391
});                                                                                                   // 392
                                                                                                      // 393
// Given an array of comparators                                                                      // 394
// (functions (a,b)->(negative or positive or zero)), returns a single                                // 395
// comparator which uses each comparator in order and returns the first                               // 396
// non-zero value.                                                                                    // 397
var composeComparators = function (comparatorArray) {                                                 // 398
  return function (a, b) {                                                                            // 399
    for (var i = 0; i < comparatorArray.length; ++i) {                                                // 400
      var compare = comparatorArray[i](a, b);                                                         // 401
      if (compare !== 0)                                                                              // 402
        return compare;                                                                               // 403
    }                                                                                                 // 404
    return 0;                                                                                         // 405
  };                                                                                                  // 406
};                                                                                                    // 407
                                                                                                      // 408
////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                    //
// packages/minimongo/projection.js                                                                   //
//                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                      //
// Knows how to compile a fields projection to a predicate function.                                  // 1
// @returns - Function: a closure that filters out an object according to the                         // 2
//            fields projection rules:                                                                // 3
//            @param obj - Object: MongoDB-styled document                                            // 4
//            @returns - Object: a document with the fields filtered out                              // 5
//                       according to projection rules. Doesn't retain subfields                      // 6
//                       of passed argument.                                                          // 7
LocalCollection._compileProjection = function (fields) {                                              // 8
  LocalCollection._checkSupportedProjection(fields);                                                  // 9
                                                                                                      // 10
  var _idProjection = _.isUndefined(fields._id) ? true : fields._id;                                  // 11
  var details = projectionDetails(fields);                                                            // 12
                                                                                                      // 13
  // returns transformed doc according to ruleTree                                                    // 14
  var transform = function (doc, ruleTree) {                                                          // 15
    // Special case for "sets"                                                                        // 16
    if (_.isArray(doc))                                                                               // 17
      return _.map(doc, function (subdoc) { return transform(subdoc, ruleTree); });                   // 18
                                                                                                      // 19
    var res = details.including ? {} : EJSON.clone(doc);                                              // 20
    _.each(ruleTree, function (rule, key) {                                                           // 21
      if (!_.has(doc, key))                                                                           // 22
        return;                                                                                       // 23
      if (_.isObject(rule)) {                                                                         // 24
        // For sub-objects/subsets we branch                                                          // 25
        if (_.isObject(doc[key]))                                                                     // 26
          res[key] = transform(doc[key], rule);                                                       // 27
        // Otherwise we don't even touch this subfield                                                // 28
      } else if (details.including)                                                                   // 29
        res[key] = EJSON.clone(doc[key]);                                                             // 30
      else                                                                                            // 31
        delete res[key];                                                                              // 32
    });                                                                                               // 33
                                                                                                      // 34
    return res;                                                                                       // 35
  };                                                                                                  // 36
                                                                                                      // 37
  return function (obj) {                                                                             // 38
    var res = transform(obj, details.tree);                                                           // 39
                                                                                                      // 40
    if (_idProjection && _.has(obj, '_id'))                                                           // 41
      res._id = obj._id;                                                                              // 42
    if (!_idProjection && _.has(res, '_id'))                                                          // 43
      delete res._id;                                                                                 // 44
    return res;                                                                                       // 45
  };                                                                                                  // 46
};                                                                                                    // 47
                                                                                                      // 48
// Traverses the keys of passed projection and constructs a tree where all                            // 49
// leaves are either all True or all False                                                            // 50
// @returns Object:                                                                                   // 51
//  - tree - Object - tree representation of keys involved in projection                              // 52
//  (exception for '_id' as it is a special case handled separately)                                  // 53
//  - including - Boolean - "take only certain fields" type of projection                             // 54
projectionDetails = function (fields) {                                                               // 55
  // Find the non-_id keys (_id is handled specially because it is included unless                    // 56
  // explicitly excluded). Sort the keys, so that our code to detect overlaps                         // 57
  // like 'foo' and 'foo.bar' can assume that 'foo' comes first.                                      // 58
  var fieldsKeys = _.keys(fields).sort();                                                             // 59
                                                                                                      // 60
  // If there are other rules other than '_id', treat '_id' differently in a                          // 61
  // separate case. If '_id' is the only rule, use it to understand if it is                          // 62
  // including/excluding projection.                                                                  // 63
  if (fieldsKeys.length > 0 && !(fieldsKeys.length === 1 && fieldsKeys[0] === '_id'))                 // 64
    fieldsKeys = _.reject(fieldsKeys, function (key) { return key === '_id'; });                      // 65
                                                                                                      // 66
  var including = null; // Unknown                                                                    // 67
                                                                                                      // 68
  _.each(fieldsKeys, function (keyPath) {                                                             // 69
    var rule = !!fields[keyPath];                                                                     // 70
    if (including === null)                                                                           // 71
      including = rule;                                                                               // 72
    if (including !== rule)                                                                           // 73
      // This error message is copies from MongoDB shell                                              // 74
      throw MinimongoError("You cannot currently mix including and excluding fields.");               // 75
  });                                                                                                 // 76
                                                                                                      // 77
                                                                                                      // 78
  var projectionRulesTree = pathsToTree(                                                              // 79
    fieldsKeys,                                                                                       // 80
    function (path) { return including; },                                                            // 81
    function (node, path, fullPath) {                                                                 // 82
      // Check passed projection fields' keys: If you have two rules such as                          // 83
      // 'foo.bar' and 'foo.bar.baz', then the result becomes ambiguous. If                           // 84
      // that happens, there is a probability you are doing something wrong,                          // 85
      // framework should notify you about such mistake earlier on cursor                             // 86
      // compilation step than later during runtime.  Note, that real mongo                           // 87
      // doesn't do anything about it and the later rule appears in projection                        // 88
      // project, more priority it takes.                                                             // 89
      //                                                                                              // 90
      // Example, assume following in mongo shell:                                                    // 91
      // > db.coll.insert({ a: { b: 23, c: 44 } })                                                    // 92
      // > db.coll.find({}, { 'a': 1, 'a.b': 1 })                                                     // 93
      // { "_id" : ObjectId("520bfe456024608e8ef24af3"), "a" : { "b" : 23 } }                         // 94
      // > db.coll.find({}, { 'a.b': 1, 'a': 1 })                                                     // 95
      // { "_id" : ObjectId("520bfe456024608e8ef24af3"), "a" : { "b" : 23, "c" : 44 } }               // 96
      //                                                                                              // 97
      // Note, how second time the return set of keys is different.                                   // 98
                                                                                                      // 99
      var currentPath = fullPath;                                                                     // 100
      var anotherPath = path;                                                                         // 101
      throw MinimongoError("both " + currentPath + " and " + anotherPath +                            // 102
                           " found in fields option, using both of them may trigger " +               // 103
                           "unexpected behavior. Did you mean to use only one of them?");             // 104
    });                                                                                               // 105
                                                                                                      // 106
  return {                                                                                            // 107
    tree: projectionRulesTree,                                                                        // 108
    including: including                                                                              // 109
  };                                                                                                  // 110
};                                                                                                    // 111
                                                                                                      // 112
// paths - Array: list of mongo style paths                                                           // 113
// newLeafFn - Function: of form function(path) should return a scalar value to                       // 114
//                       put into list created for that path                                          // 115
// conflictFn - Function: of form function(node, path, fullPath) is called                            // 116
//                        when building a tree path for 'fullPath' node on                            // 117
//                        'path' was already a leaf with a value. Must return a                       // 118
//                        conflict resolution.                                                        // 119
// initial tree - Optional Object: starting tree.                                                     // 120
// @returns - Object: tree represented as a set of nested objects                                     // 121
pathsToTree = function (paths, newLeafFn, conflictFn, tree) {                                         // 122
  tree = tree || {};                                                                                  // 123
  _.each(paths, function (keyPath) {                                                                  // 124
    var treePos = tree;                                                                               // 125
    var pathArr = keyPath.split('.');                                                                 // 126
                                                                                                      // 127
    // use _.all just for iteration with break                                                        // 128
    var success = _.all(pathArr.slice(0, -1), function (key, idx) {                                   // 129
      if (!_.has(treePos, key))                                                                       // 130
        treePos[key] = {};                                                                            // 131
      else if (!_.isObject(treePos[key])) {                                                           // 132
        treePos[key] = conflictFn(treePos[key],                                                       // 133
                                  pathArr.slice(0, idx + 1).join('.'),                                // 134
                                  keyPath);                                                           // 135
        // break out of loop if we are failing for this path                                          // 136
        if (!_.isObject(treePos[key]))                                                                // 137
          return false;                                                                               // 138
      }                                                                                               // 139
                                                                                                      // 140
      treePos = treePos[key];                                                                         // 141
      return true;                                                                                    // 142
    });                                                                                               // 143
                                                                                                      // 144
    if (success) {                                                                                    // 145
      var lastKey = _.last(pathArr);                                                                  // 146
      if (!_.has(treePos, lastKey))                                                                   // 147
        treePos[lastKey] = newLeafFn(keyPath);                                                        // 148
      else                                                                                            // 149
        treePos[lastKey] = conflictFn(treePos[lastKey], keyPath, keyPath);                            // 150
    }                                                                                                 // 151
  });                                                                                                 // 152
                                                                                                      // 153
  return tree;                                                                                        // 154
};                                                                                                    // 155
                                                                                                      // 156
LocalCollection._checkSupportedProjection = function (fields) {                                       // 157
  if (!_.isObject(fields) || _.isArray(fields))                                                       // 158
    throw MinimongoError("fields option must be an object");                                          // 159
                                                                                                      // 160
  _.each(fields, function (val, keyPath) {                                                            // 161
    if (_.contains(keyPath.split('.'), '$'))                                                          // 162
      throw MinimongoError("Minimongo doesn't support $ operator in projections yet.");               // 163
    if (_.indexOf([1, 0, true, false], val) === -1)                                                   // 164
      throw MinimongoError("Projection values should be one of 1, 0, true, or false");                // 165
  });                                                                                                 // 166
};                                                                                                    // 167
                                                                                                      // 168
                                                                                                      // 169
////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                    //
// packages/minimongo/modify.js                                                                       //
//                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                      //
// XXX need a strategy for passing the binding of $ into this                                         // 1
// function, from the compiled selector                                                               // 2
//                                                                                                    // 3
// maybe just {key.up.to.just.before.dollarsign: array_index}                                         // 4
//                                                                                                    // 5
// XXX atomicity: if one modification fails, do we roll back the whole                                // 6
// change?                                                                                            // 7
//                                                                                                    // 8
// options:                                                                                           // 9
//   - isInsert is set when _modify is being called to compute the document to                        // 10
//     insert as part of an upsert operation. We use this primarily to figure                         // 11
//     out when to set the fields in $setOnInsert, if present.                                        // 12
LocalCollection._modify = function (doc, mod, options) {                                              // 13
  options = options || {};                                                                            // 14
  if (!isPlainObject(mod))                                                                            // 15
    throw MinimongoError("Modifier must be an object");                                               // 16
  var isModifier = isOperatorObject(mod);                                                             // 17
                                                                                                      // 18
  var newDoc;                                                                                         // 19
                                                                                                      // 20
  if (!isModifier) {                                                                                  // 21
    if (mod._id && !EJSON.equals(doc._id, mod._id))                                                   // 22
      throw MinimongoError("Cannot change the _id of a document");                                    // 23
                                                                                                      // 24
    // replace the whole document                                                                     // 25
    for (var k in mod) {                                                                              // 26
      if (/\./.test(k))                                                                               // 27
        throw MinimongoError(                                                                         // 28
          "When replacing document, field name may not contain '.'");                                 // 29
    }                                                                                                 // 30
    newDoc = mod;                                                                                     // 31
  } else {                                                                                            // 32
    // apply modifiers to the doc.                                                                    // 33
    newDoc = EJSON.clone(doc);                                                                        // 34
                                                                                                      // 35
    _.each(mod, function (operand, op) {                                                              // 36
      var modFunc = MODIFIERS[op];                                                                    // 37
      // Treat $setOnInsert as $set if this is an insert.                                             // 38
      if (options.isInsert && op === '$setOnInsert')                                                  // 39
        modFunc = MODIFIERS['$set'];                                                                  // 40
      if (!modFunc)                                                                                   // 41
        throw MinimongoError("Invalid modifier specified " + op);                                     // 42
      _.each(operand, function (arg, keypath) {                                                       // 43
        // XXX mongo doesn't allow mod field names to end in a period,                                // 44
        // but I don't see why.. it allows '' as a key, as does JS                                    // 45
        if (keypath.length && keypath[keypath.length-1] === '.')                                      // 46
          throw MinimongoError(                                                                       // 47
            "Invalid mod field name, may not end in a period");                                       // 48
                                                                                                      // 49
        if (keypath === '_id')                                                                        // 50
          throw MinimongoError("Mod on _id not allowed");                                             // 51
                                                                                                      // 52
        var keyparts = keypath.split('.');                                                            // 53
        var noCreate = _.has(NO_CREATE_MODIFIERS, op);                                                // 54
        var forbidArray = (op === "$rename");                                                         // 55
        var target = findModTarget(newDoc, keyparts, {                                                // 56
          noCreate: NO_CREATE_MODIFIERS[op],                                                          // 57
          forbidArray: (op === "$rename"),                                                            // 58
          arrayIndices: options.arrayIndices                                                          // 59
        });                                                                                           // 60
        var field = keyparts.pop();                                                                   // 61
        modFunc(target, field, arg, keypath, newDoc);                                                 // 62
      });                                                                                             // 63
    });                                                                                               // 64
  }                                                                                                   // 65
                                                                                                      // 66
  // move new document into place.                                                                    // 67
  _.each(_.keys(doc), function (k) {                                                                  // 68
    // Note: this used to be for (var k in doc) however, this does not                                // 69
    // work right in Opera. Deleting from a doc while iterating over it                               // 70
    // would sometimes cause opera to skip some keys.                                                 // 71
                                                                                                      // 72
    // isInsert: if we're constructing a document to insert (via upsert)                              // 73
    // and we're in replacement mode, not modify mode, DON'T take the                                 // 74
    // _id from the query.  This matches mongo's behavior.                                            // 75
    if (k !== '_id' || options.isInsert)                                                              // 76
      delete doc[k];                                                                                  // 77
  });                                                                                                 // 78
  _.each(newDoc, function (v, k) {                                                                    // 79
    doc[k] = v;                                                                                       // 80
  });                                                                                                 // 81
};                                                                                                    // 82
                                                                                                      // 83
// for a.b.c.2.d.e, keyparts should be ['a', 'b', 'c', '2', 'd', 'e'],                                // 84
// and then you would operate on the 'e' property of the returned                                     // 85
// object.                                                                                            // 86
//                                                                                                    // 87
// if options.noCreate is falsey, creates intermediate levels of                                      // 88
// structure as necessary, like mkdir -p (and raises an exception if                                  // 89
// that would mean giving a non-numeric property to an array.) if                                     // 90
// options.noCreate is true, return undefined instead.                                                // 91
//                                                                                                    // 92
// may modify the last element of keyparts to signal to the caller that it needs                      // 93
// to use a different value to index into the returned object (for example,                           // 94
// ['a', '01'] -> ['a', 1]).                                                                          // 95
//                                                                                                    // 96
// if forbidArray is true, return null if the keypath goes through an array.                          // 97
//                                                                                                    // 98
// if options.arrayIndices is set, use its first element for the (first) '$' in                       // 99
// the path.                                                                                          // 100
var findModTarget = function (doc, keyparts, options) {                                               // 101
  options = options || {};                                                                            // 102
  var usedArrayIndex = false;                                                                         // 103
  for (var i = 0; i < keyparts.length; i++) {                                                         // 104
    var last = (i === keyparts.length - 1);                                                           // 105
    var keypart = keyparts[i];                                                                        // 106
    var indexable = isIndexable(doc);                                                                 // 107
    if (!indexable) {                                                                                 // 108
      if (options.noCreate)                                                                           // 109
        return undefined;                                                                             // 110
      var e = MinimongoError(                                                                         // 111
        "cannot use the part '" + keypart + "' to traverse " + doc);                                  // 112
      e.setPropertyError = true;                                                                      // 113
      throw e;                                                                                        // 114
    }                                                                                                 // 115
    if (doc instanceof Array) {                                                                       // 116
      if (options.forbidArray)                                                                        // 117
        return null;                                                                                  // 118
      if (keypart === '$') {                                                                          // 119
        if (usedArrayIndex)                                                                           // 120
          throw MinimongoError("Too many positional (i.e. '$') elements");                            // 121
        if (!options.arrayIndices || !options.arrayIndices.length) {                                  // 122
          throw MinimongoError("The positional operator did not find the " +                          // 123
                               "match needed from the query");                                        // 124
        }                                                                                             // 125
        keypart = options.arrayIndices[0];                                                            // 126
        usedArrayIndex = true;                                                                        // 127
      } else if (isNumericKey(keypart)) {                                                             // 128
        keypart = parseInt(keypart);                                                                  // 129
      } else {                                                                                        // 130
        if (options.noCreate)                                                                         // 131
          return undefined;                                                                           // 132
        throw MinimongoError(                                                                         // 133
          "can't append to array using string field name ["                                           // 134
                    + keypart + "]");                                                                 // 135
      }                                                                                               // 136
      if (last)                                                                                       // 137
        // handle 'a.01'                                                                              // 138
        keyparts[i] = keypart;                                                                        // 139
      if (options.noCreate && keypart >= doc.length)                                                  // 140
        return undefined;                                                                             // 141
      while (doc.length < keypart)                                                                    // 142
        doc.push(null);                                                                               // 143
      if (!last) {                                                                                    // 144
        if (doc.length === keypart)                                                                   // 145
          doc.push({});                                                                               // 146
        else if (typeof doc[keypart] !== "object")                                                    // 147
          throw MinimongoError("can't modify field '" + keyparts[i + 1] +                             // 148
                      "' of list value " + JSON.stringify(doc[keypart]));                             // 149
      }                                                                                               // 150
    } else {                                                                                          // 151
      if (keypart.length && keypart.substr(0, 1) === '$')                                             // 152
        throw MinimongoError("can't set field named " + keypart);                                     // 153
      if (!(keypart in doc)) {                                                                        // 154
        if (options.noCreate)                                                                         // 155
          return undefined;                                                                           // 156
        if (!last)                                                                                    // 157
          doc[keypart] = {};                                                                          // 158
      }                                                                                               // 159
    }                                                                                                 // 160
                                                                                                      // 161
    if (last)                                                                                         // 162
      return doc;                                                                                     // 163
    doc = doc[keypart];                                                                               // 164
  }                                                                                                   // 165
                                                                                                      // 166
  // notreached                                                                                       // 167
};                                                                                                    // 168
                                                                                                      // 169
var NO_CREATE_MODIFIERS = {                                                                           // 170
  $unset: true,                                                                                       // 171
  $pop: true,                                                                                         // 172
  $rename: true,                                                                                      // 173
  $pull: true,                                                                                        // 174
  $pullAll: true                                                                                      // 175
};                                                                                                    // 176
                                                                                                      // 177
var MODIFIERS = {                                                                                     // 178
  $inc: function (target, field, arg) {                                                               // 179
    if (typeof arg !== "number")                                                                      // 180
      throw MinimongoError("Modifier $inc allowed for numbers only");                                 // 181
    if (field in target) {                                                                            // 182
      if (typeof target[field] !== "number")                                                          // 183
        throw MinimongoError("Cannot apply $inc modifier to non-number");                             // 184
      target[field] += arg;                                                                           // 185
    } else {                                                                                          // 186
      target[field] = arg;                                                                            // 187
    }                                                                                                 // 188
  },                                                                                                  // 189
  $set: function (target, field, arg) {                                                               // 190
    if (!_.isObject(target)) { // not an array or an object                                           // 191
      var e = MinimongoError("Cannot set property on non-object field");                              // 192
      e.setPropertyError = true;                                                                      // 193
      throw e;                                                                                        // 194
    }                                                                                                 // 195
    if (target === null) {                                                                            // 196
      var e = MinimongoError("Cannot set property on null");                                          // 197
      e.setPropertyError = true;                                                                      // 198
      throw e;                                                                                        // 199
    }                                                                                                 // 200
    target[field] = EJSON.clone(arg);                                                                 // 201
  },                                                                                                  // 202
  $setOnInsert: function (target, field, arg) {                                                       // 203
    // converted to `$set` in `_modify`                                                               // 204
  },                                                                                                  // 205
  $unset: function (target, field, arg) {                                                             // 206
    if (target !== undefined) {                                                                       // 207
      if (target instanceof Array) {                                                                  // 208
        if (field in target)                                                                          // 209
          target[field] = null;                                                                       // 210
      } else                                                                                          // 211
        delete target[field];                                                                         // 212
    }                                                                                                 // 213
  },                                                                                                  // 214
  $push: function (target, field, arg) {                                                              // 215
    if (target[field] === undefined)                                                                  // 216
      target[field] = [];                                                                             // 217
    if (!(target[field] instanceof Array))                                                            // 218
      throw MinimongoError("Cannot apply $push modifier to non-array");                               // 219
                                                                                                      // 220
    if (!(arg && arg.$each)) {                                                                        // 221
      // Simple mode: not $each                                                                       // 222
      target[field].push(EJSON.clone(arg));                                                           // 223
      return;                                                                                         // 224
    }                                                                                                 // 225
                                                                                                      // 226
    // Fancy mode: $each (and maybe $slice and $sort)                                                 // 227
    var toPush = arg.$each;                                                                           // 228
    if (!(toPush instanceof Array))                                                                   // 229
      throw MinimongoError("$each must be an array");                                                 // 230
                                                                                                      // 231
    // Parse $slice.                                                                                  // 232
    var slice = undefined;                                                                            // 233
    if ('$slice' in arg) {                                                                            // 234
      if (typeof arg.$slice !== "number")                                                             // 235
        throw MinimongoError("$slice must be a numeric value");                                       // 236
      // XXX should check to make sure integer                                                        // 237
      if (arg.$slice > 0)                                                                             // 238
        throw MinimongoError("$slice in $push must be zero or negative");                             // 239
      slice = arg.$slice;                                                                             // 240
    }                                                                                                 // 241
                                                                                                      // 242
    // Parse $sort.                                                                                   // 243
    var sortFunction = undefined;                                                                     // 244
    if (arg.$sort) {                                                                                  // 245
      if (slice === undefined)                                                                        // 246
        throw MinimongoError("$sort requires $slice to be present");                                  // 247
      // XXX this allows us to use a $sort whose value is an array, but that's                        // 248
      // actually an extension of the Node driver, so it won't work                                   // 249
      // server-side. Could be confusing!                                                             // 250
      // XXX is it correct that we don't do geo-stuff here?                                           // 251
      sortFunction = new Minimongo.Sorter(arg.$sort).getComparator();                                 // 252
      for (var i = 0; i < toPush.length; i++) {                                                       // 253
        if (LocalCollection._f._type(toPush[i]) !== 3) {                                              // 254
          throw MinimongoError("$push like modifiers using $sort " +                                  // 255
                      "require all elements to be objects");                                          // 256
        }                                                                                             // 257
      }                                                                                               // 258
    }                                                                                                 // 259
                                                                                                      // 260
    // Actually push.                                                                                 // 261
    for (var j = 0; j < toPush.length; j++)                                                           // 262
      target[field].push(EJSON.clone(toPush[j]));                                                     // 263
                                                                                                      // 264
    // Actually sort.                                                                                 // 265
    if (sortFunction)                                                                                 // 266
      target[field].sort(sortFunction);                                                               // 267
                                                                                                      // 268
    // Actually slice.                                                                                // 269
    if (slice !== undefined) {                                                                        // 270
      if (slice === 0)                                                                                // 271
        target[field] = [];  // differs from Array.slice!                                             // 272
      else                                                                                            // 273
        target[field] = target[field].slice(slice);                                                   // 274
    }                                                                                                 // 275
  },                                                                                                  // 276
  $pushAll: function (target, field, arg) {                                                           // 277
    if (!(typeof arg === "object" && arg instanceof Array))                                           // 278
      throw MinimongoError("Modifier $pushAll/pullAll allowed for arrays only");                      // 279
    var x = target[field];                                                                            // 280
    if (x === undefined)                                                                              // 281
      target[field] = arg;                                                                            // 282
    else if (!(x instanceof Array))                                                                   // 283
      throw MinimongoError("Cannot apply $pushAll modifier to non-array");                            // 284
    else {                                                                                            // 285
      for (var i = 0; i < arg.length; i++)                                                            // 286
        x.push(arg[i]);                                                                               // 287
    }                                                                                                 // 288
  },                                                                                                  // 289
  $addToSet: function (target, field, arg) {                                                          // 290
    var isEach = false;                                                                               // 291
    if (typeof arg === "object") {                                                                    // 292
      //check if first key is '$each'                                                                 // 293
      for (var k in arg) {                                                                            // 294
        if (k === "$each")                                                                            // 295
          isEach = true;                                                                              // 296
        break;                                                                                        // 297
      }                                                                                               // 298
    }                                                                                                 // 299
    var values = isEach ? arg["$each"] : [arg];                                                       // 300
    var x = target[field];                                                                            // 301
    if (x === undefined)                                                                              // 302
      target[field] = values;                                                                         // 303
    else if (!(x instanceof Array))                                                                   // 304
      throw MinimongoError("Cannot apply $addToSet modifier to non-array");                           // 305
    else {                                                                                            // 306
      _.each(values, function (value) {                                                               // 307
        for (var i = 0; i < x.length; i++)                                                            // 308
          if (LocalCollection._f._equal(value, x[i]))                                                 // 309
            return;                                                                                   // 310
        x.push(EJSON.clone(value));                                                                   // 311
      });                                                                                             // 312
    }                                                                                                 // 313
  },                                                                                                  // 314
  $pop: function (target, field, arg) {                                                               // 315
    if (target === undefined)                                                                         // 316
      return;                                                                                         // 317
    var x = target[field];                                                                            // 318
    if (x === undefined)                                                                              // 319
      return;                                                                                         // 320
    else if (!(x instanceof Array))                                                                   // 321
      throw MinimongoError("Cannot apply $pop modifier to non-array");                                // 322
    else {                                                                                            // 323
      if (typeof arg === 'number' && arg < 0)                                                         // 324
        x.splice(0, 1);                                                                               // 325
      else                                                                                            // 326
        x.pop();                                                                                      // 327
    }                                                                                                 // 328
  },                                                                                                  // 329
  $pull: function (target, field, arg) {                                                              // 330
    if (target === undefined)                                                                         // 331
      return;                                                                                         // 332
    var x = target[field];                                                                            // 333
    if (x === undefined)                                                                              // 334
      return;                                                                                         // 335
    else if (!(x instanceof Array))                                                                   // 336
      throw MinimongoError("Cannot apply $pull/pullAll modifier to non-array");                       // 337
    else {                                                                                            // 338
      var out = [];                                                                                   // 339
      if (typeof arg === "object" && !(arg instanceof Array)) {                                       // 340
        // XXX would be much nicer to compile this once, rather than                                  // 341
        // for each document we modify.. but usually we're not                                        // 342
        // modifying that many documents, so we'll let it slide for                                   // 343
        // now                                                                                        // 344
                                                                                                      // 345
        // XXX Minimongo.Matcher isn't up for the job, because we need                                // 346
        // to permit stuff like {$pull: {a: {$gt: 4}}}.. something                                    // 347
        // like {$gt: 4} is not normally a complete selector.                                         // 348
        // same issue as $elemMatch possibly?                                                         // 349
        var matcher = new Minimongo.Matcher(arg);                                                     // 350
        for (var i = 0; i < x.length; i++)                                                            // 351
          if (!matcher.documentMatches(x[i]).result)                                                  // 352
            out.push(x[i]);                                                                           // 353
      } else {                                                                                        // 354
        for (var i = 0; i < x.length; i++)                                                            // 355
          if (!LocalCollection._f._equal(x[i], arg))                                                  // 356
            out.push(x[i]);                                                                           // 357
      }                                                                                               // 358
      target[field] = out;                                                                            // 359
    }                                                                                                 // 360
  },                                                                                                  // 361
  $pullAll: function (target, field, arg) {                                                           // 362
    if (!(typeof arg === "object" && arg instanceof Array))                                           // 363
      throw MinimongoError("Modifier $pushAll/pullAll allowed for arrays only");                      // 364
    if (target === undefined)                                                                         // 365
      return;                                                                                         // 366
    var x = target[field];                                                                            // 367
    if (x === undefined)                                                                              // 368
      return;                                                                                         // 369
    else if (!(x instanceof Array))                                                                   // 370
      throw MinimongoError("Cannot apply $pull/pullAll modifier to non-array");                       // 371
    else {                                                                                            // 372
      var out = [];                                                                                   // 373
      for (var i = 0; i < x.length; i++) {                                                            // 374
        var exclude = false;                                                                          // 375
        for (var j = 0; j < arg.length; j++) {                                                        // 376
          if (LocalCollection._f._equal(x[i], arg[j])) {                                              // 377
            exclude = true;                                                                           // 378
            break;                                                                                    // 379
          }                                                                                           // 380
        }                                                                                             // 381
        if (!exclude)                                                                                 // 382
          out.push(x[i]);                                                                             // 383
      }                                                                                               // 384
      target[field] = out;                                                                            // 385
    }                                                                                                 // 386
  },                                                                                                  // 387
  $rename: function (target, field, arg, keypath, doc) {                                              // 388
    if (keypath === arg)                                                                              // 389
      // no idea why mongo has this restriction..                                                     // 390
      throw MinimongoError("$rename source must differ from target");                                 // 391
    if (target === null)                                                                              // 392
      throw MinimongoError("$rename source field invalid");                                           // 393
    if (typeof arg !== "string")                                                                      // 394
      throw MinimongoError("$rename target must be a string");                                        // 395
    if (target === undefined)                                                                         // 396
      return;                                                                                         // 397
    var v = target[field];                                                                            // 398
    delete target[field];                                                                             // 399
                                                                                                      // 400
    var keyparts = arg.split('.');                                                                    // 401
    var target2 = findModTarget(doc, keyparts, {forbidArray: true});                                  // 402
    if (target2 === null)                                                                             // 403
      throw MinimongoError("$rename target field invalid");                                           // 404
    var field2 = keyparts.pop();                                                                      // 405
    target2[field2] = v;                                                                              // 406
  },                                                                                                  // 407
  $bit: function (target, field, arg) {                                                               // 408
    // XXX mongo only supports $bit on integers, and we only support                                  // 409
    // native javascript numbers (doubles) so far, so we can't support $bit                           // 410
    throw MinimongoError("$bit is not supported");                                                    // 411
  }                                                                                                   // 412
};                                                                                                    // 413
                                                                                                      // 414
////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                    //
// packages/minimongo/diff.js                                                                         //
//                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                      //
// ordered: bool.                                                                                     // 1
// old_results and new_results: collections of documents.                                             // 2
//    if ordered, they are arrays.                                                                    // 3
//    if unordered, they are IdMaps                                                                   // 4
LocalCollection._diffQueryChanges = function (ordered, oldResults, newResults,                        // 5
                                       observer) {                                                    // 6
  if (ordered)                                                                                        // 7
    LocalCollection._diffQueryOrderedChanges(                                                         // 8
      oldResults, newResults, observer);                                                              // 9
  else                                                                                                // 10
    LocalCollection._diffQueryUnorderedChanges(                                                       // 11
      oldResults, newResults, observer);                                                              // 12
};                                                                                                    // 13
                                                                                                      // 14
LocalCollection._diffQueryUnorderedChanges = function (oldResults, newResults,                        // 15
                                                       observer) {                                    // 16
  if (observer.movedBefore) {                                                                         // 17
    throw new Error("_diffQueryUnordered called with a movedBefore observer!");                       // 18
  }                                                                                                   // 19
                                                                                                      // 20
  newResults.forEach(function (newDoc, id) {                                                          // 21
    var oldDoc = oldResults.get(id);                                                                  // 22
    if (oldDoc) {                                                                                     // 23
      if (observer.changed && !EJSON.equals(oldDoc, newDoc)) {                                        // 24
        observer.changed(                                                                             // 25
          id, LocalCollection._makeChangedFields(newDoc, oldDoc));                                    // 26
      }                                                                                               // 27
    } else if (observer.added) {                                                                      // 28
      var fields = EJSON.clone(newDoc);                                                               // 29
      delete fields._id;                                                                              // 30
      observer.added(newDoc._id, fields);                                                             // 31
    }                                                                                                 // 32
  });                                                                                                 // 33
                                                                                                      // 34
  if (observer.removed) {                                                                             // 35
    oldResults.forEach(function (oldDoc, id) {                                                        // 36
      if (!newResults.has(id))                                                                        // 37
        observer.removed(id);                                                                         // 38
    });                                                                                               // 39
  }                                                                                                   // 40
};                                                                                                    // 41
                                                                                                      // 42
                                                                                                      // 43
LocalCollection._diffQueryOrderedChanges = function (old_results, new_results, observer) {            // 44
                                                                                                      // 45
  var new_presence_of_id = {};                                                                        // 46
  _.each(new_results, function (doc) {                                                                // 47
    if (new_presence_of_id[doc._id])                                                                  // 48
      Meteor._debug("Duplicate _id in new_results");                                                  // 49
    new_presence_of_id[doc._id] = true;                                                               // 50
  });                                                                                                 // 51
                                                                                                      // 52
  var old_index_of_id = {};                                                                           // 53
  _.each(old_results, function (doc, i) {                                                             // 54
    if (doc._id in old_index_of_id)                                                                   // 55
      Meteor._debug("Duplicate _id in old_results");                                                  // 56
    old_index_of_id[doc._id] = i;                                                                     // 57
  });                                                                                                 // 58
                                                                                                      // 59
  // ALGORITHM:                                                                                       // 60
  //                                                                                                  // 61
  // To determine which docs should be considered "moved" (and which                                  // 62
  // merely change position because of other docs moving) we run                                      // 63
  // a "longest common subsequence" (LCS) algorithm.  The LCS of the                                  // 64
  // old doc IDs and the new doc IDs gives the docs that should NOT be                                // 65
  // considered moved.                                                                                // 66
                                                                                                      // 67
  // To actually call the appropriate callbacks to get from the old state to the                      // 68
  // new state:                                                                                       // 69
                                                                                                      // 70
  // First, we call removed() on all the items that only appear in the old                            // 71
  // state.                                                                                           // 72
                                                                                                      // 73
  // Then, once we have the items that should not move, we walk through the new                       // 74
  // results array group-by-group, where a "group" is a set of items that have                        // 75
  // moved, anchored on the end by an item that should not move.  One by one, we                      // 76
  // move each of those elements into place "before" the anchoring end-of-group                       // 77
  // item, and fire changed events on them if necessary.  Then we fire a changed                      // 78
  // event on the anchor, and move on to the next group.  There is always at                          // 79
  // least one group; the last group is anchored by a virtual "null" id at the                        // 80
  // end.                                                                                             // 81
                                                                                                      // 82
  // Asymptotically: O(N k) where k is number of ops, or potentially                                  // 83
  // O(N log N) if inner loop of LCS were made to be binary search.                                   // 84
                                                                                                      // 85
                                                                                                      // 86
  //////// LCS (longest common sequence, with respect to _id)                                         // 87
  // (see Wikipedia article on Longest Increasing Subsequence,                                        // 88
  // where the LIS is taken of the sequence of old indices of the                                     // 89
  // docs in new_results)                                                                             // 90
  //                                                                                                  // 91
  // unmoved: the output of the algorithm; members of the LCS,                                        // 92
  // in the form of indices into new_results                                                          // 93
  var unmoved = [];                                                                                   // 94
  // max_seq_len: length of LCS found so far                                                          // 95
  var max_seq_len = 0;                                                                                // 96
  // seq_ends[i]: the index into new_results of the last doc in a                                     // 97
  // common subsequence of length of i+1 <= max_seq_len                                               // 98
  var N = new_results.length;                                                                         // 99
  var seq_ends = new Array(N);                                                                        // 100
  // ptrs:  the common subsequence ending with new_results[n] extends                                 // 101
  // a common subsequence ending with new_results[ptr[n]], unless                                     // 102
  // ptr[n] is -1.                                                                                    // 103
  var ptrs = new Array(N);                                                                            // 104
  // virtual sequence of old indices of new results                                                   // 105
  var old_idx_seq = function(i_new) {                                                                 // 106
    return old_index_of_id[new_results[i_new]._id];                                                   // 107
  };                                                                                                  // 108
  // for each item in new_results, use it to extend a common subsequence                              // 109
  // of length j <= max_seq_len                                                                       // 110
  for(var i=0; i<N; i++) {                                                                            // 111
    if (old_index_of_id[new_results[i]._id] !== undefined) {                                          // 112
      var j = max_seq_len;                                                                            // 113
      // this inner loop would traditionally be a binary search,                                      // 114
      // but scanning backwards we will likely find a subseq to extend                                // 115
      // pretty soon, bounded for example by the total number of ops.                                 // 116
      // If this were to be changed to a binary search, we'd still want                               // 117
      // to scan backwards a bit as an optimization.                                                  // 118
      while (j > 0) {                                                                                 // 119
        if (old_idx_seq(seq_ends[j-1]) < old_idx_seq(i))                                              // 120
          break;                                                                                      // 121
        j--;                                                                                          // 122
      }                                                                                               // 123
                                                                                                      // 124
      ptrs[i] = (j === 0 ? -1 : seq_ends[j-1]);                                                       // 125
      seq_ends[j] = i;                                                                                // 126
      if (j+1 > max_seq_len)                                                                          // 127
        max_seq_len = j+1;                                                                            // 128
    }                                                                                                 // 129
  }                                                                                                   // 130
                                                                                                      // 131
  // pull out the LCS/LIS into unmoved                                                                // 132
  var idx = (max_seq_len === 0 ? -1 : seq_ends[max_seq_len-1]);                                       // 133
  while (idx >= 0) {                                                                                  // 134
    unmoved.push(idx);                                                                                // 135
    idx = ptrs[idx];                                                                                  // 136
  }                                                                                                   // 137
  // the unmoved item list is built backwards, so fix that                                            // 138
  unmoved.reverse();                                                                                  // 139
                                                                                                      // 140
  // the last group is always anchored by the end of the result list, which is                        // 141
  // an id of "null"                                                                                  // 142
  unmoved.push(new_results.length);                                                                   // 143
                                                                                                      // 144
  _.each(old_results, function (doc) {                                                                // 145
    if (!new_presence_of_id[doc._id])                                                                 // 146
      observer.removed && observer.removed(doc._id);                                                  // 147
  });                                                                                                 // 148
  // for each group of things in the new_results that is anchored by an unmoved                       // 149
  // element, iterate through the things before it.                                                   // 150
  var startOfGroup = 0;                                                                               // 151
  _.each(unmoved, function (endOfGroup) {                                                             // 152
    var groupId = new_results[endOfGroup] ? new_results[endOfGroup]._id : null;                       // 153
    var oldDoc;                                                                                       // 154
    var newDoc;                                                                                       // 155
    var fields;                                                                                       // 156
    for (var i = startOfGroup; i < endOfGroup; i++) {                                                 // 157
      newDoc = new_results[i];                                                                        // 158
      if (!_.has(old_index_of_id, newDoc._id)) {                                                      // 159
        fields = EJSON.clone(newDoc);                                                                 // 160
        delete fields._id;                                                                            // 161
        observer.addedBefore && observer.addedBefore(newDoc._id, fields, groupId);                    // 162
        observer.added && observer.added(newDoc._id, fields);                                         // 163
      } else {                                                                                        // 164
        // moved                                                                                      // 165
        oldDoc = old_results[old_index_of_id[newDoc._id]];                                            // 166
        fields = LocalCollection._makeChangedFields(newDoc, oldDoc);                                  // 167
        if (!_.isEmpty(fields)) {                                                                     // 168
          observer.changed && observer.changed(newDoc._id, fields);                                   // 169
        }                                                                                             // 170
        observer.movedBefore && observer.movedBefore(newDoc._id, groupId);                            // 171
      }                                                                                               // 172
    }                                                                                                 // 173
    if (groupId) {                                                                                    // 174
      newDoc = new_results[endOfGroup];                                                               // 175
      oldDoc = old_results[old_index_of_id[newDoc._id]];                                              // 176
      fields = LocalCollection._makeChangedFields(newDoc, oldDoc);                                    // 177
      if (!_.isEmpty(fields)) {                                                                       // 178
        observer.changed && observer.changed(newDoc._id, fields);                                     // 179
      }                                                                                               // 180
    }                                                                                                 // 181
    startOfGroup = endOfGroup+1;                                                                      // 182
  });                                                                                                 // 183
                                                                                                      // 184
                                                                                                      // 185
};                                                                                                    // 186
                                                                                                      // 187
                                                                                                      // 188
// General helper for diff-ing two objects.                                                           // 189
// callbacks is an object like so:                                                                    // 190
// { leftOnly: function (key, leftValue) {...},                                                       // 191
//   rightOnly: function (key, rightValue) {...},                                                     // 192
//   both: function (key, leftValue, rightValue) {...},                                               // 193
// }                                                                                                  // 194
LocalCollection._diffObjects = function (left, right, callbacks) {                                    // 195
  _.each(left, function (leftValue, key) {                                                            // 196
    if (_.has(right, key))                                                                            // 197
      callbacks.both && callbacks.both(key, leftValue, right[key]);                                   // 198
    else                                                                                              // 199
      callbacks.leftOnly && callbacks.leftOnly(key, leftValue);                                       // 200
  });                                                                                                 // 201
  if (callbacks.rightOnly) {                                                                          // 202
    _.each(right, function(rightValue, key) {                                                         // 203
      if (!_.has(left, key))                                                                          // 204
        callbacks.rightOnly(key, rightValue);                                                         // 205
    });                                                                                               // 206
  }                                                                                                   // 207
};                                                                                                    // 208
                                                                                                      // 209
////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                    //
// packages/minimongo/id_map.js                                                                       //
//                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                      //
LocalCollection._IdMap = function () {                                                                // 1
  var self = this;                                                                                    // 2
  IdMap.call(self, LocalCollection._idStringify, LocalCollection._idParse);                           // 3
};                                                                                                    // 4
                                                                                                      // 5
Meteor._inherits(LocalCollection._IdMap, IdMap);                                                      // 6
                                                                                                      // 7
                                                                                                      // 8
////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                    //
// packages/minimongo/observe.js                                                                      //
//                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                      //
// XXX maybe move these into another ObserveHelpers package or something                              // 1
                                                                                                      // 2
// _CachingChangeObserver is an object which receives observeChanges callbacks                        // 3
// and keeps a cache of the current cursor state up to date in self.docs. Users                       // 4
// of this class should read the docs field but not modify it. You should pass                        // 5
// the "applyChange" field as the callbacks to the underlying observeChanges                          // 6
// call. Optionally, you can specify your own observeChanges callbacks which are                      // 7
// invoked immediately before the docs field is updated; this object is made                          // 8
// available as `this` to those callbacks.                                                            // 9
LocalCollection._CachingChangeObserver = function (options) {                                         // 10
  var self = this;                                                                                    // 11
  options = options || {};                                                                            // 12
                                                                                                      // 13
  var orderedFromCallbacks = options.callbacks &&                                                     // 14
        LocalCollection._observeChangesCallbacksAreOrdered(options.callbacks);                        // 15
  if (_.has(options, 'ordered')) {                                                                    // 16
    self.ordered = options.ordered;                                                                   // 17
    if (options.callbacks && options.ordered !== orderedFromCallbacks)                                // 18
      throw Error("ordered option doesn't match callbacks");                                          // 19
  } else if (options.callbacks) {                                                                     // 20
    self.ordered = orderedFromCallbacks;                                                              // 21
  } else {                                                                                            // 22
    throw Error("must provide ordered or callbacks");                                                 // 23
  }                                                                                                   // 24
  var callbacks = options.callbacks || {};                                                            // 25
                                                                                                      // 26
  if (self.ordered) {                                                                                 // 27
    self.docs = new OrderedDict(LocalCollection._idStringify);                                        // 28
    self.applyChange = {                                                                              // 29
      addedBefore: function (id, fields, before) {                                                    // 30
        var doc = EJSON.clone(fields);                                                                // 31
        doc._id = id;                                                                                 // 32
        callbacks.addedBefore && callbacks.addedBefore.call(                                          // 33
          self, id, fields, before);                                                                  // 34
        // This line triggers if we provide added with movedBefore.                                   // 35
        callbacks.added && callbacks.added.call(self, id, fields);                                    // 36
        // XXX could `before` be a falsy ID?  Technically                                             // 37
        // idStringify seems to allow for them -- though                                              // 38
        // OrderedDict won't call stringify on a falsy arg.                                           // 39
        self.docs.putBefore(id, doc, before || null);                                                 // 40
      },                                                                                              // 41
      movedBefore: function (id, before) {                                                            // 42
        var doc = self.docs.get(id);                                                                  // 43
        callbacks.movedBefore && callbacks.movedBefore.call(self, id, before);                        // 44
        self.docs.moveBefore(id, before || null);                                                     // 45
      }                                                                                               // 46
    };                                                                                                // 47
  } else {                                                                                            // 48
    self.docs = new LocalCollection._IdMap;                                                           // 49
    self.applyChange = {                                                                              // 50
      added: function (id, fields) {                                                                  // 51
        var doc = EJSON.clone(fields);                                                                // 52
        callbacks.added && callbacks.added.call(self, id, fields);                                    // 53
        doc._id = id;                                                                                 // 54
        self.docs.set(id,  doc);                                                                      // 55
      }                                                                                               // 56
    };                                                                                                // 57
  }                                                                                                   // 58
                                                                                                      // 59
  // The methods in _IdMap and OrderedDict used by these callbacks are                                // 60
  // identical.                                                                                       // 61
  self.applyChange.changed = function (id, fields) {                                                  // 62
    var doc = self.docs.get(id);                                                                      // 63
    if (!doc)                                                                                         // 64
      throw new Error("Unknown id for changed: " + id);                                               // 65
    callbacks.changed && callbacks.changed.call(                                                      // 66
      self, id, EJSON.clone(fields));                                                                 // 67
    LocalCollection._applyChanges(doc, fields);                                                       // 68
  };                                                                                                  // 69
  self.applyChange.removed = function (id) {                                                          // 70
    callbacks.removed && callbacks.removed.call(self, id);                                            // 71
    self.docs.remove(id);                                                                             // 72
  };                                                                                                  // 73
};                                                                                                    // 74
                                                                                                      // 75
LocalCollection._observeFromObserveChanges = function (cursor, observeCallbacks) {                    // 76
  var transform = cursor.getTransform() || function (doc) {return doc;};                              // 77
  var suppressed = !!observeCallbacks._suppress_initial;                                              // 78
                                                                                                      // 79
  var observeChangesCallbacks;                                                                        // 80
  if (LocalCollection._observeCallbacksAreOrdered(observeCallbacks)) {                                // 81
    // The "_no_indices" option sets all index arguments to -1 and skips the                          // 82
    // linear scans required to generate them.  This lets observers that don't                        // 83
    // need absolute indices benefit from the other features of this API --                           // 84
    // relative order, transforms, and applyChanges -- without the speed hit.                         // 85
    var indices = !observeCallbacks._no_indices;                                                      // 86
    observeChangesCallbacks = {                                                                       // 87
      addedBefore: function (id, fields, before) {                                                    // 88
        var self = this;                                                                              // 89
        if (suppressed || !(observeCallbacks.addedAt || observeCallbacks.added))                      // 90
          return;                                                                                     // 91
        var doc = transform(_.extend(fields, {_id: id}));                                             // 92
        if (observeCallbacks.addedAt) {                                                               // 93
          var index = indices                                                                         // 94
                ? (before ? self.docs.indexOf(before) : self.docs.size()) : -1;                       // 95
          observeCallbacks.addedAt(doc, index, before);                                               // 96
        } else {                                                                                      // 97
          observeCallbacks.added(doc);                                                                // 98
        }                                                                                             // 99
      },                                                                                              // 100
      changed: function (id, fields) {                                                                // 101
        var self = this;                                                                              // 102
        if (!(observeCallbacks.changedAt || observeCallbacks.changed))                                // 103
          return;                                                                                     // 104
        var doc = EJSON.clone(self.docs.get(id));                                                     // 105
        if (!doc)                                                                                     // 106
          throw new Error("Unknown id for changed: " + id);                                           // 107
        var oldDoc = transform(EJSON.clone(doc));                                                     // 108
        LocalCollection._applyChanges(doc, fields);                                                   // 109
        doc = transform(doc);                                                                         // 110
        if (observeCallbacks.changedAt) {                                                             // 111
          var index = indices ? self.docs.indexOf(id) : -1;                                           // 112
          observeCallbacks.changedAt(doc, oldDoc, index);                                             // 113
        } else {                                                                                      // 114
          observeCallbacks.changed(doc, oldDoc);                                                      // 115
        }                                                                                             // 116
      },                                                                                              // 117
      movedBefore: function (id, before) {                                                            // 118
        var self = this;                                                                              // 119
        if (!observeCallbacks.movedTo)                                                                // 120
          return;                                                                                     // 121
        var from = indices ? self.docs.indexOf(id) : -1;                                              // 122
                                                                                                      // 123
        var to = indices                                                                              // 124
              ? (before ? self.docs.indexOf(before) : self.docs.size()) : -1;                         // 125
        // When not moving backwards, adjust for the fact that removing the                           // 126
        // document slides everything back one slot.                                                  // 127
        if (to > from)                                                                                // 128
          --to;                                                                                       // 129
        observeCallbacks.movedTo(transform(EJSON.clone(self.docs.get(id))),                           // 130
                                 from, to, before || null);                                           // 131
      },                                                                                              // 132
      removed: function (id) {                                                                        // 133
        var self = this;                                                                              // 134
        if (!(observeCallbacks.removedAt || observeCallbacks.removed))                                // 135
          return;                                                                                     // 136
        // technically maybe there should be an EJSON.clone here, but it's about                      // 137
        // to be removed from self.docs!                                                              // 138
        var doc = transform(self.docs.get(id));                                                       // 139
        if (observeCallbacks.removedAt) {                                                             // 140
          var index = indices ? self.docs.indexOf(id) : -1;                                           // 141
          observeCallbacks.removedAt(doc, index);                                                     // 142
        } else {                                                                                      // 143
          observeCallbacks.removed(doc);                                                              // 144
        }                                                                                             // 145
      }                                                                                               // 146
    };                                                                                                // 147
  } else {                                                                                            // 148
    observeChangesCallbacks = {                                                                       // 149
      added: function (id, fields) {                                                                  // 150
        if (!suppressed && observeCallbacks.added) {                                                  // 151
          var doc = _.extend(fields, {_id:  id});                                                     // 152
          observeCallbacks.added(transform(doc));                                                     // 153
        }                                                                                             // 154
      },                                                                                              // 155
      changed: function (id, fields) {                                                                // 156
        var self = this;                                                                              // 157
        if (observeCallbacks.changed) {                                                               // 158
          var oldDoc = self.docs.get(id);                                                             // 159
          var doc = EJSON.clone(oldDoc);                                                              // 160
          LocalCollection._applyChanges(doc, fields);                                                 // 161
          observeCallbacks.changed(transform(doc),                                                    // 162
                                   transform(EJSON.clone(oldDoc)));                                   // 163
        }                                                                                             // 164
      },                                                                                              // 165
      removed: function (id) {                                                                        // 166
        var self = this;                                                                              // 167
        if (observeCallbacks.removed) {                                                               // 168
          observeCallbacks.removed(transform(self.docs.get(id)));                                     // 169
        }                                                                                             // 170
      }                                                                                               // 171
    };                                                                                                // 172
  }                                                                                                   // 173
                                                                                                      // 174
  var changeObserver = new LocalCollection._CachingChangeObserver(                                    // 175
    {callbacks: observeChangesCallbacks});                                                            // 176
  var handle = cursor.observeChanges(changeObserver.applyChange);                                     // 177
  suppressed = false;                                                                                 // 178
                                                                                                      // 179
  return handle;                                                                                      // 180
};                                                                                                    // 181
                                                                                                      // 182
////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                    //
// packages/minimongo/objectid.js                                                                     //
//                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                      //
LocalCollection._looksLikeObjectID = function (str) {                                                 // 1
  return str.length === 24 && str.match(/^[0-9a-f]*$/);                                               // 2
};                                                                                                    // 3
                                                                                                      // 4
LocalCollection._ObjectID = function (hexString) {                                                    // 5
  //random-based impl of Mongo ObjectID                                                               // 6
  var self = this;                                                                                    // 7
  if (hexString) {                                                                                    // 8
    hexString = hexString.toLowerCase();                                                              // 9
    if (!LocalCollection._looksLikeObjectID(hexString)) {                                             // 10
      throw new Error("Invalid hexadecimal string for creating an ObjectID");                         // 11
    }                                                                                                 // 12
    // meant to work with _.isEqual(), which relies on structural equality                            // 13
    self._str = hexString;                                                                            // 14
  } else {                                                                                            // 15
    self._str = Random.hexString(24);                                                                 // 16
  }                                                                                                   // 17
};                                                                                                    // 18
                                                                                                      // 19
LocalCollection._ObjectID.prototype.toString = function () {                                          // 20
  var self = this;                                                                                    // 21
  return "ObjectID(\"" + self._str + "\")";                                                           // 22
};                                                                                                    // 23
                                                                                                      // 24
LocalCollection._ObjectID.prototype.equals = function (other) {                                       // 25
  var self = this;                                                                                    // 26
  return other instanceof LocalCollection._ObjectID &&                                                // 27
    self.valueOf() === other.valueOf();                                                               // 28
};                                                                                                    // 29
                                                                                                      // 30
LocalCollection._ObjectID.prototype.clone = function () {                                             // 31
  var self = this;                                                                                    // 32
  return new LocalCollection._ObjectID(self._str);                                                    // 33
};                                                                                                    // 34
                                                                                                      // 35
LocalCollection._ObjectID.prototype.typeName = function() {                                           // 36
  return "oid";                                                                                       // 37
};                                                                                                    // 38
                                                                                                      // 39
LocalCollection._ObjectID.prototype.getTimestamp = function() {                                       // 40
  var self = this;                                                                                    // 41
  return parseInt(self._str.substr(0, 8), 16);                                                        // 42
};                                                                                                    // 43
                                                                                                      // 44
LocalCollection._ObjectID.prototype.valueOf =                                                         // 45
    LocalCollection._ObjectID.prototype.toJSONValue =                                                 // 46
    LocalCollection._ObjectID.prototype.toHexString =                                                 // 47
    function () { return this._str; };                                                                // 48
                                                                                                      // 49
// Is this selector just shorthand for lookup by _id?                                                 // 50
LocalCollection._selectorIsId = function (selector) {                                                 // 51
  return (typeof selector === "string") ||                                                            // 52
    (typeof selector === "number") ||                                                                 // 53
    selector instanceof LocalCollection._ObjectID;                                                    // 54
};                                                                                                    // 55
                                                                                                      // 56
// Is the selector just lookup by _id (shorthand or not)?                                             // 57
LocalCollection._selectorIsIdPerhapsAsObject = function (selector) {                                  // 58
  return LocalCollection._selectorIsId(selector) ||                                                   // 59
    (selector && typeof selector === "object" &&                                                      // 60
     selector._id && LocalCollection._selectorIsId(selector._id) &&                                   // 61
     _.size(selector) === 1);                                                                         // 62
};                                                                                                    // 63
                                                                                                      // 64
// If this is a selector which explicitly constrains the match by ID to a finite                      // 65
// number of documents, returns a list of their IDs.  Otherwise returns                               // 66
// null. Note that the selector may have other restrictions so it may not even                        // 67
// match those document!  We care about $in and $and since those are generated                        // 68
// access-controlled update and remove.                                                               // 69
LocalCollection._idsMatchedBySelector = function (selector) {                                         // 70
  // Is the selector just an ID?                                                                      // 71
  if (LocalCollection._selectorIsId(selector))                                                        // 72
    return [selector];                                                                                // 73
  if (!selector)                                                                                      // 74
    return null;                                                                                      // 75
                                                                                                      // 76
  // Do we have an _id clause?                                                                        // 77
  if (_.has(selector, '_id')) {                                                                       // 78
    // Is the _id clause just an ID?                                                                  // 79
    if (LocalCollection._selectorIsId(selector._id))                                                  // 80
      return [selector._id];                                                                          // 81
    // Is the _id clause {_id: {$in: ["x", "y", "z"]}}?                                               // 82
    if (selector._id && selector._id.$in                                                              // 83
        && _.isArray(selector._id.$in)                                                                // 84
        && !_.isEmpty(selector._id.$in)                                                               // 85
        && _.all(selector._id.$in, LocalCollection._selectorIsId)) {                                  // 86
      return selector._id.$in;                                                                        // 87
    }                                                                                                 // 88
    return null;                                                                                      // 89
  }                                                                                                   // 90
                                                                                                      // 91
  // If this is a top-level $and, and any of the clauses constrain their                              // 92
  // documents, then the whole selector is constrained by any one clause's                            // 93
  // constraint. (Well, by their intersection, but that seems unlikely.)                              // 94
  if (selector.$and && _.isArray(selector.$and)) {                                                    // 95
    for (var i = 0; i < selector.$and.length; ++i) {                                                  // 96
      var subIds = LocalCollection._idsMatchedBySelector(selector.$and[i]);                           // 97
      if (subIds)                                                                                     // 98
        return subIds;                                                                                // 99
    }                                                                                                 // 100
  }                                                                                                   // 101
                                                                                                      // 102
  return null;                                                                                        // 103
};                                                                                                    // 104
                                                                                                      // 105
EJSON.addType("oid",  function (str) {                                                                // 106
  return new LocalCollection._ObjectID(str);                                                          // 107
});                                                                                                   // 108
                                                                                                      // 109
////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                    //
// packages/minimongo/selector_projection.js                                                          //
//                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                      //
// Knows how to combine a mongo selector and a fields projection to a new fields                      // 1
// projection taking into account active fields from the passed selector.                             // 2
// @returns Object - projection object (same as fields option of mongo cursor)                        // 3
Minimongo.Matcher.prototype.combineIntoProjection = function (projection) {                           // 4
  var self = this;                                                                                    // 5
  var selectorPaths = Minimongo._pathsElidingNumericKeys(self._getPaths());                           // 6
                                                                                                      // 7
  // Special case for $where operator in the selector - projection should depend                      // 8
  // on all fields of the document. getSelectorPaths returns a list of paths                          // 9
  // selector depends on. If one of the paths is '' (empty string) representing                       // 10
  // the root or the whole document, complete projection should be returned.                          // 11
  if (_.contains(selectorPaths, ''))                                                                  // 12
    return {};                                                                                        // 13
                                                                                                      // 14
  return combineImportantPathsIntoProjection(selectorPaths, projection);                              // 15
};                                                                                                    // 16
                                                                                                      // 17
Minimongo._pathsElidingNumericKeys = function (paths) {                                               // 18
  var self = this;                                                                                    // 19
  return _.map(paths, function (path) {                                                               // 20
    return _.reject(path.split('.'), isNumericKey).join('.');                                         // 21
  });                                                                                                 // 22
};                                                                                                    // 23
                                                                                                      // 24
combineImportantPathsIntoProjection = function (paths, projection) {                                  // 25
  var prjDetails = projectionDetails(projection);                                                     // 26
  var tree = prjDetails.tree;                                                                         // 27
  var mergedProjection = {};                                                                          // 28
                                                                                                      // 29
  // merge the paths to include                                                                       // 30
  tree = pathsToTree(paths,                                                                           // 31
                     function (path) { return true; },                                                // 32
                     function (node, path, fullPath) { return true; },                                // 33
                     tree);                                                                           // 34
  mergedProjection = treeToPaths(tree);                                                               // 35
  if (prjDetails.including) {                                                                         // 36
    // both selector and projection are pointing on fields to include                                 // 37
    // so we can just return the merged tree                                                          // 38
    return mergedProjection;                                                                          // 39
  } else {                                                                                            // 40
    // selector is pointing at fields to include                                                      // 41
    // projection is pointing at fields to exclude                                                    // 42
    // make sure we don't exclude important paths                                                     // 43
    var mergedExclProjection = {};                                                                    // 44
    _.each(mergedProjection, function (incl, path) {                                                  // 45
      if (!incl)                                                                                      // 46
        mergedExclProjection[path] = false;                                                           // 47
    });                                                                                               // 48
                                                                                                      // 49
    return mergedExclProjection;                                                                      // 50
  }                                                                                                   // 51
};                                                                                                    // 52
                                                                                                      // 53
// Returns a set of key paths similar to                                                              // 54
// { 'foo.bar': 1, 'a.b.c': 1 }                                                                       // 55
var treeToPaths = function (tree, prefix) {                                                           // 56
  prefix = prefix || '';                                                                              // 57
  var result = {};                                                                                    // 58
                                                                                                      // 59
  _.each(tree, function (val, key) {                                                                  // 60
    if (_.isObject(val))                                                                              // 61
      _.extend(result, treeToPaths(val, prefix + key + '.'));                                         // 62
    else                                                                                              // 63
      result[prefix + key] = val;                                                                     // 64
  });                                                                                                 // 65
                                                                                                      // 66
  return result;                                                                                      // 67
};                                                                                                    // 68
                                                                                                      // 69
                                                                                                      // 70
////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                    //
// packages/minimongo/selector_modifier.js                                                            //
//                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                      //
// Returns true if the modifier applied to some document may change the result                        // 1
// of matching the document by selector                                                               // 2
// The modifier is always in a form of Object:                                                        // 3
//  - $set                                                                                            // 4
//    - 'a.b.22.z': value                                                                             // 5
//    - 'foo.bar': 42                                                                                 // 6
//  - $unset                                                                                          // 7
//    - 'abc.d': 1                                                                                    // 8
Minimongo.Matcher.prototype.affectedByModifier = function (modifier) {                                // 9
  var self = this;                                                                                    // 10
  // safe check for $set/$unset being objects                                                         // 11
  modifier = _.extend({ $set: {}, $unset: {} }, modifier);                                            // 12
  var modifiedPaths = _.keys(modifier.$set).concat(_.keys(modifier.$unset));                          // 13
  var meaningfulPaths = self._getPaths();                                                             // 14
                                                                                                      // 15
  return _.any(modifiedPaths, function (path) {                                                       // 16
    var mod = path.split('.');                                                                        // 17
    return _.any(meaningfulPaths, function (meaningfulPath) {                                         // 18
      var sel = meaningfulPath.split('.');                                                            // 19
      var i = 0, j = 0;                                                                               // 20
                                                                                                      // 21
      while (i < sel.length && j < mod.length) {                                                      // 22
        if (isNumericKey(sel[i]) && isNumericKey(mod[j])) {                                           // 23
          // foo.4.bar selector affected by foo.4 modifier                                            // 24
          // foo.3.bar selector unaffected by foo.4 modifier                                          // 25
          if (sel[i] === mod[j])                                                                      // 26
            i++, j++;                                                                                 // 27
          else                                                                                        // 28
            return false;                                                                             // 29
        } else if (isNumericKey(sel[i])) {                                                            // 30
          // foo.4.bar selector unaffected by foo.bar modifier                                        // 31
          return false;                                                                               // 32
        } else if (isNumericKey(mod[j])) {                                                            // 33
          j++;                                                                                        // 34
        } else if (sel[i] === mod[j])                                                                 // 35
          i++, j++;                                                                                   // 36
        else                                                                                          // 37
          return false;                                                                               // 38
      }                                                                                               // 39
                                                                                                      // 40
      // One is a prefix of another, taking numeric fields into account                               // 41
      return true;                                                                                    // 42
    });                                                                                               // 43
  });                                                                                                 // 44
};                                                                                                    // 45
                                                                                                      // 46
// Minimongo.Sorter gets a similar method, which delegates to a Matcher it made                       // 47
// for this exact purpose.                                                                            // 48
Minimongo.Sorter.prototype.affectedByModifier = function (modifier) {                                 // 49
  var self = this;                                                                                    // 50
  return self._selectorForAffectedByModifier.affectedByModifier(modifier);                            // 51
};                                                                                                    // 52
                                                                                                      // 53
// @param modifier - Object: MongoDB-styled modifier with `$set`s and `$unsets`                       // 54
//                           only. (assumed to come from oplog)                                       // 55
// @returns - Boolean: if after applying the modifier, selector can start                             // 56
//                     accepting the modified value.                                                  // 57
// NOTE: assumes that document affected by modifier didn't match this Matcher                         // 58
// before, so if modifier can't convince selector in a positive change it would                       // 59
// stay 'false'.                                                                                      // 60
// Currently doesn't support $-operators and numeric indices precisely.                               // 61
Minimongo.Matcher.prototype.canBecomeTrueByModifier = function (modifier) {                           // 62
  var self = this;                                                                                    // 63
  if (!this.affectedByModifier(modifier))                                                             // 64
    return false;                                                                                     // 65
                                                                                                      // 66
  modifier = _.extend({$set:{}, $unset:{}}, modifier);                                                // 67
  var modifierPaths = _.keys(modifier.$set).concat(_.keys(modifier.$unset));                          // 68
                                                                                                      // 69
  if (!self.isSimple())                                                                               // 70
    return true;                                                                                      // 71
                                                                                                      // 72
  if (_.any(self._getPaths(), pathHasNumericKeys) ||                                                  // 73
      _.any(modifierPaths, pathHasNumericKeys))                                                       // 74
    return true;                                                                                      // 75
                                                                                                      // 76
  // check if there is a $set or $unset that indicates something is an                                // 77
  // object rather than a scalar in the actual object where we saw $-operator                         // 78
  // NOTE: it is correct since we allow only scalars in $-operators                                   // 79
  // Example: for selector {'a.b': {$gt: 5}} the modifier {'a.b.c':7} would                           // 80
  // definitely set the result to false as 'a.b' appears to be an object.                             // 81
  var expectedScalarIsObject = _.any(self._selector, function (sel, path) {                           // 82
    if (! isOperatorObject(sel))                                                                      // 83
      return false;                                                                                   // 84
    return _.any(modifierPaths, function (modifierPath) {                                             // 85
      return startsWith(modifierPath, path + '.');                                                    // 86
    });                                                                                               // 87
  });                                                                                                 // 88
                                                                                                      // 89
  if (expectedScalarIsObject)                                                                         // 90
    return false;                                                                                     // 91
                                                                                                      // 92
  // See if we can apply the modifier on the ideally matching object. If it                           // 93
  // still matches the selector, then the modifier could have turned the real                         // 94
  // object in the database into something matching.                                                  // 95
  var matchingDocument = EJSON.clone(self.matchingDocument());                                        // 96
                                                                                                      // 97
  // The selector is too complex, anything can happen.                                                // 98
  if (matchingDocument === null)                                                                      // 99
    return true;                                                                                      // 100
                                                                                                      // 101
  try {                                                                                               // 102
    LocalCollection._modify(matchingDocument, modifier);                                              // 103
  } catch (e) {                                                                                       // 104
    // Couldn't set a property on a field which is a scalar or null in the                            // 105
    // selector.                                                                                      // 106
    // Example:                                                                                       // 107
    // real document: { 'a.b': 3 }                                                                    // 108
    // selector: { 'a': 12 }                                                                          // 109
    // converted selector (ideal document): { 'a': 12 }                                               // 110
    // modifier: { $set: { 'a.b': 4 } }                                                               // 111
    // We don't know what real document was like but from the error raised by                         // 112
    // $set on a scalar field we can reason that the structure of real document                       // 113
    // is completely different.                                                                       // 114
    if (e.name === "MinimongoError" && e.setPropertyError)                                            // 115
      return false;                                                                                   // 116
    throw e;                                                                                          // 117
  }                                                                                                   // 118
                                                                                                      // 119
  return self.documentMatches(matchingDocument).result;                                               // 120
};                                                                                                    // 121
                                                                                                      // 122
// Returns an object that would match the selector if possible or null if the                         // 123
// selector is too complex for us to analyze                                                          // 124
// { 'a.b': { ans: 42 }, 'foo.bar': null, 'foo.baz': "something" }                                    // 125
// => { a: { b: { ans: 42 } }, foo: { bar: null, baz: "something" } }                                 // 126
Minimongo.Matcher.prototype.matchingDocument = function () {                                          // 127
  var self = this;                                                                                    // 128
                                                                                                      // 129
  // check if it was computed before                                                                  // 130
  if (self._matchingDocument !== undefined)                                                           // 131
    return self._matchingDocument;                                                                    // 132
                                                                                                      // 133
  // If the analysis of this selector is too hard for our implementation                              // 134
  // fallback to "YES"                                                                                // 135
  var fallback = false;                                                                               // 136
  self._matchingDocument = pathsToTree(self._getPaths(),                                              // 137
    function (path) {                                                                                 // 138
      var valueSelector = self._selector[path];                                                       // 139
      if (isOperatorObject(valueSelector)) {                                                          // 140
        // if there is a strict equality, there is a good                                             // 141
        // chance we can use one of those as "matching"                                               // 142
        // dummy value                                                                                // 143
        if (valueSelector.$in) {                                                                      // 144
          var matcher = new Minimongo.Matcher({ placeholder: valueSelector });                        // 145
                                                                                                      // 146
          // Return anything from $in that matches the whole selector for this                        // 147
          // path. If nothing matches, returns `undefined` as nothing can make                        // 148
          // this selector into `true`.                                                               // 149
          return _.find(valueSelector.$in, function (x) {                                             // 150
            return matcher.documentMatches({ placeholder: x }).result;                                // 151
          });                                                                                         // 152
        } else if (onlyContainsKeys(valueSelector, ['$gt', '$gte', '$lt', '$lte'])) {                 // 153
          var lowerBound = -Infinity, upperBound = Infinity;                                          // 154
          _.each(['$lte', '$lt'], function (op) {                                                     // 155
            if (_.has(valueSelector, op) && valueSelector[op] < upperBound)                           // 156
              upperBound = valueSelector[op];                                                         // 157
          });                                                                                         // 158
          _.each(['$gte', '$gt'], function (op) {                                                     // 159
            if (_.has(valueSelector, op) && valueSelector[op] > lowerBound)                           // 160
              lowerBound = valueSelector[op];                                                         // 161
          });                                                                                         // 162
                                                                                                      // 163
          var middle = (lowerBound + upperBound) / 2;                                                 // 164
          var matcher = new Minimongo.Matcher({ placeholder: valueSelector });                        // 165
          if (!matcher.documentMatches({ placeholder: middle }).result &&                             // 166
              (middle === lowerBound || middle === upperBound))                                       // 167
            fallback = true;                                                                          // 168
                                                                                                      // 169
          return middle;                                                                              // 170
        } else if (onlyContainsKeys(valueSelector, ['$nin',' $ne'])) {                                // 171
          // Since self._isSimple makes sure $nin and $ne are not combined with                       // 172
          // objects or arrays, we can confidently return an empty object as it                       // 173
          // never matches any scalar.                                                                // 174
          return {};                                                                                  // 175
        } else {                                                                                      // 176
          fallback = true;                                                                            // 177
        }                                                                                             // 178
      }                                                                                               // 179
      return self._selector[path];                                                                    // 180
    },                                                                                                // 181
    _.identity /*conflict resolution is no resolution*/);                                             // 182
                                                                                                      // 183
  if (fallback)                                                                                       // 184
    self._matchingDocument = null;                                                                    // 185
                                                                                                      // 186
  return self._matchingDocument;                                                                      // 187
};                                                                                                    // 188
                                                                                                      // 189
var getPaths = function (sel) {                                                                       // 190
  return _.keys(new Minimongo.Matcher(sel)._paths);                                                   // 191
  return _.chain(sel).map(function (v, k) {                                                           // 192
    // we don't know how to handle $where because it can be anything                                  // 193
    if (k === "$where")                                                                               // 194
      return ''; // matches everything                                                                // 195
    // we branch from $or/$and/$nor operator                                                          // 196
    if (_.contains(['$or', '$and', '$nor'], k))                                                       // 197
      return _.map(v, getPaths);                                                                      // 198
    // the value is a literal or some comparison operator                                             // 199
    return k;                                                                                         // 200
  }).flatten().uniq().value();                                                                        // 201
};                                                                                                    // 202
                                                                                                      // 203
// A helper to ensure object has only certain keys                                                    // 204
var onlyContainsKeys = function (obj, keys) {                                                         // 205
  return _.all(obj, function (v, k) {                                                                 // 206
    return _.contains(keys, k);                                                                       // 207
  });                                                                                                 // 208
};                                                                                                    // 209
                                                                                                      // 210
var pathHasNumericKeys = function (path) {                                                            // 211
  return _.any(path.split('.'), isNumericKey);                                                        // 212
}                                                                                                     // 213
                                                                                                      // 214
// XXX from Underscore.String (http://epeli.github.com/underscore.string/)                            // 215
var startsWith = function(str, starts) {                                                              // 216
  return str.length >= starts.length &&                                                               // 217
    str.substring(0, starts.length) === starts;                                                       // 218
};                                                                                                    // 219
                                                                                                      // 220
                                                                                                      // 221
////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                    //
// packages/minimongo/sorter_projection.js                                                            //
//                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                      //
Minimongo.Sorter.prototype.combineIntoProjection = function (projection) {                            // 1
  var self = this;                                                                                    // 2
  var specPaths = Minimongo._pathsElidingNumericKeys(self._getPaths());                               // 3
  return combineImportantPathsIntoProjection(specPaths, projection);                                  // 4
};                                                                                                    // 5
                                                                                                      // 6
////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package.minimongo = {
  LocalCollection: LocalCollection,
  Minimongo: Minimongo,
  MinimongoTest: MinimongoTest
};

})();

//# sourceMappingURL=minimongo.js.map
