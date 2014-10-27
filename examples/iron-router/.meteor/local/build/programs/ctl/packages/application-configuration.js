(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var Log = Package.logging.Log;
var _ = Package.underscore._;
var DDP = Package.ddp.DDP;
var DDPServer = Package.ddp.DDPServer;
var EJSON = Package.ejson.EJSON;
var Follower = Package['follower-livedata'].Follower;

/* Package-scope variables */
var AppConfig;

(function () {

////////////////////////////////////////////////////////////////////////////////////////
//                                                                                    //
// packages/application-configuration/config.js                                       //
//                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////
                                                                                      //
var Future = Npm.require("fibers/future");                                            // 1
                                                                                      // 2
AppConfig = {};                                                                       // 3
                                                                                      // 4
                                                                                      // 5
AppConfig.findGalaxy = _.once(function () {                                           // 6
  if (!('GALAXY' in process.env || 'ULTRAWORLD_DDP_ENDPOINT' in process.env)) {       // 7
    return null;                                                                      // 8
  }                                                                                   // 9
  return Follower.connect(process.env.ULTRAWORLD_DDP_ENDPOINT || process.env.GALAXY); // 10
});                                                                                   // 11
                                                                                      // 12
var ultra = AppConfig.findGalaxy();                                                   // 13
                                                                                      // 14
var subFuture = new Future();                                                         // 15
var subFutureJobs = new Future();                                                     // 16
if (ultra) {                                                                          // 17
  ultra.subscribe("oneApp", process.env.GALAXY_APP, subFuture.resolver());            // 18
  ultra.subscribe("oneJob", process.env.GALAXY_JOB, subFutureJobs.resolver());        // 19
}                                                                                     // 20
                                                                                      // 21
var Apps;                                                                             // 22
var Jobs;                                                                             // 23
var Services;                                                                         // 24
var collectionFuture = new Future();                                                  // 25
                                                                                      // 26
Meteor.startup(function () {                                                          // 27
  var Mongo = Package.mongo.Mongo;                                                    // 28
  if (ultra) {                                                                        // 29
    Apps = new Mongo.Collection("apps", {                                             // 30
      connection: ultra                                                               // 31
    });                                                                               // 32
    Jobs = new Mongo.Collection("jobs", {                                             // 33
      connection: ultra                                                               // 34
    });                                                                               // 35
    Services = new Mongo.Collection('services', {                                     // 36
      connection: ultra                                                               // 37
    });                                                                               // 38
    // allow us to block on the collections being ready                               // 39
    collectionFuture.return();                                                        // 40
  }                                                                                   // 41
});                                                                                   // 42
                                                                                      // 43
// XXX: Remove this once we allow the same collection to be new'd from multiple       // 44
// places.                                                                            // 45
AppConfig._getAppCollection = function () {                                           // 46
  collectionFuture.wait();                                                            // 47
  return Apps;                                                                        // 48
};                                                                                    // 49
                                                                                      // 50
AppConfig._getJobsCollection = function () {                                          // 51
  collectionFuture.wait();                                                            // 52
  return Jobs;                                                                        // 53
};                                                                                    // 54
                                                                                      // 55
                                                                                      // 56
var staticAppConfig;                                                                  // 57
                                                                                      // 58
try {                                                                                 // 59
  if (process.env.APP_CONFIG) {                                                       // 60
    staticAppConfig = JSON.parse(process.env.APP_CONFIG);                             // 61
  } else {                                                                            // 62
    var settings;                                                                     // 63
    try {                                                                             // 64
      if (process.env.METEOR_SETTINGS) {                                              // 65
        settings = JSON.parse(process.env.METEOR_SETTINGS);                           // 66
      }                                                                               // 67
    } catch (e) {                                                                     // 68
      Log.warn("Could not parse METEOR_SETTINGS as JSON");                            // 69
    }                                                                                 // 70
    staticAppConfig = {                                                               // 71
      settings: settings,                                                             // 72
      packages: {                                                                     // 73
        'mongo-livedata': {                                                           // 74
          url: process.env.MONGO_URL,                                                 // 75
          oplog: process.env.MONGO_OPLOG_URL                                          // 76
        }                                                                             // 77
      }                                                                               // 78
    };                                                                                // 79
  }                                                                                   // 80
} catch (e) {                                                                         // 81
  Log.warn("Could not parse initial APP_CONFIG environment variable");                // 82
};                                                                                    // 83
                                                                                      // 84
AppConfig.getAppConfig = function () {                                                // 85
  if (!subFuture.isResolved() && staticAppConfig) {                                   // 86
    return staticAppConfig;                                                           // 87
  }                                                                                   // 88
  subFuture.wait();                                                                   // 89
  var myApp = Apps.findOne(process.env.GALAXY_APP);                                   // 90
  if (!myApp) {                                                                       // 91
    throw new Error("there is no app config for this app");                           // 92
  }                                                                                   // 93
  var config = myApp.config;                                                          // 94
  return config;                                                                      // 95
};                                                                                    // 96
                                                                                      // 97
AppConfig.getStarForThisJob = function () {                                           // 98
  if (ultra) {                                                                        // 99
    subFutureJobs.wait();                                                             // 100
    var job = Jobs.findOne(process.env.GALAXY_JOB);                                   // 101
    if (job) {                                                                        // 102
      return job.star;                                                                // 103
    }                                                                                 // 104
  }                                                                                   // 105
  return null;                                                                        // 106
};                                                                                    // 107
                                                                                      // 108
AppConfig.configurePackage = function (packageName, configure) {                      // 109
  var appConfig = AppConfig.getAppConfig(); // Will either be based in the env var,   // 110
                                         // or wait for galaxy to connect.            // 111
  var lastConfig =                                                                    // 112
        (appConfig && appConfig.packages &&                                           // 113
         appConfig.packages[packageName]) || {};                                      // 114
                                                                                      // 115
  // Always call the configure callback "soon" even if the initial configuration      // 116
  // is empty (synchronously, though deferred would be OK).                           // 117
  // XXX make sure that all callers of configurePackage deal well with multiple       // 118
  // callback invocations!  eg, email does not                                        // 119
  configure(lastConfig);                                                              // 120
  var configureIfDifferent = function (app) {                                         // 121
    if (!EJSON.equals(                                                                // 122
           app.config && app.config.packages && app.config.packages[packageName],     // 123
           lastConfig)) {                                                             // 124
      lastConfig = app.config.packages[packageName];                                  // 125
      configure(lastConfig);                                                          // 126
    }                                                                                 // 127
  };                                                                                  // 128
  var subHandle;                                                                      // 129
  var observed = new Future();                                                        // 130
                                                                                      // 131
  // This is not required to finish, so defer it so it doesn't block anything         // 132
  // else.                                                                            // 133
  Meteor.defer( function () {                                                         // 134
    // there's a Meteor.startup() that produces the various collections, make         // 135
    // sure it runs first before we continue.                                         // 136
    collectionFuture.wait();                                                          // 137
    subHandle = Apps.find(process.env.GALAXY_APP).observe({                           // 138
      added: configureIfDifferent,                                                    // 139
      changed: configureIfDifferent                                                   // 140
    });                                                                               // 141
    observed.return();                                                                // 142
  });                                                                                 // 143
                                                                                      // 144
  return {                                                                            // 145
    stop: function () {                                                               // 146
      observed.wait();                                                                // 147
      subHandle.stop();                                                               // 148
    }                                                                                 // 149
  };                                                                                  // 150
};                                                                                    // 151
                                                                                      // 152
AppConfig.configureService = function (serviceName, version, configure) {             // 153
                                                                                      // 154
  // Collect all the endpoints for this service, from both old- and new-format        // 155
  // documents, and call the `configure` callback with all the service endpoints      // 156
  // that we know about.                                                              // 157
  var callConfigure = function (doc) {                                                // 158
    var serviceDocs = Services.find({                                                 // 159
      name: serviceName,                                                              // 160
      version: version                                                                // 161
    });                                                                               // 162
    var endpoints = [];                                                               // 163
    serviceDocs.forEach(function (serviceDoc) {                                       // 164
      if (serviceDoc.providers) {                                                     // 165
        _.each(serviceDoc.providers, function (endpoint, app) {                       // 166
          endpoints.push(endpoint);                                                   // 167
        });                                                                           // 168
      } else {                                                                        // 169
        endpoints.push(serviceDoc.endpoint);                                          // 170
      }                                                                               // 171
    });                                                                               // 172
    configure(endpoints);                                                             // 173
  };                                                                                  // 174
                                                                                      // 175
  if (ultra) {                                                                        // 176
    // there's a Meteor.startup() that produces the various collections, make         // 177
    // sure it runs first before we continue.                                         // 178
    collectionFuture.wait();                                                          // 179
    // First try to subscribe to the new format service registrations; if that        // 180
    // sub doesn't exist, then ultraworld hasn't updated to the new format yet,       // 181
    // so try the old format `servicesByName` sub instead.                            // 182
    ultra.subscribe('services', serviceName, version, {                               // 183
      onError: function (err) {                                                       // 184
        if (err.error === 404) {                                                      // 185
          ultra.subscribe('servicesByName', serviceName);                             // 186
        }                                                                             // 187
      }                                                                               // 188
    });                                                                               // 189
    return Services.find({                                                            // 190
      name: serviceName,                                                              // 191
      version: version                                                                // 192
    }).observe({                                                                      // 193
      added: callConfigure,                                                           // 194
      changed: callConfigure,                                                         // 195
      removed: callConfigure                                                          // 196
    });                                                                               // 197
  }                                                                                   // 198
                                                                                      // 199
};                                                                                    // 200
                                                                                      // 201
////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['application-configuration'] = {
  AppConfig: AppConfig
};

})();

//# sourceMappingURL=application-configuration.js.map
