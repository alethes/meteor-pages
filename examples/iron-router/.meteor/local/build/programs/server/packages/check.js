(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var _ = Package.underscore._;
var EJSON = Package.ejson.EJSON;

/* Package-scope variables */
var check, Match;

(function () {

///////////////////////////////////////////////////////////////////////////////////
//                                                                               //
// packages/check/match.js                                                       //
//                                                                               //
///////////////////////////////////////////////////////////////////////////////////
                                                                                 //
// XXX docs                                                                      // 1
                                                                                 // 2
// Things we explicitly do NOT support:                                          // 3
//    - heterogenous arrays                                                      // 4
                                                                                 // 5
var currentArgumentChecker = new Meteor.EnvironmentVariable;                     // 6
                                                                                 // 7
/**                                                                              // 8
 * @summary Check that a value matches a [pattern](#matchpatterns).              // 9
 * If the value does not match the pattern, throw a `Match.Error`.               // 10
 *                                                                               // 11
 * Particularly useful to assert that arguments to a function have the right     // 12
 * types and structure.                                                          // 13
 * @locus Anywhere                                                               // 14
 * @param {Any} value The value to check                                         // 15
 * @param {MatchPattern} pattern The pattern to match                            // 16
 * `value` against                                                               // 17
 */                                                                              // 18
check = function (value, pattern) {                                              // 19
  // Record that check got called, if somebody cared.                            // 20
  //                                                                             // 21
  // We use getOrNullIfOutsideFiber so that it's OK to call check()              // 22
  // from non-Fiber server contexts; the downside is that if you forget to       // 23
  // bindEnvironment on some random callback in your method/publisher,           // 24
  // it might not find the argumentChecker and you'll get an error about         // 25
  // not checking an argument that it looks like you're checking (instead        // 26
  // of just getting a "Node code must run in a Fiber" error).                   // 27
  var argChecker = currentArgumentChecker.getOrNullIfOutsideFiber();             // 28
  if (argChecker)                                                                // 29
    argChecker.checking(value);                                                  // 30
  try {                                                                          // 31
    checkSubtree(value, pattern);                                                // 32
  } catch (err) {                                                                // 33
    if ((err instanceof Match.Error) && err.path)                                // 34
      err.message += " in field " + err.path;                                    // 35
    throw err;                                                                   // 36
  }                                                                              // 37
};                                                                               // 38
                                                                                 // 39
Match = {                                                                        // 40
  Optional: function (pattern) {                                                 // 41
    return new Optional(pattern);                                                // 42
  },                                                                             // 43
  OneOf: function (/*arguments*/) {                                              // 44
    return new OneOf(_.toArray(arguments));                                      // 45
  },                                                                             // 46
  Any: ['__any__'],                                                              // 47
  Where: function (condition) {                                                  // 48
    return new Where(condition);                                                 // 49
  },                                                                             // 50
  ObjectIncluding: function (pattern) {                                          // 51
    return new ObjectIncluding(pattern);                                         // 52
  },                                                                             // 53
  ObjectWithValues: function (pattern) {                                         // 54
    return new ObjectWithValues(pattern);                                        // 55
  },                                                                             // 56
  // Matches only signed 32-bit integers                                         // 57
  Integer: ['__integer__'],                                                      // 58
                                                                                 // 59
  // XXX matchers should know how to describe themselves for errors              // 60
  Error: Meteor.makeErrorType("Match.Error", function (msg) {                    // 61
    this.message = "Match error: " + msg;                                        // 62
    // The path of the value that failed to match. Initially empty, this gets    // 63
    // populated by catching and rethrowing the exception as it goes back up the // 64
    // stack.                                                                    // 65
    // E.g.: "vals[3].entity.created"                                            // 66
    this.path = "";                                                              // 67
    // If this gets sent over DDP, don't give full internal details but at least // 68
    // provide something better than 500 Internal server error.                  // 69
    this.sanitizedError = new Meteor.Error(400, "Match failed");                 // 70
  }),                                                                            // 71
                                                                                 // 72
  // Tests to see if value matches pattern. Unlike check, it merely returns true // 73
  // or false (unless an error other than Match.Error was thrown). It does not   // 74
  // interact with _failIfArgumentsAreNotAllChecked.                             // 75
  // XXX maybe also implement a Match.match which returns more information about // 76
  //     failures but without using exception handling or doing what check()     // 77
  //     does with _failIfArgumentsAreNotAllChecked and Meteor.Error conversion  // 78
                                                                                 // 79
  /**                                                                            // 80
   * @summary Returns true if the value matches the pattern.                     // 81
   * @locus Anywhere                                                             // 82
   * @param {Any} value The value to check                                       // 83
   * @param {MatchPattern} pattern The pattern to match `value` against          // 84
   */                                                                            // 85
  test: function (value, pattern) {                                              // 86
    try {                                                                        // 87
      checkSubtree(value, pattern);                                              // 88
      return true;                                                               // 89
    } catch (e) {                                                                // 90
      if (e instanceof Match.Error)                                              // 91
        return false;                                                            // 92
      // Rethrow other errors.                                                   // 93
      throw e;                                                                   // 94
    }                                                                            // 95
  },                                                                             // 96
                                                                                 // 97
  // Runs `f.apply(context, args)`. If check() is not called on every element of // 98
  // `args` (either directly or in the first level of an array), throws an error // 99
  // (using `description` in the message).                                       // 100
  //                                                                             // 101
  _failIfArgumentsAreNotAllChecked: function (f, context, args, description) {   // 102
    var argChecker = new ArgumentChecker(args, description);                     // 103
    var result = currentArgumentChecker.withValue(argChecker, function () {      // 104
      return f.apply(context, args);                                             // 105
    });                                                                          // 106
    // If f didn't itself throw, make sure it checked all of its arguments.      // 107
    argChecker.throwUnlessAllArgumentsHaveBeenChecked();                         // 108
    return result;                                                               // 109
  }                                                                              // 110
};                                                                               // 111
                                                                                 // 112
var Optional = function (pattern) {                                              // 113
  this.pattern = pattern;                                                        // 114
};                                                                               // 115
                                                                                 // 116
var OneOf = function (choices) {                                                 // 117
  if (_.isEmpty(choices))                                                        // 118
    throw new Error("Must provide at least one choice to Match.OneOf");          // 119
  this.choices = choices;                                                        // 120
};                                                                               // 121
                                                                                 // 122
var Where = function (condition) {                                               // 123
  this.condition = condition;                                                    // 124
};                                                                               // 125
                                                                                 // 126
var ObjectIncluding = function (pattern) {                                       // 127
  this.pattern = pattern;                                                        // 128
};                                                                               // 129
                                                                                 // 130
var ObjectWithValues = function (pattern) {                                      // 131
  this.pattern = pattern;                                                        // 132
};                                                                               // 133
                                                                                 // 134
var typeofChecks = [                                                             // 135
  [String, "string"],                                                            // 136
  [Number, "number"],                                                            // 137
  [Boolean, "boolean"],                                                          // 138
  // While we don't allow undefined in EJSON, this is good for optional          // 139
  // arguments with OneOf.                                                       // 140
  [undefined, "undefined"]                                                       // 141
];                                                                               // 142
                                                                                 // 143
var checkSubtree = function (value, pattern) {                                   // 144
  // Match anything!                                                             // 145
  if (pattern === Match.Any)                                                     // 146
    return;                                                                      // 147
                                                                                 // 148
  // Basic atomic types.                                                         // 149
  // Do not match boxed objects (e.g. String, Boolean)                           // 150
  for (var i = 0; i < typeofChecks.length; ++i) {                                // 151
    if (pattern === typeofChecks[i][0]) {                                        // 152
      if (typeof value === typeofChecks[i][1])                                   // 153
        return;                                                                  // 154
      throw new Match.Error("Expected " + typeofChecks[i][1] + ", got " +        // 155
                            typeof value);                                       // 156
    }                                                                            // 157
  }                                                                              // 158
  if (pattern === null) {                                                        // 159
    if (value === null)                                                          // 160
      return;                                                                    // 161
    throw new Match.Error("Expected null, got " + EJSON.stringify(value));       // 162
  }                                                                              // 163
                                                                                 // 164
  // Strings and numbers match literally.  Goes well with Match.OneOf.           // 165
  if (typeof pattern === "string" || typeof pattern === "number") {              // 166
    if (value === pattern)                                                       // 167
      return;                                                                    // 168
    throw new Match.Error("Expected " + pattern + ", got " +                     // 169
                          EJSON.stringify(value));                               // 170
  }                                                                              // 171
                                                                                 // 172
  // Match.Integer is special type encoded with array                            // 173
  if (pattern === Match.Integer) {                                               // 174
    // There is no consistent and reliable way to check if variable is a 64-bit  // 175
    // integer. One of the popular solutions is to get reminder of division by 1 // 176
    // but this method fails on really large floats with big precision.          // 177
    // E.g.: 1.348192308491824e+23 % 1 === 0 in V8                               // 178
    // Bitwise operators work consistantly but always cast variable to 32-bit    // 179
    // signed integer according to JavaScript specs.                             // 180
    if (typeof value === "number" && (value | 0) === value)                      // 181
      return                                                                     // 182
    throw new Match.Error("Expected Integer, got "                               // 183
                + (value instanceof Object ? EJSON.stringify(value) : value));   // 184
  }                                                                              // 185
                                                                                 // 186
  // "Object" is shorthand for Match.ObjectIncluding({});                        // 187
  if (pattern === Object)                                                        // 188
    pattern = Match.ObjectIncluding({});                                         // 189
                                                                                 // 190
  // Array (checked AFTER Any, which is implemented as an Array).                // 191
  if (pattern instanceof Array) {                                                // 192
    if (pattern.length !== 1)                                                    // 193
      throw Error("Bad pattern: arrays must have one type element" +             // 194
                  EJSON.stringify(pattern));                                     // 195
    if (!_.isArray(value) && !_.isArguments(value)) {                            // 196
      throw new Match.Error("Expected array, got " + EJSON.stringify(value));    // 197
    }                                                                            // 198
                                                                                 // 199
    _.each(value, function (valueElement, index) {                               // 200
      try {                                                                      // 201
        checkSubtree(valueElement, pattern[0]);                                  // 202
      } catch (err) {                                                            // 203
        if (err instanceof Match.Error) {                                        // 204
          err.path = _prependPath(index, err.path);                              // 205
        }                                                                        // 206
        throw err;                                                               // 207
      }                                                                          // 208
    });                                                                          // 209
    return;                                                                      // 210
  }                                                                              // 211
                                                                                 // 212
  // Arbitrary validation checks. The condition can return false or throw a      // 213
  // Match.Error (ie, it can internally use check()) to fail.                    // 214
  if (pattern instanceof Where) {                                                // 215
    if (pattern.condition(value))                                                // 216
      return;                                                                    // 217
    // XXX this error is terrible                                                // 218
    throw new Match.Error("Failed Match.Where validation");                      // 219
  }                                                                              // 220
                                                                                 // 221
                                                                                 // 222
  if (pattern instanceof Optional)                                               // 223
    pattern = Match.OneOf(undefined, pattern.pattern);                           // 224
                                                                                 // 225
  if (pattern instanceof OneOf) {                                                // 226
    for (var i = 0; i < pattern.choices.length; ++i) {                           // 227
      try {                                                                      // 228
        checkSubtree(value, pattern.choices[i]);                                 // 229
        // No error? Yay, return.                                                // 230
        return;                                                                  // 231
      } catch (err) {                                                            // 232
        // Other errors should be thrown. Match errors just mean try another     // 233
        // choice.                                                               // 234
        if (!(err instanceof Match.Error))                                       // 235
          throw err;                                                             // 236
      }                                                                          // 237
    }                                                                            // 238
    // XXX this error is terrible                                                // 239
    throw new Match.Error("Failed Match.OneOf or Match.Optional validation");    // 240
  }                                                                              // 241
                                                                                 // 242
  // A function that isn't something we special-case is assumed to be a          // 243
  // constructor.                                                                // 244
  if (pattern instanceof Function) {                                             // 245
    if (value instanceof pattern)                                                // 246
      return;                                                                    // 247
    // XXX what if .name isn't defined                                           // 248
    throw new Match.Error("Expected " + pattern.name);                           // 249
  }                                                                              // 250
                                                                                 // 251
  var unknownKeysAllowed = false;                                                // 252
  var unknownKeyPattern;                                                         // 253
  if (pattern instanceof ObjectIncluding) {                                      // 254
    unknownKeysAllowed = true;                                                   // 255
    pattern = pattern.pattern;                                                   // 256
  }                                                                              // 257
  if (pattern instanceof ObjectWithValues) {                                     // 258
    unknownKeysAllowed = true;                                                   // 259
    unknownKeyPattern = [pattern.pattern];                                       // 260
    pattern = {};  // no required keys                                           // 261
  }                                                                              // 262
                                                                                 // 263
  if (typeof pattern !== "object")                                               // 264
    throw Error("Bad pattern: unknown pattern type");                            // 265
                                                                                 // 266
  // An object, with required and optional keys. Note that this does NOT do      // 267
  // structural matches against objects of special types that happen to match    // 268
  // the pattern: this really needs to be a plain old {Object}!                  // 269
  if (typeof value !== 'object')                                                 // 270
    throw new Match.Error("Expected object, got " + typeof value);               // 271
  if (value === null)                                                            // 272
    throw new Match.Error("Expected object, got null");                          // 273
  if (value.constructor !== Object)                                              // 274
    throw new Match.Error("Expected plain object");                              // 275
                                                                                 // 276
  var requiredPatterns = {};                                                     // 277
  var optionalPatterns = {};                                                     // 278
  _.each(pattern, function (subPattern, key) {                                   // 279
    if (subPattern instanceof Optional)                                          // 280
      optionalPatterns[key] = subPattern.pattern;                                // 281
    else                                                                         // 282
      requiredPatterns[key] = subPattern;                                        // 283
  });                                                                            // 284
                                                                                 // 285
  _.each(value, function (subValue, key) {                                       // 286
    try {                                                                        // 287
      if (_.has(requiredPatterns, key)) {                                        // 288
        checkSubtree(subValue, requiredPatterns[key]);                           // 289
        delete requiredPatterns[key];                                            // 290
      } else if (_.has(optionalPatterns, key)) {                                 // 291
        checkSubtree(subValue, optionalPatterns[key]);                           // 292
      } else {                                                                   // 293
        if (!unknownKeysAllowed)                                                 // 294
          throw new Match.Error("Unknown key");                                  // 295
        if (unknownKeyPattern) {                                                 // 296
          checkSubtree(subValue, unknownKeyPattern[0]);                          // 297
        }                                                                        // 298
      }                                                                          // 299
    } catch (err) {                                                              // 300
      if (err instanceof Match.Error)                                            // 301
        err.path = _prependPath(key, err.path);                                  // 302
      throw err;                                                                 // 303
    }                                                                            // 304
  });                                                                            // 305
                                                                                 // 306
  _.each(requiredPatterns, function (subPattern, key) {                          // 307
    throw new Match.Error("Missing key '" + key + "'");                          // 308
  });                                                                            // 309
};                                                                               // 310
                                                                                 // 311
var ArgumentChecker = function (args, description) {                             // 312
  var self = this;                                                               // 313
  // Make a SHALLOW copy of the arguments. (We'll be doing identity checks       // 314
  // against its contents.)                                                      // 315
  self.args = _.clone(args);                                                     // 316
  // Since the common case will be to check arguments in order, and we splice    // 317
  // out arguments when we check them, make it so we splice out from the end     // 318
  // rather than the beginning.                                                  // 319
  self.args.reverse();                                                           // 320
  self.description = description;                                                // 321
};                                                                               // 322
                                                                                 // 323
_.extend(ArgumentChecker.prototype, {                                            // 324
  checking: function (value) {                                                   // 325
    var self = this;                                                             // 326
    if (self._checkingOneValue(value))                                           // 327
      return;                                                                    // 328
    // Allow check(arguments, [String]) or check(arguments.slice(1), [String])   // 329
    // or check([foo, bar], [String]) to count... but only if value wasn't       // 330
    // itself an argument.                                                       // 331
    if (_.isArray(value) || _.isArguments(value)) {                              // 332
      _.each(value, _.bind(self._checkingOneValue, self));                       // 333
    }                                                                            // 334
  },                                                                             // 335
  _checkingOneValue: function (value) {                                          // 336
    var self = this;                                                             // 337
    for (var i = 0; i < self.args.length; ++i) {                                 // 338
      // Is this value one of the arguments? (This can have a false positive if  // 339
      // the argument is an interned primitive, but it's still a good enough     // 340
      // check.)                                                                 // 341
      if (value === self.args[i]) {                                              // 342
        self.args.splice(i, 1);                                                  // 343
        return true;                                                             // 344
      }                                                                          // 345
    }                                                                            // 346
    return false;                                                                // 347
  },                                                                             // 348
  throwUnlessAllArgumentsHaveBeenChecked: function () {                          // 349
    var self = this;                                                             // 350
    if (!_.isEmpty(self.args))                                                   // 351
      throw new Error("Did not check() all arguments during " +                  // 352
                      self.description);                                         // 353
  }                                                                              // 354
});                                                                              // 355
                                                                                 // 356
var _jsKeywords = ["do", "if", "in", "for", "let", "new", "try", "var", "case",  // 357
  "else", "enum", "eval", "false", "null", "this", "true", "void", "with",       // 358
  "break", "catch", "class", "const", "super", "throw", "while", "yield",        // 359
  "delete", "export", "import", "public", "return", "static", "switch",          // 360
  "typeof", "default", "extends", "finally", "package", "private", "continue",   // 361
  "debugger", "function", "arguments", "interface", "protected", "implements",   // 362
  "instanceof"];                                                                 // 363
                                                                                 // 364
// Assumes the base of path is already escaped properly                          // 365
// returns key + base                                                            // 366
var _prependPath = function (key, base) {                                        // 367
  if ((typeof key) === "number" || key.match(/^[0-9]+$/))                        // 368
    key = "[" + key + "]";                                                       // 369
  else if (!key.match(/^[a-z_$][0-9a-z_$]*$/i) || _.contains(_jsKeywords, key))  // 370
    key = JSON.stringify([key]);                                                 // 371
                                                                                 // 372
  if (base && base[0] !== "[")                                                   // 373
    return key + '.' + base;                                                     // 374
  return key + base;                                                             // 375
};                                                                               // 376
                                                                                 // 377
                                                                                 // 378
///////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package.check = {
  check: check,
  Match: Match
};

})();

//# sourceMappingURL=check.js.map
