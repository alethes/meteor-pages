(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var WebApp = Package.webapp.WebApp;
var main = Package.webapp.main;
var WebAppInternals = Package.webapp.WebAppInternals;
var DDP = Package.ddp.DDP;
var DDPServer = Package.ddp.DDPServer;
var MongoInternals = Package.mongo.MongoInternals;
var Mongo = Package.mongo.Mongo;
var _ = Package.underscore._;

/* Package-scope variables */
var Autoupdate, ClientVersions;

(function () {

///////////////////////////////////////////////////////////////////////////////////
//                                                                               //
// packages/autoupdate/autoupdate_server.js                                      //
//                                                                               //
///////////////////////////////////////////////////////////////////////////////////
                                                                                 //
// Publish the current client versions to the client.  When a client             // 1
// sees the subscription change and that there is a new version of the           // 2
// client available on the server, it can reload.                                // 3
//                                                                               // 4
// By default there are two current client versions. The refreshable client      // 5
// version is identified by a hash of the client resources seen by the browser   // 6
// that are refreshable, such as CSS, while the non refreshable client version   // 7
// is identified by a hash of the rest of the client assets                      // 8
// (the HTML, code, and static files in the `public` directory).                 // 9
//                                                                               // 10
// If the environment variable `AUTOUPDATE_VERSION` is set it will be            // 11
// used as the client id instead.  You can use this to control when              // 12
// the client reloads.  For example, if you want to only force a                 // 13
// reload on major changes, you can use a custom AUTOUPDATE_VERSION              // 14
// which you only change when something worth pushing to clients                 // 15
// immediately happens.                                                          // 16
//                                                                               // 17
// The server publishes a `meteor_autoupdate_clientVersions`                     // 18
// collection. There are two documents in this collection, a document            // 19
// with _id 'version' which represnets the non refreshable client assets,        // 20
// and a document with _id 'version-refreshable' which represents the            // 21
// refreshable client assets. Each document has a 'version' field                // 22
// which is equivalent to the hash of the relevant assets. The refreshable       // 23
// document also contains a list of the refreshable assets, so that the client   // 24
// can swap in the new assets without forcing a page refresh. Clients can        // 25
// observe changes on these documents to detect when there is a new              // 26
// version available.                                                            // 27
//                                                                               // 28
// In this implementation only two documents are present in the collection       // 29
// the current refreshable client version and the current nonRefreshable client  // 30
// version.  Developers can easily experiment with different versioning and      // 31
// updating models by forking this package.                                      // 32
                                                                                 // 33
var Future = Npm.require("fibers/future");                                       // 34
                                                                                 // 35
Autoupdate = {};                                                                 // 36
                                                                                 // 37
// The collection of acceptable client versions.                                 // 38
ClientVersions = new Mongo.Collection("meteor_autoupdate_clientVersions",        // 39
  { connection: null });                                                         // 40
                                                                                 // 41
// The client hash includes __meteor_runtime_config__, so wait until             // 42
// all packages have loaded and have had a chance to populate the                // 43
// runtime config before using the client hash as our default auto               // 44
// update version id.                                                            // 45
                                                                                 // 46
// Note: Tests allow people to override Autoupdate.autoupdateVersion before      // 47
// startup.                                                                      // 48
Autoupdate.autoupdateVersion = null;                                             // 49
Autoupdate.autoupdateVersionRefreshable = null;                                  // 50
Autoupdate.autoupdateVersionCordova = null;                                      // 51
Autoupdate.appId = __meteor_runtime_config__.appId = process.env.APP_ID;         // 52
                                                                                 // 53
var syncQueue = new Meteor._SynchronousQueue();                                  // 54
                                                                                 // 55
// updateVersions can only be called after the server has fully loaded.          // 56
var updateVersions = function (shouldReloadClientProgram) {                      // 57
  // Step 1: load the current client program on the server and update the        // 58
  // hash values in __meteor_runtime_config__.                                   // 59
  if (shouldReloadClientProgram) {                                               // 60
    WebAppInternals.reloadClientPrograms();                                      // 61
  }                                                                              // 62
                                                                                 // 63
  // If we just re-read the client program, or if we don't have an autoupdate    // 64
  // version, calculate it.                                                      // 65
  if (shouldReloadClientProgram || Autoupdate.autoupdateVersion === null) {      // 66
    Autoupdate.autoupdateVersion =                                               // 67
      process.env.AUTOUPDATE_VERSION ||                                          // 68
      WebApp.calculateClientHashNonRefreshable();                                // 69
  }                                                                              // 70
  // If we just recalculated it OR if it was set by (eg) test-in-browser,        // 71
  // ensure it ends up in __meteor_runtime_config__.                             // 72
  __meteor_runtime_config__.autoupdateVersion =                                  // 73
    Autoupdate.autoupdateVersion;                                                // 74
                                                                                 // 75
  Autoupdate.autoupdateVersionRefreshable =                                      // 76
    __meteor_runtime_config__.autoupdateVersionRefreshable =                     // 77
      process.env.AUTOUPDATE_VERSION ||                                          // 78
      WebApp.calculateClientHashRefreshable();                                   // 79
                                                                                 // 80
  Autoupdate.autoupdateVersionCordova =                                          // 81
    __meteor_runtime_config__.autoupdateVersionCordova =                         // 82
      process.env.AUTOUPDATE_VERSION ||                                          // 83
      WebApp.calculateClientHashCordova();                                       // 84
                                                                                 // 85
  // Step 2: form the new client boilerplate which contains the updated          // 86
  // assets and __meteor_runtime_config__.                                       // 87
  if (shouldReloadClientProgram) {                                               // 88
    WebAppInternals.generateBoilerplate();                                       // 89
  }                                                                              // 90
                                                                                 // 91
  // XXX COMPAT WITH 0.8.3                                                       // 92
  if (! ClientVersions.findOne({current: true})) {                               // 93
    // To ensure apps with version of Meteor prior to 0.9.0 (in                  // 94
    // which the structure of documents in `ClientVersions` was                  // 95
    // different) also reload.                                                   // 96
    ClientVersions.insert({current: true});                                      // 97
  }                                                                              // 98
                                                                                 // 99
  if (! ClientVersions.findOne({_id: "version"})) {                              // 100
    ClientVersions.insert({                                                      // 101
      _id: "version",                                                            // 102
      version: Autoupdate.autoupdateVersion                                      // 103
    });                                                                          // 104
  } else {                                                                       // 105
    ClientVersions.update("version", { $set: {                                   // 106
      version: Autoupdate.autoupdateVersion                                      // 107
    }});                                                                         // 108
  }                                                                              // 109
                                                                                 // 110
  if (! ClientVersions.findOne({_id: "version-refreshable"})) {                  // 111
    ClientVersions.insert({                                                      // 112
      _id: "version-refreshable",                                                // 113
      version: Autoupdate.autoupdateVersionRefreshable,                          // 114
      assets: WebAppInternals.refreshableAssets                                  // 115
    });                                                                          // 116
  } else {                                                                       // 117
    ClientVersions.update("version-refreshable", { $set: {                       // 118
      version: Autoupdate.autoupdateVersionRefreshable,                          // 119
      assets: WebAppInternals.refreshableAssets                                  // 120
      }});                                                                       // 121
  }                                                                              // 122
                                                                                 // 123
  if (! ClientVersions.findOne({_id: "version-cordova"})) {                      // 124
    ClientVersions.insert({                                                      // 125
      _id: "version-cordova",                                                    // 126
      version: Autoupdate.autoupdateVersionCordova,                              // 127
      refreshable: false                                                         // 128
    });                                                                          // 129
  } else {                                                                       // 130
    ClientVersions.update("version-cordova", { $set: {                           // 131
      version: Autoupdate.autoupdateVersionCordova                               // 132
    }});                                                                         // 133
  }                                                                              // 134
};                                                                               // 135
                                                                                 // 136
Meteor.publish(                                                                  // 137
  "meteor_autoupdate_clientVersions",                                            // 138
  function (appId) {                                                             // 139
    // `null` happens when a client doesn't have an appId and passes             // 140
    // `undefined` to `Meteor.subscribe`. `undefined` is translated to           // 141
    // `null` as JSON doesn't have `undefined.                                   // 142
    check(appId, Match.OneOf(String, undefined, null));                          // 143
                                                                                 // 144
    // Don't notify clients using wrong appId such as mobile apps built with a   // 145
    // different server but pointing at the same local url                       // 146
    if (Autoupdate.appId && appId && Autoupdate.appId !== appId)                 // 147
      return [];                                                                 // 148
                                                                                 // 149
    return ClientVersions.find();                                                // 150
  },                                                                             // 151
  {is_auto: true}                                                                // 152
);                                                                               // 153
                                                                                 // 154
Meteor.startup(function () {                                                     // 155
  updateVersions(false);                                                         // 156
});                                                                              // 157
                                                                                 // 158
var fut = new Future();                                                          // 159
                                                                                 // 160
// We only want SIGUSR2 to trigger 'updateVersions' AFTER onListen,              // 161
// so we add a queued task that waits for onListen before SIGUSR2 can queue      // 162
// tasks. Note that the `onListening` callbacks do not fire until after          // 163
// Meteor.startup, so there is no concern that the 'updateVersions' calls        // 164
// from SIGUSR2 will overlap with the `updateVersions` call from Meteor.startup. // 165
                                                                                 // 166
syncQueue.queueTask(function () {                                                // 167
  fut.wait();                                                                    // 168
});                                                                              // 169
                                                                                 // 170
WebApp.onListening(function () {                                                 // 171
  fut.return();                                                                  // 172
});                                                                              // 173
                                                                                 // 174
// Listen for SIGUSR2, which signals that a client asset has changed.            // 175
process.on('SIGUSR2', Meteor.bindEnvironment(function () {                       // 176
  syncQueue.queueTask(function () {                                              // 177
    updateVersions(true);                                                        // 178
  });                                                                            // 179
}));                                                                             // 180
                                                                                 // 181
///////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package.autoupdate = {
  Autoupdate: Autoupdate
};

})();

//# sourceMappingURL=autoupdate.js.map
