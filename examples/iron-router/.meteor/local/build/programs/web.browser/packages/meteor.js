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
var _ = Package.underscore._;

/* Package-scope variables */
var Meteor;

(function () {

////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                        //
// packages/meteor/client_environment.js                                                                  //
//                                                                                                        //
////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                          //
/**                                                                                                       // 1
 * @summary The Meteor namespace                                                                          // 2
 * @namespace Meteor                                                                                      // 3
 */                                                                                                       // 4
Meteor = {                                                                                                // 5
                                                                                                          // 6
  /**                                                                                                     // 7
   * @summary Boolean variable.  True if running in client environment.                                   // 8
   * @locus Anywhere                                                                                      // 9
   * @static                                                                                              // 10
   */                                                                                                     // 11
  isClient: true,                                                                                         // 12
                                                                                                          // 13
  /**                                                                                                     // 14
   * @summary Boolean variable.  True if running in server environment.                                   // 15
   * @locus Anywhere                                                                                      // 16
   * @static                                                                                              // 17
   */                                                                                                     // 18
  isServer: false                                                                                         // 19
};                                                                                                        // 20
                                                                                                          // 21
if (typeof __meteor_runtime_config__ === 'object' &&                                                      // 22
    __meteor_runtime_config__.PUBLIC_SETTINGS) {                                                          // 23
  /**                                                                                                     // 24
   * @summary `Meteor.settings` contains deployment-specific configuration options. You can initialize settings by passing the `--settings` option (which takes the name of a file containing JSON data) to `meteor run` or `meteor deploy`. When running your server directly (e.g. from a bundle), you instead specify settings by putting the JSON directly into the `METEOR_SETTINGS` environment variable. If you don't provide any settings, `Meteor.settings` will be an empty object.  If the settings object contains a key named `public`, then `Meteor.settings.public` will be available on the client as well as the server.  All other properties of `Meteor.settings` are only defined on the server.
   * @locus Anywhere                                                                                      // 26
   */                                                                                                     // 27
  Meteor.settings = { 'public': __meteor_runtime_config__.PUBLIC_SETTINGS };                              // 28
}                                                                                                         // 29
                                                                                                          // 30
////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                        //
// packages/meteor/helpers.js                                                                             //
//                                                                                                        //
////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                          //
if (Meteor.isServer)                                                                                      // 1
  var Future = Npm.require('fibers/future');                                                              // 2
                                                                                                          // 3
if (typeof __meteor_runtime_config__ === 'object' &&                                                      // 4
    __meteor_runtime_config__.meteorRelease) {                                                            // 5
  /**                                                                                                     // 6
   * @summary `Meteor.release` is a string containing the name of the [release](#meteorupdate) with which the project was built (for example, `"1.2.3"`). It is `undefined` if the project was built using a git checkout of Meteor.
   * @locus Anywhere                                                                                      // 8
   */                                                                                                     // 9
  Meteor.release = __meteor_runtime_config__.meteorRelease;                                               // 10
}                                                                                                         // 11
                                                                                                          // 12
// XXX find a better home for these? Ideally they would be _.get,                                         // 13
// _.ensure, _.delete..                                                                                   // 14
                                                                                                          // 15
_.extend(Meteor, {                                                                                        // 16
  // _get(a,b,c,d) returns a[b][c][d], or else undefined if a[b] or                                       // 17
  // a[b][c] doesn't exist.                                                                               // 18
  //                                                                                                      // 19
  _get: function (obj /*, arguments */) {                                                                 // 20
    for (var i = 1; i < arguments.length; i++) {                                                          // 21
      if (!(arguments[i] in obj))                                                                         // 22
        return undefined;                                                                                 // 23
      obj = obj[arguments[i]];                                                                            // 24
    }                                                                                                     // 25
    return obj;                                                                                           // 26
  },                                                                                                      // 27
                                                                                                          // 28
  // _ensure(a,b,c,d) ensures that a[b][c][d] exists. If it does not,                                     // 29
  // it is created and set to {}. Either way, it is returned.                                             // 30
  //                                                                                                      // 31
  _ensure: function (obj /*, arguments */) {                                                              // 32
    for (var i = 1; i < arguments.length; i++) {                                                          // 33
      var key = arguments[i];                                                                             // 34
      if (!(key in obj))                                                                                  // 35
        obj[key] = {};                                                                                    // 36
      obj = obj[key];                                                                                     // 37
    }                                                                                                     // 38
                                                                                                          // 39
    return obj;                                                                                           // 40
  },                                                                                                      // 41
                                                                                                          // 42
  // _delete(a, b, c, d) deletes a[b][c][d], then a[b][c] unless it                                       // 43
  // isn't empty, then a[b] unless it isn't empty.                                                        // 44
  //                                                                                                      // 45
  _delete: function (obj /*, arguments */) {                                                              // 46
    var stack = [obj];                                                                                    // 47
    var leaf = true;                                                                                      // 48
    for (var i = 1; i < arguments.length - 1; i++) {                                                      // 49
      var key = arguments[i];                                                                             // 50
      if (!(key in obj)) {                                                                                // 51
        leaf = false;                                                                                     // 52
        break;                                                                                            // 53
      }                                                                                                   // 54
      obj = obj[key];                                                                                     // 55
      if (typeof obj !== "object")                                                                        // 56
        break;                                                                                            // 57
      stack.push(obj);                                                                                    // 58
    }                                                                                                     // 59
                                                                                                          // 60
    for (var i = stack.length - 1; i >= 0; i--) {                                                         // 61
      var key = arguments[i+1];                                                                           // 62
                                                                                                          // 63
      if (leaf)                                                                                           // 64
        leaf = false;                                                                                     // 65
      else                                                                                                // 66
        for (var other in stack[i][key])                                                                  // 67
          return; // not empty -- we're done                                                              // 68
                                                                                                          // 69
      delete stack[i][key];                                                                               // 70
    }                                                                                                     // 71
  },                                                                                                      // 72
                                                                                                          // 73
  // wrapAsync can wrap any function that takes some number of arguments that                             // 74
  // can't be undefined, followed by some optional arguments, where the callback                          // 75
  // is the last optional argument.                                                                       // 76
  // e.g. fs.readFile(pathname, [callback]),                                                              // 77
  // fs.open(pathname, flags, [mode], [callback])                                                         // 78
  // For maximum effectiveness and least confusion, wrapAsync should be used on                           // 79
  // functions where the callback is the only argument of type Function.                                  // 80
                                                                                                          // 81
  /**                                                                                                     // 82
   * @memberOf Meteor                                                                                     // 83
   * @summary Wrap a function that takes a callback function as its final parameter. On the server, the wrapped function can be used either synchronously (without passing a callback) or asynchronously (when a callback is passed). On the client, a callback is always required; errors will be logged if there is no callback. If a callback is provided, the environment captured when the original function was called will be restored in the callback.
   * @locus Anywhere                                                                                      // 85
   * @param {Function} func A function that takes a callback as its final parameter                       // 86
   * @param {Object} [context] Optional `this` object against which the original function will be invoked // 87
   */                                                                                                     // 88
  wrapAsync: function (fn, context) {                                                                     // 89
    return function (/* arguments */) {                                                                   // 90
      var self = context || this;                                                                         // 91
      var newArgs = _.toArray(arguments);                                                                 // 92
      var callback;                                                                                       // 93
                                                                                                          // 94
      for (var i = newArgs.length - 1; i >= 0; --i) {                                                     // 95
        var arg = newArgs[i];                                                                             // 96
        var type = typeof arg;                                                                            // 97
        if (type !== "undefined") {                                                                       // 98
          if (type === "function") {                                                                      // 99
            callback = arg;                                                                               // 100
          }                                                                                               // 101
          break;                                                                                          // 102
        }                                                                                                 // 103
      }                                                                                                   // 104
                                                                                                          // 105
      if (! callback) {                                                                                   // 106
        if (Meteor.isClient) {                                                                            // 107
          callback = logErr;                                                                              // 108
        } else {                                                                                          // 109
          var fut = new Future();                                                                         // 110
          callback = fut.resolver();                                                                      // 111
        }                                                                                                 // 112
        ++i; // Insert the callback just after arg.                                                       // 113
      }                                                                                                   // 114
                                                                                                          // 115
      newArgs[i] = Meteor.bindEnvironment(callback);                                                      // 116
      var result = fn.apply(self, newArgs);                                                               // 117
      return fut ? fut.wait() : result;                                                                   // 118
    };                                                                                                    // 119
  },                                                                                                      // 120
                                                                                                          // 121
  // Sets child's prototype to a new object whose prototype is parent's                                   // 122
  // prototype. Used as:                                                                                  // 123
  //   Meteor._inherits(ClassB, ClassA).                                                                  // 124
  //   _.extend(ClassB.prototype, { ... })                                                                // 125
  // Inspired by CoffeeScript's `extend` and Google Closure's `goog.inherits`.                            // 126
  _inherits: function (Child, Parent) {                                                                   // 127
    // copy Parent static properties                                                                      // 128
    for (var key in Parent) {                                                                             // 129
      // make sure we only copy hasOwnProperty properties vs. prototype                                   // 130
      // properties                                                                                       // 131
      if (_.has(Parent, key))                                                                             // 132
        Child[key] = Parent[key];                                                                         // 133
    }                                                                                                     // 134
                                                                                                          // 135
    // a middle member of prototype chain: takes the prototype from the Parent                            // 136
    var Middle = function () {                                                                            // 137
      this.constructor = Child;                                                                           // 138
    };                                                                                                    // 139
    Middle.prototype = Parent.prototype;                                                                  // 140
    Child.prototype = new Middle();                                                                       // 141
    Child.__super__ = Parent.prototype;                                                                   // 142
    return Child;                                                                                         // 143
  }                                                                                                       // 144
});                                                                                                       // 145
                                                                                                          // 146
var warnedAboutWrapAsync = false;                                                                         // 147
                                                                                                          // 148
/**                                                                                                       // 149
 * @deprecated in 0.9.3                                                                                   // 150
 */                                                                                                       // 151
Meteor._wrapAsync = function(fn, context) {                                                               // 152
  if (! warnedAboutWrapAsync) {                                                                           // 153
    Meteor._debug("Meteor._wrapAsync has been renamed to Meteor.wrapAsync");                              // 154
    warnedAboutWrapAsync = true;                                                                          // 155
  }                                                                                                       // 156
  return Meteor.wrapAsync.apply(Meteor, arguments);                                                       // 157
};                                                                                                        // 158
                                                                                                          // 159
function logErr(err) {                                                                                    // 160
  if (err) {                                                                                              // 161
    return Meteor._debug(                                                                                 // 162
      "Exception in callback of async function",                                                          // 163
      err.stack ? err.stack : err                                                                         // 164
    );                                                                                                    // 165
  }                                                                                                       // 166
}                                                                                                         // 167
                                                                                                          // 168
////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                        //
// packages/meteor/setimmediate.js                                                                        //
//                                                                                                        //
////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                          //
// Chooses one of three setImmediate implementations:                                                     // 1
//                                                                                                        // 2
// * Native setImmediate (IE 10, Node 0.9+)                                                               // 3
//                                                                                                        // 4
// * postMessage (many browsers)                                                                          // 5
//                                                                                                        // 6
// * setTimeout  (fallback)                                                                               // 7
//                                                                                                        // 8
// The postMessage implementation is based on                                                             // 9
// https://github.com/NobleJS/setImmediate/tree/1.0.1                                                     // 10
//                                                                                                        // 11
// Don't use `nextTick` for Node since it runs its callbacks before                                       // 12
// I/O, which is stricter than we're looking for.                                                         // 13
//                                                                                                        // 14
// Not installed as a polyfill, as our public API is `Meteor.defer`.                                      // 15
// Since we're not trying to be a polyfill, we have some                                                  // 16
// simplifications:                                                                                       // 17
//                                                                                                        // 18
// If one invocation of a setImmediate callback pauses itself by a                                        // 19
// call to alert/prompt/showModelDialog, the NobleJS polyfill                                             // 20
// implementation ensured that no setImmedate callback would run until                                    // 21
// the first invocation completed.  While correct per the spec, what it                                   // 22
// would mean for us in practice is that any reactive updates relying                                     // 23
// on Meteor.defer would be hung in the main window until the modal                                       // 24
// dialog was dismissed.  Thus we only ensure that a setImmediate                                         // 25
// function is called in a later event loop.                                                              // 26
//                                                                                                        // 27
// We don't need to support using a string to be eval'ed for the                                          // 28
// callback, arguments to the function, or clearImmediate.                                                // 29
                                                                                                          // 30
"use strict";                                                                                             // 31
                                                                                                          // 32
var global = this;                                                                                        // 33
                                                                                                          // 34
                                                                                                          // 35
// IE 10, Node >= 9.1                                                                                     // 36
                                                                                                          // 37
function useSetImmediate() {                                                                              // 38
  if (! global.setImmediate)                                                                              // 39
    return null;                                                                                          // 40
  else {                                                                                                  // 41
    var setImmediate = function (fn) {                                                                    // 42
      global.setImmediate(fn);                                                                            // 43
    };                                                                                                    // 44
    setImmediate.implementation = 'setImmediate';                                                         // 45
    return setImmediate;                                                                                  // 46
  }                                                                                                       // 47
}                                                                                                         // 48
                                                                                                          // 49
                                                                                                          // 50
// Android 2.3.6, Chrome 26, Firefox 20, IE 8-9, iOS 5.1.1 Safari                                         // 51
                                                                                                          // 52
function usePostMessage() {                                                                               // 53
  // The test against `importScripts` prevents this implementation                                        // 54
  // from being installed inside a web worker, where                                                      // 55
  // `global.postMessage` means something completely different and                                        // 56
  // can't be used for this purpose.                                                                      // 57
                                                                                                          // 58
  if (!global.postMessage || global.importScripts) {                                                      // 59
    return null;                                                                                          // 60
  }                                                                                                       // 61
                                                                                                          // 62
  // Avoid synchronous post message implementations.                                                      // 63
                                                                                                          // 64
  var postMessageIsAsynchronous = true;                                                                   // 65
  var oldOnMessage = global.onmessage;                                                                    // 66
  global.onmessage = function () {                                                                        // 67
      postMessageIsAsynchronous = false;                                                                  // 68
  };                                                                                                      // 69
  global.postMessage("", "*");                                                                            // 70
  global.onmessage = oldOnMessage;                                                                        // 71
                                                                                                          // 72
  if (! postMessageIsAsynchronous)                                                                        // 73
    return null;                                                                                          // 74
                                                                                                          // 75
  var funcIndex = 0;                                                                                      // 76
  var funcs = {};                                                                                         // 77
                                                                                                          // 78
  // Installs an event handler on `global` for the `message` event: see                                   // 79
  // * https://developer.mozilla.org/en/DOM/window.postMessage                                            // 80
  // * http://www.whatwg.org/specs/web-apps/current-work/multipage/comms.html#crossDocumentMessages       // 81
                                                                                                          // 82
  // XXX use Random.id() here?                                                                            // 83
  var MESSAGE_PREFIX = "Meteor._setImmediate." + Math.random() + '.';                                     // 84
                                                                                                          // 85
  function isStringAndStartsWith(string, putativeStart) {                                                 // 86
    return (typeof string === "string" &&                                                                 // 87
            string.substring(0, putativeStart.length) === putativeStart);                                 // 88
  }                                                                                                       // 89
                                                                                                          // 90
  function onGlobalMessage(event) {                                                                       // 91
    // This will catch all incoming messages (even from other                                             // 92
    // windows!), so we need to try reasonably hard to avoid letting                                      // 93
    // anyone else trick us into firing off. We test the origin is                                        // 94
    // still this window, and that a (randomly generated)                                                 // 95
    // unpredictable identifying prefix is present.                                                       // 96
    if (event.source === global &&                                                                        // 97
        isStringAndStartsWith(event.data, MESSAGE_PREFIX)) {                                              // 98
      var index = event.data.substring(MESSAGE_PREFIX.length);                                            // 99
      try {                                                                                               // 100
        if (funcs[index])                                                                                 // 101
          funcs[index]();                                                                                 // 102
      }                                                                                                   // 103
      finally {                                                                                           // 104
        delete funcs[index];                                                                              // 105
      }                                                                                                   // 106
    }                                                                                                     // 107
  }                                                                                                       // 108
                                                                                                          // 109
  if (global.addEventListener) {                                                                          // 110
    global.addEventListener("message", onGlobalMessage, false);                                           // 111
  } else {                                                                                                // 112
    global.attachEvent("onmessage", onGlobalMessage);                                                     // 113
  }                                                                                                       // 114
                                                                                                          // 115
  var setImmediate = function (fn) {                                                                      // 116
    // Make `global` post a message to itself with the handle and                                         // 117
    // identifying prefix, thus asynchronously invoking our                                               // 118
    // onGlobalMessage listener above.                                                                    // 119
    ++funcIndex;                                                                                          // 120
    funcs[funcIndex] = fn;                                                                                // 121
    global.postMessage(MESSAGE_PREFIX + funcIndex, "*");                                                  // 122
  };                                                                                                      // 123
  setImmediate.implementation = 'postMessage';                                                            // 124
  return setImmediate;                                                                                    // 125
}                                                                                                         // 126
                                                                                                          // 127
                                                                                                          // 128
function useTimeout() {                                                                                   // 129
  var setImmediate = function (fn) {                                                                      // 130
    global.setTimeout(fn, 0);                                                                             // 131
  };                                                                                                      // 132
  setImmediate.implementation = 'setTimeout';                                                             // 133
  return setImmediate;                                                                                    // 134
}                                                                                                         // 135
                                                                                                          // 136
                                                                                                          // 137
Meteor._setImmediate =                                                                                    // 138
  useSetImmediate() ||                                                                                    // 139
  usePostMessage() ||                                                                                     // 140
  useTimeout();                                                                                           // 141
                                                                                                          // 142
////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                        //
// packages/meteor/timers.js                                                                              //
//                                                                                                        //
////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                          //
var withoutInvocation = function (f) {                                                                    // 1
  if (Package.ddp) {                                                                                      // 2
    var _CurrentInvocation = Package.ddp.DDP._CurrentInvocation;                                          // 3
    if (_CurrentInvocation.get() && _CurrentInvocation.get().isSimulation)                                // 4
      throw new Error("Can't set timers inside simulations");                                             // 5
    return function () { _CurrentInvocation.withValue(null, f); };                                        // 6
  }                                                                                                       // 7
  else                                                                                                    // 8
    return f;                                                                                             // 9
};                                                                                                        // 10
                                                                                                          // 11
var bindAndCatch = function (context, f) {                                                                // 12
  return Meteor.bindEnvironment(withoutInvocation(f), context);                                           // 13
};                                                                                                        // 14
                                                                                                          // 15
_.extend(Meteor, {                                                                                        // 16
  // Meteor.setTimeout and Meteor.setInterval callbacks scheduled                                         // 17
  // inside a server method are not part of the method invocation and                                     // 18
  // should clear out the CurrentInvocation environment variable.                                         // 19
                                                                                                          // 20
  /**                                                                                                     // 21
   * @memberOf Meteor                                                                                     // 22
   * @summary Call a function in the future after waiting for a specified delay.                          // 23
   * @locus Anywhere                                                                                      // 24
   * @param {Function} func The function to run                                                           // 25
   * @param {Number} delay Number of milliseconds to wait before calling function                         // 26
   */                                                                                                     // 27
  setTimeout: function (f, duration) {                                                                    // 28
    return setTimeout(bindAndCatch("setTimeout callback", f), duration);                                  // 29
  },                                                                                                      // 30
                                                                                                          // 31
  /**                                                                                                     // 32
   * @memberOf Meteor                                                                                     // 33
   * @summary Call a function repeatedly, with a time delay between calls.                                // 34
   * @locus Anywhere                                                                                      // 35
   * @param {Function} func The function to run                                                           // 36
   * @param {Number} delay Number of milliseconds to wait between each function call.                     // 37
   */                                                                                                     // 38
  setInterval: function (f, duration) {                                                                   // 39
    return setInterval(bindAndCatch("setInterval callback", f), duration);                                // 40
  },                                                                                                      // 41
                                                                                                          // 42
  /**                                                                                                     // 43
   * @memberOf Meteor                                                                                     // 44
   * @summary Cancel a repeating function call scheduled by `Meteor.setInterval`.                         // 45
   * @locus Anywhere                                                                                      // 46
   * @param {Number} id The handle returned by `Meteor.setInterval`                                       // 47
   */                                                                                                     // 48
  clearInterval: function(x) {                                                                            // 49
    return clearInterval(x);                                                                              // 50
  },                                                                                                      // 51
                                                                                                          // 52
  /**                                                                                                     // 53
   * @memberOf Meteor                                                                                     // 54
   * @summary Cancel a function call scheduled by `Meteor.setTimeout`.                                    // 55
   * @locus Anywhere                                                                                      // 56
   * @param {Number} id The handle returned by `Meteor.setTimeout`                                        // 57
   */                                                                                                     // 58
  clearTimeout: function(x) {                                                                             // 59
    return clearTimeout(x);                                                                               // 60
  },                                                                                                      // 61
                                                                                                          // 62
  // XXX consider making this guarantee ordering of defer'd callbacks, like                               // 63
  // Tracker.afterFlush or Node's nextTick (in practice). Then tests can do:                              // 64
  //    callSomethingThatDefersSomeWork();                                                                // 65
  //    Meteor.defer(expect(somethingThatValidatesThatTheWorkHappened));                                  // 66
  defer: function (f) {                                                                                   // 67
    Meteor._setImmediate(bindAndCatch("defer callback", f));                                              // 68
  }                                                                                                       // 69
});                                                                                                       // 70
                                                                                                          // 71
////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                        //
// packages/meteor/errors.js                                                                              //
//                                                                                                        //
////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                          //
// Makes an error subclass which properly contains a stack trace in most                                  // 1
// environments. constructor can set fields on `this` (and should probably set                            // 2
// `message`, which is what gets displayed at the top of a stack trace).                                  // 3
//                                                                                                        // 4
Meteor.makeErrorType = function (name, constructor) {                                                     // 5
  var errorClass = function (/*arguments*/) {                                                             // 6
    var self = this;                                                                                      // 7
                                                                                                          // 8
    // Ensure we get a proper stack trace in most Javascript environments                                 // 9
    if (Error.captureStackTrace) {                                                                        // 10
      // V8 environments (Chrome and Node.js)                                                             // 11
      Error.captureStackTrace(self, errorClass);                                                          // 12
    } else {                                                                                              // 13
      // Firefox                                                                                          // 14
      var e = new Error;                                                                                  // 15
      e.__proto__ = errorClass.prototype;                                                                 // 16
      if (e instanceof errorClass)                                                                        // 17
        self = e;                                                                                         // 18
    }                                                                                                     // 19
    // Safari magically works.                                                                            // 20
                                                                                                          // 21
    constructor.apply(self, arguments);                                                                   // 22
                                                                                                          // 23
    self.errorType = name;                                                                                // 24
                                                                                                          // 25
    return self;                                                                                          // 26
  };                                                                                                      // 27
                                                                                                          // 28
  Meteor._inherits(errorClass, Error);                                                                    // 29
                                                                                                          // 30
  return errorClass;                                                                                      // 31
};                                                                                                        // 32
                                                                                                          // 33
// This should probably be in the livedata package, but we don't want                                     // 34
// to require you to use the livedata package to get it. Eventually we                                    // 35
// should probably rename it to DDP.Error and put it back in the                                          // 36
// 'livedata' package (which we should rename to 'ddp' also.)                                             // 37
//                                                                                                        // 38
// Note: The DDP server assumes that Meteor.Error EJSON-serializes as an object                           // 39
// containing 'error' and optionally 'reason' and 'details'.                                              // 40
// The DDP client manually puts these into Meteor.Error objects. (We don't use                            // 41
// EJSON.addType here because the type is determined by location in the                                   // 42
// protocol, not text on the wire.)                                                                       // 43
                                                                                                          // 44
/**                                                                                                       // 45
 * @summary This class represents a symbolic error thrown by a method.                                    // 46
 * @locus Anywhere                                                                                        // 47
 * @class                                                                                                 // 48
 * @param {String} error A string code uniquely identifying this kind of error.                           // 49
 * This string should be used by callers of the method to determine the                                   // 50
 * appropriate action to take, instead of attempting to parse the reason                                  // 51
 * or details fields. For example:                                                                        // 52
 *                                                                                                        // 53
 * ```                                                                                                    // 54
 * // on the server, pick a code unique to this error                                                     // 55
 * // the reason field should be a useful debug message                                                   // 56
 * throw new Meteor.Error("logged-out",                                                                   // 57
 *   "The user must be logged in to post a comment.");                                                    // 58
 *                                                                                                        // 59
 * // on the client                                                                                       // 60
 * Meteor.call("methodName", function (error) {                                                           // 61
 *   // identify the error                                                                                // 62
 *   if (error.error === "logged-out") {                                                                  // 63
 *     // show a nice error message                                                                       // 64
 *     Session.set("errorMessage", "Please log in to post a comment.");                                   // 65
 *   }                                                                                                    // 66
 * });                                                                                                    // 67
 * ```                                                                                                    // 68
 *                                                                                                        // 69
 * For legacy reasons, some built-in Meteor functions such as `check` throw                               // 70
 * errors with a number in this field.                                                                    // 71
 *                                                                                                        // 72
 * @param {String} [reason] Optional.  A short human-readable summary of the                              // 73
 * error, like 'Not Found'.                                                                               // 74
 * @param {String} [details] Optional.  Additional information about the error,                           // 75
 * like a textual stack trace.                                                                            // 76
 */                                                                                                       // 77
Meteor.Error = Meteor.makeErrorType(                                                                      // 78
  "Meteor.Error",                                                                                         // 79
  function (error, reason, details) {                                                                     // 80
    var self = this;                                                                                      // 81
                                                                                                          // 82
    // Currently, a numeric code, likely similar to a HTTP code (eg,                                      // 83
    // 404, 500). That is likely to change though.                                                        // 84
    self.error = error;                                                                                   // 85
                                                                                                          // 86
    // Optional: A short human-readable summary of the error. Not                                         // 87
    // intended to be shown to end users, just developers. ("Not Found",                                  // 88
    // "Internal Server Error")                                                                           // 89
    self.reason = reason;                                                                                 // 90
                                                                                                          // 91
    // Optional: Additional information about the error, say for                                          // 92
    // debugging. It might be a (textual) stack trace if the server is                                    // 93
    // willing to provide one. The corresponding thing in HTTP would be                                   // 94
    // the body of a 404 or 500 response. (The difference is that we                                      // 95
    // never expect this to be shown to end users, only developers, so                                    // 96
    // it doesn't need to be pretty.)                                                                     // 97
    self.details = details;                                                                               // 98
                                                                                                          // 99
    // This is what gets displayed at the top of a stack trace. Current                                   // 100
    // format is "[404]" (if no reason is set) or "File not found [404]"                                  // 101
    if (self.reason)                                                                                      // 102
      self.message = self.reason + ' [' + self.error + ']';                                               // 103
    else                                                                                                  // 104
      self.message = '[' + self.error + ']';                                                              // 105
  });                                                                                                     // 106
                                                                                                          // 107
// Meteor.Error is basically data and is sent over DDP, so you should be able to                          // 108
// properly EJSON-clone it. This is especially important because if a                                     // 109
// Meteor.Error is thrown through a Future, the error, reason, and details                                // 110
// properties become non-enumerable so a standard Object clone won't preserve                             // 111
// them and they will be lost from DDP.                                                                   // 112
Meteor.Error.prototype.clone = function () {                                                              // 113
  var self = this;                                                                                        // 114
  return new Meteor.Error(self.error, self.reason, self.details);                                         // 115
};                                                                                                        // 116
                                                                                                          // 117
////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                        //
// packages/meteor/fiber_stubs_client.js                                                                  //
//                                                                                                        //
////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                          //
// This file is a partial analogue to fiber_helpers.js, which allows the client                           // 1
// to use a queue too, and also to call noYieldsAllowed.                                                  // 2
                                                                                                          // 3
// The client has no ability to yield, so noYieldsAllowed is a noop.                                      // 4
//                                                                                                        // 5
Meteor._noYieldsAllowed = function (f) {                                                                  // 6
  return f();                                                                                             // 7
};                                                                                                        // 8
                                                                                                          // 9
// An even simpler queue of tasks than the fiber-enabled one.  This one just                              // 10
// runs all the tasks when you call runTask or flush, synchronously.                                      // 11
//                                                                                                        // 12
Meteor._SynchronousQueue = function () {                                                                  // 13
  var self = this;                                                                                        // 14
  self._tasks = [];                                                                                       // 15
  self._running = false;                                                                                  // 16
  self._runTimeout = null;                                                                                // 17
};                                                                                                        // 18
                                                                                                          // 19
_.extend(Meteor._SynchronousQueue.prototype, {                                                            // 20
  runTask: function (task) {                                                                              // 21
    var self = this;                                                                                      // 22
    if (!self.safeToRunTask())                                                                            // 23
      throw new Error("Could not synchronously run a task from a running task");                          // 24
    self._tasks.push(task);                                                                               // 25
    var tasks = self._tasks;                                                                              // 26
    self._tasks = [];                                                                                     // 27
    self._running = true;                                                                                 // 28
                                                                                                          // 29
    if (self._runTimeout) {                                                                               // 30
      // Since we're going to drain the queue, we can forget about the timeout                            // 31
      // which tries to run it.  (But if one of our tasks queues something else,                          // 32
      // the timeout will be correctly re-created.)                                                       // 33
      clearTimeout(self._runTimeout);                                                                     // 34
      self._runTimeout = null;                                                                            // 35
    }                                                                                                     // 36
                                                                                                          // 37
    try {                                                                                                 // 38
      while (!_.isEmpty(tasks)) {                                                                         // 39
        var t = tasks.shift();                                                                            // 40
        try {                                                                                             // 41
          t();                                                                                            // 42
        } catch (e) {                                                                                     // 43
          if (_.isEmpty(tasks)) {                                                                         // 44
            // this was the last task, that is, the one we're calling runTask                             // 45
            // for.                                                                                       // 46
            throw e;                                                                                      // 47
          } else {                                                                                        // 48
            Meteor._debug("Exception in queued task: " + e.stack);                                        // 49
          }                                                                                               // 50
        }                                                                                                 // 51
      }                                                                                                   // 52
    } finally {                                                                                           // 53
      self._running = false;                                                                              // 54
    }                                                                                                     // 55
  },                                                                                                      // 56
                                                                                                          // 57
  queueTask: function (task) {                                                                            // 58
    var self = this;                                                                                      // 59
    self._tasks.push(task);                                                                               // 60
    // Intentionally not using Meteor.setTimeout, because it doesn't like runing                          // 61
    // in stubs for now.                                                                                  // 62
    if (!self._runTimeout) {                                                                              // 63
      self._runTimeout = setTimeout(_.bind(self.flush, self), 0);                                         // 64
    }                                                                                                     // 65
  },                                                                                                      // 66
                                                                                                          // 67
  flush: function () {                                                                                    // 68
    var self = this;                                                                                      // 69
    self.runTask(function () {});                                                                         // 70
  },                                                                                                      // 71
                                                                                                          // 72
  drain: function () {                                                                                    // 73
    var self = this;                                                                                      // 74
    if (!self.safeToRunTask())                                                                            // 75
      return;                                                                                             // 76
    while (!_.isEmpty(self._tasks)) {                                                                     // 77
      self.flush();                                                                                       // 78
    }                                                                                                     // 79
  },                                                                                                      // 80
                                                                                                          // 81
  safeToRunTask: function () {                                                                            // 82
    var self = this;                                                                                      // 83
    return !self._running;                                                                                // 84
  }                                                                                                       // 85
});                                                                                                       // 86
                                                                                                          // 87
////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                        //
// packages/meteor/startup_client.js                                                                      //
//                                                                                                        //
////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                          //
var queue = [];                                                                                           // 1
var loaded = !Meteor.isCordova &&                                                                         // 2
  (document.readyState === "loaded" || document.readyState == "complete");                                // 3
                                                                                                          // 4
var awaitingEventsCount = 1;                                                                              // 5
var ready = function() {                                                                                  // 6
  awaitingEventsCount--;                                                                                  // 7
  if (awaitingEventsCount > 0)                                                                            // 8
    return;                                                                                               // 9
                                                                                                          // 10
  // XXX hide the splash screen if such exists, only on mobile                                            // 11
  if (Meteor.isCordova) {                                                                                 // 12
    navigator.splashscreen && navigator.splashscreen.hide();                                              // 13
  }                                                                                                       // 14
                                                                                                          // 15
  loaded = true;                                                                                          // 16
  while (queue.length)                                                                                    // 17
    (queue.shift())();                                                                                    // 18
};                                                                                                        // 19
                                                                                                          // 20
if (document.addEventListener) {                                                                          // 21
  document.addEventListener('DOMContentLoaded', ready, false);                                            // 22
                                                                                                          // 23
  if (Meteor.isCordova) {                                                                                 // 24
    awaitingEventsCount++;                                                                                // 25
    document.addEventListener('deviceready', ready, false);                                               // 26
  }                                                                                                       // 27
                                                                                                          // 28
  window.addEventListener('load', ready, false);                                                          // 29
} else {                                                                                                  // 30
  document.attachEvent('onreadystatechange', function () {                                                // 31
    if (document.readyState === "complete")                                                               // 32
      ready();                                                                                            // 33
  });                                                                                                     // 34
  window.attachEvent('load', ready);                                                                      // 35
}                                                                                                         // 36
                                                                                                          // 37
/**                                                                                                       // 38
 * @summary Run code when a client or a server starts.                                                    // 39
 * @locus Anywhere                                                                                        // 40
 * @param {Function} func A function to run on startup.                                                   // 41
 */                                                                                                       // 42
Meteor.startup = function (cb) {                                                                          // 43
  var doScroll = !document.addEventListener &&                                                            // 44
    document.documentElement.doScroll;                                                                    // 45
                                                                                                          // 46
  if (!doScroll || window !== top) {                                                                      // 47
    if (loaded)                                                                                           // 48
      cb();                                                                                               // 49
    else                                                                                                  // 50
      queue.push(cb);                                                                                     // 51
  } else {                                                                                                // 52
    try { doScroll('left'); }                                                                             // 53
    catch (e) {                                                                                           // 54
      setTimeout(function() { Meteor.startup(cb); }, 50);                                                 // 55
      return;                                                                                             // 56
    };                                                                                                    // 57
    cb();                                                                                                 // 58
  }                                                                                                       // 59
};                                                                                                        // 60
                                                                                                          // 61
////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                        //
// packages/meteor/debug.js                                                                               //
//                                                                                                        //
////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                          //
var suppress = 0;                                                                                         // 1
                                                                                                          // 2
// replacement for console.log. This is a temporary API. We should                                        // 3
// provide a real logging API soon (possibly just a polyfill for                                          // 4
// console?)                                                                                              // 5
//                                                                                                        // 6
// NOTE: this is used on the server to print the warning about                                            // 7
// having autopublish enabled when you probably meant to turn it                                          // 8
// off. it's not really the proper use of something called                                                // 9
// _debug. the intent is for this message to go to the terminal and                                       // 10
// be very visible. if you change _debug to go someplace else, etc,                                       // 11
// please fix the autopublish code to do something reasonable.                                            // 12
//                                                                                                        // 13
Meteor._debug = function (/* arguments */) {                                                              // 14
  if (suppress) {                                                                                         // 15
    suppress--;                                                                                           // 16
    return;                                                                                               // 17
  }                                                                                                       // 18
  if (typeof console !== 'undefined' &&                                                                   // 19
      typeof console.log !== 'undefined') {                                                               // 20
    if (arguments.length == 0) { // IE Companion breaks otherwise                                         // 21
      // IE10 PP4 requires at least one argument                                                          // 22
      console.log('');                                                                                    // 23
    } else {                                                                                              // 24
      // IE doesn't have console.log.apply, it's not a real Object.                                       // 25
      // http://stackoverflow.com/questions/5538972/console-log-apply-not-working-in-ie9                  // 26
      // http://patik.com/blog/complete-cross-browser-console-log/                                        // 27
      if (typeof console.log.apply === "function") {                                                      // 28
        // Most browsers                                                                                  // 29
                                                                                                          // 30
        // Chrome and Safari only hyperlink URLs to source files in first argument of                     // 31
        // console.log, so try to call it with one argument if possible.                                  // 32
        // Approach taken here: If all arguments are strings, join them on space.                         // 33
        // See https://github.com/meteor/meteor/pull/732#issuecomment-13975991                            // 34
        var allArgumentsOfTypeString = true;                                                              // 35
        for (var i = 0; i < arguments.length; i++)                                                        // 36
          if (typeof arguments[i] !== "string")                                                           // 37
            allArgumentsOfTypeString = false;                                                             // 38
                                                                                                          // 39
        if (allArgumentsOfTypeString)                                                                     // 40
          console.log.apply(console, [Array.prototype.join.call(arguments, " ")]);                        // 41
        else                                                                                              // 42
          console.log.apply(console, arguments);                                                          // 43
                                                                                                          // 44
      } else if (typeof Function.prototype.bind === "function") {                                         // 45
        // IE9                                                                                            // 46
        var log = Function.prototype.bind.call(console.log, console);                                     // 47
        log.apply(console, arguments);                                                                    // 48
      } else {                                                                                            // 49
        // IE8                                                                                            // 50
        Function.prototype.call.call(console.log, console, Array.prototype.slice.call(arguments));        // 51
      }                                                                                                   // 52
    }                                                                                                     // 53
  }                                                                                                       // 54
};                                                                                                        // 55
                                                                                                          // 56
// Suppress the next 'count' Meteor._debug messsages. Use this to                                         // 57
// stop tests from spamming the console.                                                                  // 58
//                                                                                                        // 59
Meteor._suppress_log = function (count) {                                                                 // 60
  suppress += count;                                                                                      // 61
};                                                                                                        // 62
                                                                                                          // 63
////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                        //
// packages/meteor/dynamics_browser.js                                                                    //
//                                                                                                        //
////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                          //
// Simple implementation of dynamic scoping, for use in browsers                                          // 1
                                                                                                          // 2
var nextSlot = 0;                                                                                         // 3
var currentValues = [];                                                                                   // 4
                                                                                                          // 5
Meteor.EnvironmentVariable = function () {                                                                // 6
  this.slot = nextSlot++;                                                                                 // 7
};                                                                                                        // 8
                                                                                                          // 9
_.extend(Meteor.EnvironmentVariable.prototype, {                                                          // 10
  get: function () {                                                                                      // 11
    return currentValues[this.slot];                                                                      // 12
  },                                                                                                      // 13
                                                                                                          // 14
  getOrNullIfOutsideFiber: function () {                                                                  // 15
    return this.get();                                                                                    // 16
  },                                                                                                      // 17
                                                                                                          // 18
  withValue: function (value, func) {                                                                     // 19
    var saved = currentValues[this.slot];                                                                 // 20
    try {                                                                                                 // 21
      currentValues[this.slot] = value;                                                                   // 22
      var ret = func();                                                                                   // 23
    } finally {                                                                                           // 24
      currentValues[this.slot] = saved;                                                                   // 25
    }                                                                                                     // 26
    return ret;                                                                                           // 27
  }                                                                                                       // 28
});                                                                                                       // 29
                                                                                                          // 30
Meteor.bindEnvironment = function (func, onException, _this) {                                            // 31
  // needed in order to be able to create closures inside func and                                        // 32
  // have the closed variables not change back to their original                                          // 33
  // values                                                                                               // 34
  var boundValues = _.clone(currentValues);                                                               // 35
                                                                                                          // 36
  if (!onException || typeof(onException) === 'string') {                                                 // 37
    var description = onException || "callback of async function";                                        // 38
    onException = function (error) {                                                                      // 39
      Meteor._debug(                                                                                      // 40
        "Exception in " + description + ":",                                                              // 41
        error && error.stack || error                                                                     // 42
      );                                                                                                  // 43
    };                                                                                                    // 44
  }                                                                                                       // 45
                                                                                                          // 46
  return function (/* arguments */) {                                                                     // 47
    var savedValues = currentValues;                                                                      // 48
    try {                                                                                                 // 49
      currentValues = boundValues;                                                                        // 50
      var ret = func.apply(_this, _.toArray(arguments));                                                  // 51
    } catch (e) {                                                                                         // 52
      // note: callback-hook currently relies on the fact that if onException                             // 53
      // throws in the browser, the wrapped call throws.                                                  // 54
      onException(e);                                                                                     // 55
    } finally {                                                                                           // 56
      currentValues = savedValues;                                                                        // 57
    }                                                                                                     // 58
    return ret;                                                                                           // 59
  };                                                                                                      // 60
};                                                                                                        // 61
                                                                                                          // 62
Meteor._nodeCodeMustBeInFiber = function () {                                                             // 63
  // no-op on browser                                                                                     // 64
};                                                                                                        // 65
                                                                                                          // 66
////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                        //
// packages/meteor/url_common.js                                                                          //
//                                                                                                        //
////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                          //
/**                                                                                                       // 1
 * @summary Generate an absolute URL pointing to the application. The server reads from the `ROOT_URL` environment variable to determine where it is running. This is taken care of automatically for apps deployed with `meteor deploy`, but must be provided when using `meteor bundle`.
 * @locus Anywhere                                                                                        // 3
 * @param {String} [path] A path to append to the root URL. Do not include a leading "`/`".               // 4
 * @param {Object} [options]                                                                              // 5
 * @param {Boolean} options.secure Create an HTTPS URL.                                                   // 6
 * @param {Boolean} options.replaceLocalhost Replace localhost with 127.0.0.1. Useful for services that don't recognize localhost as a domain name.
 * @param {String} options.rootUrl Override the default ROOT_URL from the server environment. For example: "`http://foo.example.com`"
 */                                                                                                       // 9
Meteor.absoluteUrl = function (path, options) {                                                           // 10
  // path is optional                                                                                     // 11
  if (!options && typeof path === 'object') {                                                             // 12
    options = path;                                                                                       // 13
    path = undefined;                                                                                     // 14
  }                                                                                                       // 15
  // merge options with defaults                                                                          // 16
  options = _.extend({}, Meteor.absoluteUrl.defaultOptions, options || {});                               // 17
                                                                                                          // 18
  var url = options.rootUrl;                                                                              // 19
  if (!url)                                                                                               // 20
    throw new Error("Must pass options.rootUrl or set ROOT_URL in the server environment");               // 21
                                                                                                          // 22
  if (!/^http[s]?:\/\//i.test(url)) // url starts with 'http://' or 'https://'                            // 23
    url = 'http://' + url; // we will later fix to https if options.secure is set                         // 24
                                                                                                          // 25
  if (!/\/$/.test(url)) // url ends with '/'                                                              // 26
    url += '/';                                                                                           // 27
                                                                                                          // 28
  if (path)                                                                                               // 29
    url += path;                                                                                          // 30
                                                                                                          // 31
  // turn http to https if secure option is set, and we're not talking                                    // 32
  // to localhost.                                                                                        // 33
  if (options.secure &&                                                                                   // 34
      /^http:/.test(url) && // url starts with 'http:'                                                    // 35
      !/http:\/\/localhost[:\/]/.test(url) && // doesn't match localhost                                  // 36
      !/http:\/\/127\.0\.0\.1[:\/]/.test(url)) // or 127.0.0.1                                            // 37
    url = url.replace(/^http:/, 'https:');                                                                // 38
                                                                                                          // 39
  if (options.replaceLocalhost)                                                                           // 40
    url = url.replace(/^http:\/\/localhost([:\/].*)/, 'http://127.0.0.1$1');                              // 41
                                                                                                          // 42
  return url;                                                                                             // 43
};                                                                                                        // 44
                                                                                                          // 45
// allow later packages to override default options                                                       // 46
Meteor.absoluteUrl.defaultOptions = { };                                                                  // 47
if (typeof __meteor_runtime_config__ === "object" &&                                                      // 48
    __meteor_runtime_config__.ROOT_URL)                                                                   // 49
  Meteor.absoluteUrl.defaultOptions.rootUrl = __meteor_runtime_config__.ROOT_URL;                         // 50
                                                                                                          // 51
                                                                                                          // 52
Meteor._relativeToSiteRootUrl = function (link) {                                                         // 53
  if (typeof __meteor_runtime_config__ === "object" &&                                                    // 54
      link.substr(0, 1) === "/")                                                                          // 55
    link = (__meteor_runtime_config__.ROOT_URL_PATH_PREFIX || "") + link;                                 // 56
  return link;                                                                                            // 57
};                                                                                                        // 58
                                                                                                          // 59
////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package.meteor = {
  Meteor: Meteor
};

})();
