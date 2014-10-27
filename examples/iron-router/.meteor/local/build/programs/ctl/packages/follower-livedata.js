(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var Log = Package.logging.Log;
var _ = Package.underscore._;
var DDP = Package.ddp.DDP;
var DDPServer = Package.ddp.DDPServer;
var EJSON = Package.ejson.EJSON;

/* Package-scope variables */
var Follower;

(function () {

//////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                              //
// packages/follower-livedata/follower.js                                                       //
//                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                //
var fs = Npm.require('fs');                                                                     // 1
var Future = Npm.require('fibers/future');                                                      // 2
                                                                                                // 3
                                                                                                // 4
var MONITOR_INTERVAL = 5*1000; // every 5 seconds                                               // 5
                                                                                                // 6
/**                                                                                             // 7
 * Follower.connect() replaces DDP.connect() for connecting to DDP services that                // 8
 * implement a leadership set.  The follower connection tries to keep connected                 // 9
 * to the leader, and fails over as the leader changes.                                         // 10
 *                                                                                              // 11
 * Options: {                                                                                   // 12
 * group: The name of the leadership group to connect to.  Default "package.leadershipLivedata" // 13
 * }                                                                                            // 14
 *                                                                                              // 15
 * A Follower connection implements the following interfaces over and above a                   // 16
 * normal DDP connection:                                                                       // 17
 *                                                                                              // 18
 * onLost(callback): calls callback when the library considers itself to have                   // 19
 * tried all its known options for the leadership group.                                        // 20
 *                                                                                              // 21
 * onFound(callback): Called when the follower was previously lost, but has now                 // 22
 * successfully connected to something in the right leadership group.                           // 23
 */                                                                                             // 24
Follower = {                                                                                    // 25
  connect: function (urlSet, options) {                                                         // 26
    var electorTries;                                                                           // 27
    options = _.extend({                                                                        // 28
      group: "package.leadershipLivedata"                                                       // 29
    }, options);                                                                                // 30
    // start each elector as untried/assumed connectable.                                       // 31
                                                                                                // 32
    var makeElectorTries = function (urlSet) {                                                  // 33
                                                                                                // 34
      electorTries = {};                                                                        // 35
      if (typeof urlSet === 'string') {                                                         // 36
        urlSet = _.map(urlSet.split(','), function (url) {return url.trim();});                 // 37
      }                                                                                         // 38
      _.each(urlSet, function (url) {                                                           // 39
        electorTries[url] = 0;                                                                  // 40
      });                                                                                       // 41
    };                                                                                          // 42
                                                                                                // 43
    makeElectorTries(urlSet);                                                                   // 44
                                                                                                // 45
    var tryingUrl = null;                                                                       // 46
    var outstandingGetElectorate = false;                                                       // 47
    var conn = null;                                                                            // 48
    var prevReconnect = null;                                                                   // 49
    var prevDisconnect = null;                                                                  // 50
    var prevApply = null;                                                                       // 51
    var leader = null;                                                                          // 52
    var connectedTo = null;                                                                     // 53
    var intervalHandle = null;                                                                  // 54
                                                                                                // 55
                                                                                                // 56
    // Used to defer all method calls until we're sure that we connected to the                 // 57
    // right leadership group.                                                                  // 58
    var connectedToLeadershipGroup = new Future();                                              // 59
                                                                                                // 60
    var lost = false;                                                                           // 61
    var lostCallbacks = [];                                                                     // 62
    var foundCallbacks = [];                                                                    // 63
                                                                                                // 64
    var findFewestTries = function () {                                                         // 65
      var min = 10000;                                                                          // 66
      var minElector = null;                                                                    // 67
      _.each(electorTries, function (tries, elector) {                                          // 68
        if (tries < min) {                                                                      // 69
          min = tries;                                                                          // 70
          minElector = elector;                                                                 // 71
        }                                                                                       // 72
      });                                                                                       // 73
      if (min > 1 && !lost) {                                                                   // 74
        // we've tried everything once; we just became lost.                                    // 75
        lost = true;                                                                            // 76
        _.each(lostCallbacks, function (f) { f(); });                                           // 77
      }                                                                                         // 78
      return minElector;                                                                        // 79
    };                                                                                          // 80
                                                                                                // 81
    var updateElectorate = function (res) {                                                     // 82
      leader = res.leader;                                                                      // 83
      electorTries = {};                                                                        // 84
      _.each(res.electorate, function (elector) {                                               // 85
        electorTries[elector] = 0; // verified that this is in the current elector set.         // 86
      });                                                                                       // 87
    };                                                                                          // 88
                                                                                                // 89
    var tryElector = function (url) {                                                           // 90
      if (tryingUrl) {                                                                          // 91
        electorTries[tryingUrl]++;                                                              // 92
      }                                                                                         // 93
      url = url || findFewestTries();                                                           // 94
      //console.log("trying", url, electorTries, tryingUrl, process.env.GALAXY_JOB);            // 95
                                                                                                // 96
      // Don't keep trying the same url as fast as we can if it's not working.                  // 97
      if (electorTries[url] > 2) {                                                              // 98
        Meteor._sleepForMs(3 * 1000);                                                           // 99
      }                                                                                         // 100
                                                                                                // 101
      if (conn) {                                                                               // 102
        prevReconnect.apply(conn, [{                                                            // 103
          url: url                                                                              // 104
        }]);                                                                                    // 105
      } else {                                                                                  // 106
        conn = DDP.connect(url, options);                                                       // 107
        prevReconnect = conn.reconnect;                                                         // 108
        prevDisconnect = conn.disconnect;                                                       // 109
        prevApply = conn.apply;                                                                 // 110
      }                                                                                         // 111
      tryingUrl = url;                                                                          // 112
                                                                                                // 113
      if (!outstandingGetElectorate) {                                                          // 114
        outstandingGetElectorate = true;                                                        // 115
        conn.call('getElectorate', options.group, function (err, res) {                         // 116
          outstandingGetElectorate = false;                                                     // 117
          connectedTo = tryingUrl;                                                              // 118
          if (err) {                                                                            // 119
            tryElector();                                                                       // 120
            return;                                                                             // 121
          }                                                                                     // 122
          if (!_.contains(res.electorate, connectedTo)) {                                       // 123
            Log.warn("electorate " + res.electorate + " does not contain " + connectedTo);      // 124
          }                                                                                     // 125
          tryingUrl = null;                                                                     // 126
          if (! connectedToLeadershipGroup.isResolved()) {                                      // 127
            connectedToLeadershipGroup["return"]();                                             // 128
          }                                                                                     // 129
          // we got an answer!  Connected!                                                      // 130
          electorTries[url] = 0;                                                                // 131
                                                                                                // 132
          if (res.leader === connectedTo) {                                                     // 133
            // we're good.                                                                      // 134
            if (lost) {                                                                         // 135
              // we're found.                                                                   // 136
              lost = false;                                                                     // 137
              _.each(foundCallbacks, function (f) { f(); });                                    // 138
            }                                                                                   // 139
          } else {                                                                              // 140
            // let's connect to the leader anyway, if we think it                               // 141
            // is connectable.                                                                  // 142
            if (electorTries[res.leader] == 0) {                                                // 143
              tryElector(res.leader);                                                           // 144
            } else {                                                                            // 145
              // XXX: leader is probably down, we're probably going to elect                    // 146
              // soon.  Wait for the next round.                                                // 147
            }                                                                                   // 148
                                                                                                // 149
          }                                                                                     // 150
          updateElectorate(res);                                                                // 151
        });                                                                                     // 152
      }                                                                                         // 153
                                                                                                // 154
    };                                                                                          // 155
                                                                                                // 156
    tryElector();                                                                               // 157
                                                                                                // 158
    var checkConnection = function () {                                                         // 159
      if (conn.status().status !== 'connected' || connectedTo !== leader) {                     // 160
        tryElector();                                                                           // 161
      } else {                                                                                  // 162
        conn.call('getElectorate', options.group, function (err, res) {                         // 163
          if (err) {                                                                            // 164
            electorTries[connectedTo]++;                                                        // 165
            tryElector();                                                                       // 166
          } else if (res.leader !== leader) {                                                   // 167
            // update the electorate, and then definitely try to connect to the leader.         // 168
            updateElectorate(res);                                                              // 169
            tryElector(res.leader);                                                             // 170
          } else {                                                                              // 171
            if (! connectedToLeadershipGroup.isResolved()) {                                    // 172
              connectedToLeadershipGroup["return"]();                                           // 173
            }                                                                                   // 174
            //console.log("updating electorate with", res);                                     // 175
            updateElectorate(res);                                                              // 176
          }                                                                                     // 177
        });                                                                                     // 178
      }                                                                                         // 179
    };                                                                                          // 180
                                                                                                // 181
    var monitorConnection = function () {                                                       // 182
      return Meteor.setInterval(checkConnection, MONITOR_INTERVAL);                             // 183
    };                                                                                          // 184
                                                                                                // 185
    intervalHandle = monitorConnection();                                                       // 186
                                                                                                // 187
    conn.disconnect = function () {                                                             // 188
      if (intervalHandle)                                                                       // 189
        Meteor.clearInterval(intervalHandle);                                                   // 190
      intervalHandle = null;                                                                    // 191
      prevDisconnect.apply(conn);                                                               // 192
    };                                                                                          // 193
                                                                                                // 194
    conn.reconnect = function () {                                                              // 195
      if (!intervalHandle)                                                                      // 196
        intervalHandle = monitorConnection();                                                   // 197
      if (arguments[0] && arguments[0].url) {                                                   // 198
        makeElectorTries(arguments[0].url);                                                     // 199
        tryElector();                                                                           // 200
      } else {                                                                                  // 201
        prevReconnect.apply(conn, arguments);                                                   // 202
      }                                                                                         // 203
    };                                                                                          // 204
                                                                                                // 205
    conn.getUrl = function () {                                                                 // 206
      return _.keys(electorTries).join(',');                                                    // 207
    };                                                                                          // 208
                                                                                                // 209
    conn.tries = function () {                                                                  // 210
      return electorTries;                                                                      // 211
    };                                                                                          // 212
                                                                                                // 213
                                                                                                // 214
    // Assumes that `call` is implemented in terms of `apply`. All method calls                 // 215
    // should be deferred until we are sure we've connected to the right                        // 216
    // leadership group.                                                                        // 217
    conn.apply = function (/* arguments */) {                                                   // 218
      var args = _.toArray(arguments);                                                          // 219
      if (typeof args[args.length-1] === 'function') {                                          // 220
        // this needs to be independent of this fiber if there is a callback.                   // 221
        Meteor.defer(function () {                                                              // 222
          connectedToLeadershipGroup.wait();                                                    // 223
          return prevApply.apply(conn, args);                                                   // 224
        });                                                                                     // 225
        return null; // if there is a callback, the return value is not used                    // 226
      } else {                                                                                  // 227
        connectedToLeadershipGroup.wait();                                                      // 228
        return prevApply.apply(conn, args);                                                     // 229
      }                                                                                         // 230
    };                                                                                          // 231
                                                                                                // 232
    conn.onLost = function (callback) {                                                         // 233
      lostCallbacks.push(callback);                                                             // 234
    };                                                                                          // 235
                                                                                                // 236
    conn.onFound = function (callback) {                                                        // 237
      foundCallbacks.push(callback);                                                            // 238
    };                                                                                          // 239
                                                                                                // 240
    return conn;                                                                                // 241
  }                                                                                             // 242
                                                                                                // 243
};                                                                                              // 244
                                                                                                // 245
//////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['follower-livedata'] = {
  Follower: Follower
};

})();

//# sourceMappingURL=follower-livedata.js.map
