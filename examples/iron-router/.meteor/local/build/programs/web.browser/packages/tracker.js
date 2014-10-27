//////////////////////////////////////////////////////////////////////////
//                                                                      //
// This is a generated file. You can view the original                  //
// source in your browser if your browser supports source maps.         //
//                                                                      //
// If you are using Chrome, open the Developer Tools and click the gear //
// icon in its lower right corner. In the General Settings panel, turn  //
// on 'Enable source maps'.                                             //
//                                                                      //
// If you are using Firefox 23, go to `about:config` and set the        //
// `devtools.debugger.source-maps-enabled` preference to true.          //
// (The preference should be on by default in Firefox 24; versions      //
// older than 23 do not support source maps.)                           //
//                                                                      //
//////////////////////////////////////////////////////////////////////////


(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;

/* Package-scope variables */
var Tracker, Deps;

(function () {

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/tracker/tracker.js                                                                                    //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
//////////////////////////////////////////////////                                                                // 1
// Package docs at http://docs.meteor.com/#tracker //                                                             // 2
//////////////////////////////////////////////////                                                                // 3
                                                                                                                  // 4
Tracker = {};                                                                                                     // 5
                                                                                                                  // 6
// http://docs.meteor.com/#tracker_active                                                                         // 7
                                                                                                                  // 8
/**                                                                                                               // 9
 * @summary True if there is a current computation, meaning that dependencies on reactive data sources will be tracked and potentially cause the current computation to be rerun.
 * @locus Client                                                                                                  // 11
 */                                                                                                               // 12
Tracker.active = false;                                                                                           // 13
                                                                                                                  // 14
// http://docs.meteor.com/#tracker_currentcomputation                                                             // 15
                                                                                                                  // 16
/**                                                                                                               // 17
 * @summary The current computation, or `null` if there isn't one.  The current computation is the [`Tracker.Computation`](#tracker_computation) object created by the innermost active call to `Tracker.autorun`, and it's the computation that gains dependencies when reactive data sources are accessed.
 * @locus Client                                                                                                  // 19
 */                                                                                                               // 20
Tracker.currentComputation = null;                                                                                // 21
                                                                                                                  // 22
var setCurrentComputation = function (c) {                                                                        // 23
  Tracker.currentComputation = c;                                                                                 // 24
  Tracker.active = !! c;                                                                                          // 25
};                                                                                                                // 26
                                                                                                                  // 27
var _debugFunc = function () {                                                                                    // 28
  // We want this code to work without Meteor, and also without                                                   // 29
  // "console" (which is technically non-standard and may be missing                                              // 30
  // on some browser we come across, like it was on IE 7).                                                        // 31
  //                                                                                                              // 32
  // Lazy evaluation because `Meteor` does not exist right away.(??)                                              // 33
  return (typeof Meteor !== "undefined" ? Meteor._debug :                                                         // 34
          ((typeof console !== "undefined") && console.log ?                                                      // 35
           function () { console.log.apply(console, arguments); } :                                               // 36
           function () {}));                                                                                      // 37
};                                                                                                                // 38
                                                                                                                  // 39
var _throwOrLog = function (from, e) {                                                                            // 40
  if (throwFirstError) {                                                                                          // 41
    throw e;                                                                                                      // 42
  } else {                                                                                                        // 43
    var messageAndStack;                                                                                          // 44
    if (e.stack && e.message) {                                                                                   // 45
      var idx = e.stack.indexOf(e.message);                                                                       // 46
      if (idx >= 0 && idx <= 10) // allow for "Error: " (at least 7)                                              // 47
        messageAndStack = e.stack; // message is part of e.stack, as in Chrome                                    // 48
      else                                                                                                        // 49
        messageAndStack = e.message +                                                                             // 50
        (e.stack.charAt(0) === '\n' ? '' : '\n') + e.stack; // e.g. Safari                                        // 51
    } else {                                                                                                      // 52
      messageAndStack = e.stack || e.message;                                                                     // 53
    }                                                                                                             // 54
    _debugFunc()("Exception from Tracker " + from + " function:",                                                 // 55
                 messageAndStack);                                                                                // 56
  }                                                                                                               // 57
};                                                                                                                // 58
                                                                                                                  // 59
// Takes a function `f`, and wraps it in a `Meteor._noYieldsAllowed`                                              // 60
// block if we are running on the server. On the client, returns the                                              // 61
// original function (since `Meteor._noYieldsAllowed` is a                                                        // 62
// no-op). This has the benefit of not adding an unnecessary stack                                                // 63
// frame on the client.                                                                                           // 64
var withNoYieldsAllowed = function (f) {                                                                          // 65
  if ((typeof Meteor === 'undefined') || Meteor.isClient) {                                                       // 66
    return f;                                                                                                     // 67
  } else {                                                                                                        // 68
    return function () {                                                                                          // 69
      var args = arguments;                                                                                       // 70
      Meteor._noYieldsAllowed(function () {                                                                       // 71
        f.apply(null, args);                                                                                      // 72
      });                                                                                                         // 73
    };                                                                                                            // 74
  }                                                                                                               // 75
};                                                                                                                // 76
                                                                                                                  // 77
var nextId = 1;                                                                                                   // 78
// computations whose callbacks we should call at flush time                                                      // 79
var pendingComputations = [];                                                                                     // 80
// `true` if a Tracker.flush is scheduled, or if we are in Tracker.flush now                                      // 81
var willFlush = false;                                                                                            // 82
// `true` if we are in Tracker.flush now                                                                          // 83
var inFlush = false;                                                                                              // 84
// `true` if we are computing a computation now, either first time                                                // 85
// or recompute.  This matches Tracker.active unless we are inside                                                // 86
// Tracker.nonreactive, which nullfies currentComputation even though                                             // 87
// an enclosing computation may still be running.                                                                 // 88
var inCompute = false;                                                                                            // 89
// `true` if the `_throwFirstError` option was passed in to the call                                              // 90
// to Tracker.flush that we are in. When set, throw rather than log the                                           // 91
// first error encountered while flushing. Before throwing the error,                                             // 92
// finish flushing (from a finally block), logging any subsequent                                                 // 93
// errors.                                                                                                        // 94
var throwFirstError = false;                                                                                      // 95
                                                                                                                  // 96
var afterFlushCallbacks = [];                                                                                     // 97
                                                                                                                  // 98
var requireFlush = function () {                                                                                  // 99
  if (! willFlush) {                                                                                              // 100
    setTimeout(Tracker.flush, 0);                                                                                 // 101
    willFlush = true;                                                                                             // 102
  }                                                                                                               // 103
};                                                                                                                // 104
                                                                                                                  // 105
// Tracker.Computation constructor is visible but private                                                         // 106
// (throws an error if you try to call it)                                                                        // 107
var constructingComputation = false;                                                                              // 108
                                                                                                                  // 109
//                                                                                                                // 110
// http://docs.meteor.com/#tracker_computation                                                                    // 111
                                                                                                                  // 112
/**                                                                                                               // 113
 * @summary A Computation object represents code that is repeatedly rerun                                         // 114
 * in response to                                                                                                 // 115
 * reactive data changes. Computations don't have return values; they just                                        // 116
 * perform actions, such as rerendering a template on the screen. Computations                                    // 117
 * are created using Tracker.autorun. Use stop to prevent further rerunning of a                                  // 118
 * computation.                                                                                                   // 119
 * @instancename computation                                                                                      // 120
 */                                                                                                               // 121
Tracker.Computation = function (f, parent) {                                                                      // 122
  if (! constructingComputation)                                                                                  // 123
    throw new Error(                                                                                              // 124
      "Tracker.Computation constructor is private; use Tracker.autorun");                                         // 125
  constructingComputation = false;                                                                                // 126
                                                                                                                  // 127
  var self = this;                                                                                                // 128
                                                                                                                  // 129
  // http://docs.meteor.com/#computation_stopped                                                                  // 130
                                                                                                                  // 131
  /**                                                                                                             // 132
   * @summary True if this computation has been stopped.                                                          // 133
   * @locus Client                                                                                                // 134
   * @memberOf Tracker.Computation                                                                                // 135
   * @instance                                                                                                    // 136
   * @name  stopped                                                                                               // 137
   */                                                                                                             // 138
  self.stopped = false;                                                                                           // 139
                                                                                                                  // 140
  // http://docs.meteor.com/#computation_invalidated                                                              // 141
                                                                                                                  // 142
  /**                                                                                                             // 143
   * @summary True if this computation has been invalidated (and not yet rerun), or if it has been stopped.       // 144
   * @locus Client                                                                                                // 145
   * @memberOf Tracker.Computation                                                                                // 146
   * @instance                                                                                                    // 147
   * @name  invalidated                                                                                           // 148
   */                                                                                                             // 149
  self.invalidated = false;                                                                                       // 150
                                                                                                                  // 151
  // http://docs.meteor.com/#computation_firstrun                                                                 // 152
                                                                                                                  // 153
  /**                                                                                                             // 154
   * @summary True during the initial run of the computation at the time `Tracker.autorun` is called, and false on subsequent reruns and at other times.
   * @locus Client                                                                                                // 156
   * @memberOf Tracker.Computation                                                                                // 157
   * @instance                                                                                                    // 158
   * @name  firstRun                                                                                              // 159
   */                                                                                                             // 160
  self.firstRun = true;                                                                                           // 161
                                                                                                                  // 162
  self._id = nextId++;                                                                                            // 163
  self._onInvalidateCallbacks = [];                                                                               // 164
  // the plan is at some point to use the parent relation                                                         // 165
  // to constrain the order that computations are processed                                                       // 166
  self._parent = parent;                                                                                          // 167
  self._func = f;                                                                                                 // 168
  self._recomputing = false;                                                                                      // 169
                                                                                                                  // 170
  var errored = true;                                                                                             // 171
  try {                                                                                                           // 172
    self._compute();                                                                                              // 173
    errored = false;                                                                                              // 174
  } finally {                                                                                                     // 175
    self.firstRun = false;                                                                                        // 176
    if (errored)                                                                                                  // 177
      self.stop();                                                                                                // 178
  }                                                                                                               // 179
};                                                                                                                // 180
                                                                                                                  // 181
// http://docs.meteor.com/#computation_oninvalidate                                                               // 182
                                                                                                                  // 183
/**                                                                                                               // 184
 * @summary Registers `callback` to run when this computation is next invalidated, or runs it immediately if the computation is already invalidated.  The callback is run exactly once and not upon future invalidations unless `onInvalidate` is called again after the computation becomes valid again.
 * @locus Client                                                                                                  // 186
 * @param {Function} callback Function to be called on invalidation. Receives one argument, the computation that was invalidated.
 */                                                                                                               // 188
Tracker.Computation.prototype.onInvalidate = function (f) {                                                       // 189
  var self = this;                                                                                                // 190
                                                                                                                  // 191
  if (typeof f !== 'function')                                                                                    // 192
    throw new Error("onInvalidate requires a function");                                                          // 193
                                                                                                                  // 194
  if (self.invalidated) {                                                                                         // 195
    Tracker.nonreactive(function () {                                                                             // 196
      withNoYieldsAllowed(f)(self);                                                                               // 197
    });                                                                                                           // 198
  } else {                                                                                                        // 199
    self._onInvalidateCallbacks.push(f);                                                                          // 200
  }                                                                                                               // 201
};                                                                                                                // 202
                                                                                                                  // 203
// http://docs.meteor.com/#computation_invalidate                                                                 // 204
                                                                                                                  // 205
/**                                                                                                               // 206
 * @summary Invalidates this computation so that it will be rerun.                                                // 207
 * @locus Client                                                                                                  // 208
 */                                                                                                               // 209
Tracker.Computation.prototype.invalidate = function () {                                                          // 210
  var self = this;                                                                                                // 211
  if (! self.invalidated) {                                                                                       // 212
    // if we're currently in _recompute(), don't enqueue                                                          // 213
    // ourselves, since we'll rerun immediately anyway.                                                           // 214
    if (! self._recomputing && ! self.stopped) {                                                                  // 215
      requireFlush();                                                                                             // 216
      pendingComputations.push(this);                                                                             // 217
    }                                                                                                             // 218
                                                                                                                  // 219
    self.invalidated = true;                                                                                      // 220
                                                                                                                  // 221
    // callbacks can't add callbacks, because                                                                     // 222
    // self.invalidated === true.                                                                                 // 223
    for(var i = 0, f; f = self._onInvalidateCallbacks[i]; i++) {                                                  // 224
      Tracker.nonreactive(function () {                                                                           // 225
        withNoYieldsAllowed(f)(self);                                                                             // 226
      });                                                                                                         // 227
    }                                                                                                             // 228
    self._onInvalidateCallbacks = [];                                                                             // 229
  }                                                                                                               // 230
};                                                                                                                // 231
                                                                                                                  // 232
// http://docs.meteor.com/#computation_stop                                                                       // 233
                                                                                                                  // 234
/**                                                                                                               // 235
 * @summary Prevents this computation from rerunning.                                                             // 236
 * @locus Client                                                                                                  // 237
 */                                                                                                               // 238
Tracker.Computation.prototype.stop = function () {                                                                // 239
  if (! this.stopped) {                                                                                           // 240
    this.stopped = true;                                                                                          // 241
    this.invalidate();                                                                                            // 242
  }                                                                                                               // 243
};                                                                                                                // 244
                                                                                                                  // 245
Tracker.Computation.prototype._compute = function () {                                                            // 246
  var self = this;                                                                                                // 247
  self.invalidated = false;                                                                                       // 248
                                                                                                                  // 249
  var previous = Tracker.currentComputation;                                                                      // 250
  setCurrentComputation(self);                                                                                    // 251
  var previousInCompute = inCompute;                                                                              // 252
  inCompute = true;                                                                                               // 253
  try {                                                                                                           // 254
    withNoYieldsAllowed(self._func)(self);                                                                        // 255
  } finally {                                                                                                     // 256
    setCurrentComputation(previous);                                                                              // 257
    inCompute = false;                                                                                            // 258
  }                                                                                                               // 259
};                                                                                                                // 260
                                                                                                                  // 261
Tracker.Computation.prototype._recompute = function () {                                                          // 262
  var self = this;                                                                                                // 263
                                                                                                                  // 264
  self._recomputing = true;                                                                                       // 265
  try {                                                                                                           // 266
    while (self.invalidated && ! self.stopped) {                                                                  // 267
      try {                                                                                                       // 268
        self._compute();                                                                                          // 269
      } catch (e) {                                                                                               // 270
        _throwOrLog("recompute", e);                                                                              // 271
      }                                                                                                           // 272
      // If _compute() invalidated us, we run again immediately.                                                  // 273
      // A computation that invalidates itself indefinitely is an                                                 // 274
      // infinite loop, of course.                                                                                // 275
      //                                                                                                          // 276
      // We could put an iteration counter here and catch run-away                                                // 277
      // loops.                                                                                                   // 278
    }                                                                                                             // 279
  } finally {                                                                                                     // 280
    self._recomputing = false;                                                                                    // 281
  }                                                                                                               // 282
};                                                                                                                // 283
                                                                                                                  // 284
//                                                                                                                // 285
// http://docs.meteor.com/#tracker_dependency                                                                     // 286
                                                                                                                  // 287
/**                                                                                                               // 288
 * @summary A Dependency represents an atomic unit of reactive data that a                                        // 289
 * computation might depend on. Reactive data sources such as Session or                                          // 290
 * Minimongo internally create different Dependency objects for different                                         // 291
 * pieces of data, each of which may be depended on by multiple computations.                                     // 292
 * When the data changes, the computations are invalidated.                                                       // 293
 * @class                                                                                                         // 294
 * @instanceName dependency                                                                                       // 295
 */                                                                                                               // 296
Tracker.Dependency = function () {                                                                                // 297
  this._dependentsById = {};                                                                                      // 298
};                                                                                                                // 299
                                                                                                                  // 300
// http://docs.meteor.com/#dependency_depend                                                                      // 301
//                                                                                                                // 302
// Adds `computation` to this set if it is not already                                                            // 303
// present.  Returns true if `computation` is a new member of the set.                                            // 304
// If no argument, defaults to currentComputation, or does nothing                                                // 305
// if there is no currentComputation.                                                                             // 306
                                                                                                                  // 307
/**                                                                                                               // 308
 * @summary Declares that the current computation (or `fromComputation` if given) depends on `dependency`.  The computation will be invalidated the next time `dependency` changes.
                                                                                                                  // 310
If there is no current computation and `depend()` is called with no arguments, it does nothing and returns false. // 311
                                                                                                                  // 312
Returns true if the computation is a new dependent of `dependency` rather than an existing one.                   // 313
 * @locus Client                                                                                                  // 314
 * @param {Tracker.Computation} [fromComputation] An optional computation declared to depend on `dependency` instead of the current computation.
 */                                                                                                               // 316
Tracker.Dependency.prototype.depend = function (computation) {                                                    // 317
  if (! computation) {                                                                                            // 318
    if (! Tracker.active)                                                                                         // 319
      return false;                                                                                               // 320
                                                                                                                  // 321
    computation = Tracker.currentComputation;                                                                     // 322
  }                                                                                                               // 323
  var self = this;                                                                                                // 324
  var id = computation._id;                                                                                       // 325
  if (! (id in self._dependentsById)) {                                                                           // 326
    self._dependentsById[id] = computation;                                                                       // 327
    computation.onInvalidate(function () {                                                                        // 328
      delete self._dependentsById[id];                                                                            // 329
    });                                                                                                           // 330
    return true;                                                                                                  // 331
  }                                                                                                               // 332
  return false;                                                                                                   // 333
};                                                                                                                // 334
                                                                                                                  // 335
// http://docs.meteor.com/#dependency_changed                                                                     // 336
                                                                                                                  // 337
/**                                                                                                               // 338
 * @summary Invalidate all dependent computations immediately and remove them as dependents.                      // 339
 * @locus Client                                                                                                  // 340
 */                                                                                                               // 341
Tracker.Dependency.prototype.changed = function () {                                                              // 342
  var self = this;                                                                                                // 343
  for (var id in self._dependentsById)                                                                            // 344
    self._dependentsById[id].invalidate();                                                                        // 345
};                                                                                                                // 346
                                                                                                                  // 347
// http://docs.meteor.com/#dependency_hasdependents                                                               // 348
                                                                                                                  // 349
/**                                                                                                               // 350
 * @summary True if this Dependency has one or more dependent Computations, which would be invalidated if this Dependency were to change.
 * @locus Client                                                                                                  // 352
 */                                                                                                               // 353
Tracker.Dependency.prototype.hasDependents = function () {                                                        // 354
  var self = this;                                                                                                // 355
  for(var id in self._dependentsById)                                                                             // 356
    return true;                                                                                                  // 357
  return false;                                                                                                   // 358
};                                                                                                                // 359
                                                                                                                  // 360
// http://docs.meteor.com/#tracker_flush                                                                          // 361
                                                                                                                  // 362
/**                                                                                                               // 363
 * @summary Process all reactive updates immediately and ensure that all invalidated computations are rerun.      // 364
 * @locus Client                                                                                                  // 365
 */                                                                                                               // 366
Tracker.flush = function (_opts) {                                                                                // 367
  // XXX What part of the comment below is still true? (We no longer                                              // 368
  // have Spark)                                                                                                  // 369
  //                                                                                                              // 370
  // Nested flush could plausibly happen if, say, a flush causes                                                  // 371
  // DOM mutation, which causes a "blur" event, which runs an                                                     // 372
  // app event handler that calls Tracker.flush.  At the moment                                                   // 373
  // Spark blocks event handlers during DOM mutation anyway,                                                      // 374
  // because the LiveRange tree isn't valid.  And we don't have                                                   // 375
  // any useful notion of a nested flush.                                                                         // 376
  //                                                                                                              // 377
  // https://app.asana.com/0/159908330244/385138233856                                                            // 378
  if (inFlush)                                                                                                    // 379
    throw new Error("Can't call Tracker.flush while flushing");                                                   // 380
                                                                                                                  // 381
  if (inCompute)                                                                                                  // 382
    throw new Error("Can't flush inside Tracker.autorun");                                                        // 383
                                                                                                                  // 384
  inFlush = true;                                                                                                 // 385
  willFlush = true;                                                                                               // 386
  throwFirstError = !! (_opts && _opts._throwFirstError);                                                         // 387
                                                                                                                  // 388
  var finishedTry = false;                                                                                        // 389
  try {                                                                                                           // 390
    while (pendingComputations.length ||                                                                          // 391
           afterFlushCallbacks.length) {                                                                          // 392
                                                                                                                  // 393
      // recompute all pending computations                                                                       // 394
      while (pendingComputations.length) {                                                                        // 395
        var comp = pendingComputations.shift();                                                                   // 396
        comp._recompute();                                                                                        // 397
      }                                                                                                           // 398
                                                                                                                  // 399
      if (afterFlushCallbacks.length) {                                                                           // 400
        // call one afterFlush callback, which may                                                                // 401
        // invalidate more computations                                                                           // 402
        var func = afterFlushCallbacks.shift();                                                                   // 403
        try {                                                                                                     // 404
          func();                                                                                                 // 405
        } catch (e) {                                                                                             // 406
          _throwOrLog("afterFlush", e);                                                                           // 407
        }                                                                                                         // 408
      }                                                                                                           // 409
    }                                                                                                             // 410
    finishedTry = true;                                                                                           // 411
  } finally {                                                                                                     // 412
    if (! finishedTry) {                                                                                          // 413
      // we're erroring                                                                                           // 414
      inFlush = false; // needed before calling `Tracker.flush()` again                                           // 415
      Tracker.flush({_throwFirstError: false}); // finish flushing                                                // 416
    }                                                                                                             // 417
    willFlush = false;                                                                                            // 418
    inFlush = false;                                                                                              // 419
  }                                                                                                               // 420
};                                                                                                                // 421
                                                                                                                  // 422
// http://docs.meteor.com/#tracker_autorun                                                                        // 423
//                                                                                                                // 424
// Run f(). Record its dependencies. Rerun it whenever the                                                        // 425
// dependencies change.                                                                                           // 426
//                                                                                                                // 427
// Returns a new Computation, which is also passed to f.                                                          // 428
//                                                                                                                // 429
// Links the computation to the current computation                                                               // 430
// so that it is stopped if the current computation is invalidated.                                               // 431
                                                                                                                  // 432
/**                                                                                                               // 433
 * @summary Run a function now and rerun it later whenever its dependencies change. Returns a Computation object that can be used to stop or observe the rerunning.
 * @locus Client                                                                                                  // 435
 * @param {Function} runFunc The function to run. It receives one argument: the Computation object that will be returned.
 */                                                                                                               // 437
Tracker.autorun = function (f) {                                                                                  // 438
  if (typeof f !== 'function')                                                                                    // 439
    throw new Error('Tracker.autorun requires a function argument');                                              // 440
                                                                                                                  // 441
  constructingComputation = true;                                                                                 // 442
  var c = new Tracker.Computation(f, Tracker.currentComputation);                                                 // 443
                                                                                                                  // 444
  if (Tracker.active)                                                                                             // 445
    Tracker.onInvalidate(function () {                                                                            // 446
      c.stop();                                                                                                   // 447
    });                                                                                                           // 448
                                                                                                                  // 449
  return c;                                                                                                       // 450
};                                                                                                                // 451
                                                                                                                  // 452
// http://docs.meteor.com/#tracker_nonreactive                                                                    // 453
//                                                                                                                // 454
// Run `f` with no current computation, returning the return value                                                // 455
// of `f`.  Used to turn off reactivity for the duration of `f`,                                                  // 456
// so that reactive data sources accessed by `f` will not result in any                                           // 457
// computations being invalidated.                                                                                // 458
                                                                                                                  // 459
/**                                                                                                               // 460
 * @summary Run a function without tracking dependencies.                                                         // 461
 * @locus Client                                                                                                  // 462
 * @param {Function} func A function to call immediately.                                                         // 463
 */                                                                                                               // 464
Tracker.nonreactive = function (f) {                                                                              // 465
  var previous = Tracker.currentComputation;                                                                      // 466
  setCurrentComputation(null);                                                                                    // 467
  try {                                                                                                           // 468
    return f();                                                                                                   // 469
  } finally {                                                                                                     // 470
    setCurrentComputation(previous);                                                                              // 471
  }                                                                                                               // 472
};                                                                                                                // 473
                                                                                                                  // 474
// http://docs.meteor.com/#tracker_oninvalidate                                                                   // 475
                                                                                                                  // 476
/**                                                                                                               // 477
 * @summary Registers a new [`onInvalidate`](#computation_oninvalidate) callback on the current computation (which must exist), to be called immediately when the current computation is invalidated or stopped.
 * @locus Client                                                                                                  // 479
 * @param {Function} callback A callback function that will be invoked as `func(c)`, where `c` is the computation on which the callback is registered.
 */                                                                                                               // 481
Tracker.onInvalidate = function (f) {                                                                             // 482
  if (! Tracker.active)                                                                                           // 483
    throw new Error("Tracker.onInvalidate requires a currentComputation");                                        // 484
                                                                                                                  // 485
  Tracker.currentComputation.onInvalidate(f);                                                                     // 486
};                                                                                                                // 487
                                                                                                                  // 488
// http://docs.meteor.com/#tracker_afterflush                                                                     // 489
                                                                                                                  // 490
/**                                                                                                               // 491
 * @summary Schedules a function to be called during the next flush, or later in the current flush if one is in progress, after all invalidated computations have been rerun.  The function will be run once and not on subsequent flushes unless `afterFlush` is called again.
 * @locus Client                                                                                                  // 493
 * @param {Function} callback A function to call at flush time.                                                   // 494
 */                                                                                                               // 495
Tracker.afterFlush = function (f) {                                                                               // 496
  afterFlushCallbacks.push(f);                                                                                    // 497
  requireFlush();                                                                                                 // 498
};                                                                                                                // 499
                                                                                                                  // 500
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/tracker/deprecated.js                                                                                 //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
// Deprecated functions.                                                                                          // 1
                                                                                                                  // 2
// These functions used to be on the Meteor object (and worked slightly                                           // 3
// differently).                                                                                                  // 4
// XXX COMPAT WITH 0.5.7                                                                                          // 5
Meteor.flush = Tracker.flush;                                                                                     // 6
Meteor.autorun = Tracker.autorun;                                                                                 // 7
                                                                                                                  // 8
// We used to require a special "autosubscribe" call to reactively subscribe to                                   // 9
// things. Now, it works with autorun.                                                                            // 10
// XXX COMPAT WITH 0.5.4                                                                                          // 11
Meteor.autosubscribe = Tracker.autorun;                                                                           // 12
                                                                                                                  // 13
// This Tracker API briefly existed in 0.5.8 and 0.5.9                                                            // 14
// XXX COMPAT WITH 0.5.9                                                                                          // 15
Tracker.depend = function (d) {                                                                                   // 16
  return d.depend();                                                                                              // 17
};                                                                                                                // 18
                                                                                                                  // 19
Deps = Tracker;                                                                                                   // 20
                                                                                                                  // 21
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package.tracker = {
  Tracker: Tracker,
  Deps: Deps
};

})();
