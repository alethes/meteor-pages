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
var _ = Package.underscore._;
var Tracker = Package.tracker.Tracker;
var Deps = Package.tracker.Deps;
var EJSON = Package.ejson.EJSON;

/* Package-scope variables */
var ReactiveDict;

(function () {

//////////////////////////////////////////////////////////////////////////////////////////
//                                                                                      //
// packages/reactive-dict/reactive-dict.js                                              //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////
                                                                                        //
// XXX come up with a serialization method which canonicalizes object key               // 1
// order, which would allow us to use objects as values for equals.                     // 2
var stringify = function (value) {                                                      // 3
  if (value === undefined)                                                              // 4
    return 'undefined';                                                                 // 5
  return EJSON.stringify(value);                                                        // 6
};                                                                                      // 7
var parse = function (serialized) {                                                     // 8
  if (serialized === undefined || serialized === 'undefined')                           // 9
    return undefined;                                                                   // 10
  return EJSON.parse(serialized);                                                       // 11
};                                                                                      // 12
                                                                                        // 13
// XXX COMPAT WITH 0.9.1 : accept migrationData instead of dictName                     // 14
ReactiveDict = function (dictName) {                                                    // 15
  // this.keys: key -> value                                                            // 16
  if (dictName) {                                                                       // 17
    if (typeof dictName === 'string') {                                                 // 18
      // the normal case, argument is a string name.                                    // 19
      // _registerDictForMigrate will throw an error on duplicate name.                 // 20
      ReactiveDict._registerDictForMigrate(dictName, this);                             // 21
      this.keys = ReactiveDict._loadMigratedDict(dictName) || {};                       // 22
    } else if (typeof dictName === 'object') {                                          // 23
      // back-compat case: dictName is actually migrationData                           // 24
      this.keys = dictName;                                                             // 25
    } else {                                                                            // 26
      throw new Error("Invalid ReactiveDict argument: " + dictName);                    // 27
    }                                                                                   // 28
  } else {                                                                              // 29
    // no name given; no migration will be performed                                    // 30
    this.keys = {};                                                                     // 31
  }                                                                                     // 32
                                                                                        // 33
  this.keyDeps = {}; // key -> Dependency                                               // 34
  this.keyValueDeps = {}; // key -> Dependency                                          // 35
};                                                                                      // 36
                                                                                        // 37
_.extend(ReactiveDict.prototype, {                                                      // 38
  set: function (key, value) {                                                          // 39
    var self = this;                                                                    // 40
                                                                                        // 41
    value = stringify(value);                                                           // 42
                                                                                        // 43
    var oldSerializedValue = 'undefined';                                               // 44
    if (_.has(self.keys, key)) oldSerializedValue = self.keys[key];                     // 45
    if (value === oldSerializedValue)                                                   // 46
      return;                                                                           // 47
    self.keys[key] = value;                                                             // 48
                                                                                        // 49
    var changed = function (v) {                                                        // 50
      v && v.changed();                                                                 // 51
    };                                                                                  // 52
                                                                                        // 53
    changed(self.keyDeps[key]);                                                         // 54
    if (self.keyValueDeps[key]) {                                                       // 55
      changed(self.keyValueDeps[key][oldSerializedValue]);                              // 56
      changed(self.keyValueDeps[key][value]);                                           // 57
    }                                                                                   // 58
  },                                                                                    // 59
                                                                                        // 60
  setDefault: function (key, value) {                                                   // 61
    var self = this;                                                                    // 62
    // for now, explicitly check for undefined, since there is no                       // 63
    // ReactiveDict.clear().  Later we might have a ReactiveDict.clear(), in which case // 64
    // we should check if it has the key.                                               // 65
    if (self.keys[key] === undefined) {                                                 // 66
      self.set(key, value);                                                             // 67
    }                                                                                   // 68
  },                                                                                    // 69
                                                                                        // 70
  get: function (key) {                                                                 // 71
    var self = this;                                                                    // 72
    self._ensureKey(key);                                                               // 73
    self.keyDeps[key].depend();                                                         // 74
    return parse(self.keys[key]);                                                       // 75
  },                                                                                    // 76
                                                                                        // 77
  equals: function (key, value) {                                                       // 78
    var self = this;                                                                    // 79
                                                                                        // 80
    // Mongo.ObjectID is in the 'mongo' package                                         // 81
    var ObjectID = null;                                                                // 82
    if (typeof Mongo !== 'undefined') {                                                 // 83
      ObjectID = Mongo.ObjectID;                                                        // 84
    }                                                                                   // 85
                                                                                        // 86
    // We don't allow objects (or arrays that might include objects) for                // 87
    // .equals, because JSON.stringify doesn't canonicalize object key                  // 88
    // order. (We can make equals have the right return value by parsing the            // 89
    // current value and using EJSON.equals, but we won't have a canonical              // 90
    // element of keyValueDeps[key] to store the dependency.) You can still use         // 91
    // "EJSON.equals(reactiveDict.get(key), value)".                                    // 92
    //                                                                                  // 93
    // XXX we could allow arrays as long as we recursively check that there             // 94
    // are no objects                                                                   // 95
    if (typeof value !== 'string' &&                                                    // 96
        typeof value !== 'number' &&                                                    // 97
        typeof value !== 'boolean' &&                                                   // 98
        typeof value !== 'undefined' &&                                                 // 99
        !(value instanceof Date) &&                                                     // 100
        !(ObjectID && value instanceof ObjectID) &&                                     // 101
        value !== null)                                                                 // 102
      throw new Error("ReactiveDict.equals: value must be scalar");                     // 103
    var serializedValue = stringify(value);                                             // 104
                                                                                        // 105
    if (Tracker.active) {                                                               // 106
      self._ensureKey(key);                                                             // 107
                                                                                        // 108
      if (! _.has(self.keyValueDeps[key], serializedValue))                             // 109
        self.keyValueDeps[key][serializedValue] = new Tracker.Dependency;               // 110
                                                                                        // 111
      var isNew = self.keyValueDeps[key][serializedValue].depend();                     // 112
      if (isNew) {                                                                      // 113
        Tracker.onInvalidate(function () {                                              // 114
          // clean up [key][serializedValue] if it's now empty, so we don't             // 115
          // use O(n) memory for n = values seen ever                                   // 116
          if (! self.keyValueDeps[key][serializedValue].hasDependents())                // 117
            delete self.keyValueDeps[key][serializedValue];                             // 118
        });                                                                             // 119
      }                                                                                 // 120
    }                                                                                   // 121
                                                                                        // 122
    var oldValue = undefined;                                                           // 123
    if (_.has(self.keys, key)) oldValue = parse(self.keys[key]);                        // 124
    return EJSON.equals(oldValue, value);                                               // 125
  },                                                                                    // 126
                                                                                        // 127
  _ensureKey: function (key) {                                                          // 128
    var self = this;                                                                    // 129
    if (!(key in self.keyDeps)) {                                                       // 130
      self.keyDeps[key] = new Tracker.Dependency;                                       // 131
      self.keyValueDeps[key] = {};                                                      // 132
    }                                                                                   // 133
  },                                                                                    // 134
                                                                                        // 135
  // Get a JSON value that can be passed to the constructor to                          // 136
  // create a new ReactiveDict with the same contents as this one                       // 137
  _getMigrationData: function () {                                                      // 138
    // XXX sanitize and make sure it's JSONible?                                        // 139
    return this.keys;                                                                   // 140
  }                                                                                     // 141
});                                                                                     // 142
                                                                                        // 143
//////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

//////////////////////////////////////////////////////////////////////////////////////////
//                                                                                      //
// packages/reactive-dict/migration.js                                                  //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////
                                                                                        //
ReactiveDict._migratedDictData = {}; // name -> data                                    // 1
ReactiveDict._dictsToMigrate = {}; // name -> ReactiveDict                              // 2
                                                                                        // 3
ReactiveDict._loadMigratedDict = function (dictName) {                                  // 4
  if (_.has(ReactiveDict._migratedDictData, dictName))                                  // 5
    return ReactiveDict._migratedDictData[dictName];                                    // 6
                                                                                        // 7
  return null;                                                                          // 8
};                                                                                      // 9
                                                                                        // 10
ReactiveDict._registerDictForMigrate = function (dictName, dict) {                      // 11
  if (_.has(ReactiveDict._dictsToMigrate, dictName))                                    // 12
    throw new Error("Duplicate ReactiveDict name: " + dictName);                        // 13
                                                                                        // 14
  ReactiveDict._dictsToMigrate[dictName] = dict;                                        // 15
};                                                                                      // 16
                                                                                        // 17
if (Meteor.isClient && Package.reload) {                                                // 18
  // Put old migrated data into ReactiveDict._migratedDictData,                         // 19
  // where it can be accessed by ReactiveDict._loadMigratedDict.                        // 20
  var migrationData = Package.reload.Reload._migrationData('reactive-dict');            // 21
  if (migrationData && migrationData.dicts)                                             // 22
    ReactiveDict._migratedDictData = migrationData.dicts;                               // 23
                                                                                        // 24
  // On migration, assemble the data from all the dicts that have been                  // 25
  // registered.                                                                        // 26
  Package.reload.Reload._onMigrate('reactive-dict', function () {                       // 27
    var dictsToMigrate = ReactiveDict._dictsToMigrate;                                  // 28
    var dataToMigrate = {};                                                             // 29
                                                                                        // 30
    for (var dictName in dictsToMigrate)                                                // 31
      dataToMigrate[dictName] = dictsToMigrate[dictName]._getMigrationData();           // 32
                                                                                        // 33
    return [true, {dicts: dataToMigrate}];                                              // 34
  });                                                                                   // 35
}                                                                                       // 36
                                                                                        // 37
//////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['reactive-dict'] = {
  ReactiveDict: ReactiveDict
};

})();
