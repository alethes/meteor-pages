(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var Log = Package.logging.Log;
var _ = Package.underscore._;
var DDP = Package.ddp.DDP;
var DDPServer = Package.ddp.DDPServer;
var MongoInternals = Package.mongo.MongoInternals;
var Mongo = Package.mongo.Mongo;
var Follower = Package['follower-livedata'].Follower;
var AppConfig = Package['application-configuration'].AppConfig;

/* Package-scope variables */
var Ctl;

(function () {

//////////////////////////////////////////////////////////////////////////////////////////
//                                                                                      //
// packages/ctl-helper/ctl-helper.js                                                    //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////
                                                                                        //
var optimist = Npm.require('optimist');                                                 // 1
var Future = Npm.require('fibers/future');                                              // 2
                                                                                        // 3
Ctl = {};                                                                               // 4
                                                                                        // 5
var connection;                                                                         // 6
var checkConnection;                                                                    // 7
                                                                                        // 8
_.extend(Ctl, {                                                                         // 9
  Commands: [],                                                                         // 10
                                                                                        // 11
  main: function (argv) {                                                               // 12
    var opt = optimist(argv)                                                            // 13
          .alias('h', 'help')                                                           // 14
          .boolean('help');                                                             // 15
    argv = opt.argv;                                                                    // 16
                                                                                        // 17
    if (argv.help) {                                                                    // 18
      argv._.splice(0, 0, "help");                                                      // 19
      delete argv.help;                                                                 // 20
    }                                                                                   // 21
                                                                                        // 22
    var cmdName = 'help';                                                               // 23
    if (argv._.length)                                                                  // 24
      cmdName = argv._.splice(0,1)[0];                                                  // 25
                                                                                        // 26
    Ctl.findCommand(cmdName).func(argv);                                                // 27
    Ctl.disconnect();                                                                   // 28
    return 0;                                                                           // 29
  },                                                                                    // 30
                                                                                        // 31
  startServerlikeProgramIfNotPresent: function (program, tags, admin) {                 // 32
    var numServers = Ctl.getJobsByApp(                                                  // 33
      Ctl.myAppName(), {program: program, done: false}).count();                        // 34
    if (numServers === 0) {                                                             // 35
      return Ctl.startServerlikeProgram(program, tags, admin);                          // 36
    } else {                                                                            // 37
      console.log(program, "already running.");                                         // 38
    }                                                                                   // 39
    return null;                                                                        // 40
  },                                                                                    // 41
                                                                                        // 42
  startServerlikeProgram: function (program, tags, admin) {                             // 43
    var appConfig = Ctl.prettyCall(                                                     // 44
      Ctl.findGalaxy(), 'getAppConfiguration', [Ctl.myAppName()]);                      // 45
    if (typeof admin == 'undefined')                                                    // 46
      admin = appConfig.admin;                                                          // 47
    admin = !!admin;                                                                    // 48
                                                                                        // 49
    var jobId = null;                                                                   // 50
    var rootUrl = Ctl.rootUrl;                                                          // 51
    if (! rootUrl) {                                                                    // 52
      var bindPathPrefix = "";                                                          // 53
      if (admin) {                                                                      // 54
        bindPathPrefix = "/" + encodeURIComponent(Ctl.myAppName()).replace(/\./g, '_'); // 55
      }                                                                                 // 56
      rootUrl = "https://" + appConfig.sitename + bindPathPrefix;                       // 57
    }                                                                                   // 58
                                                                                        // 59
    // Allow appConfig settings to be objects or strings. We need to stringify          // 60
    // them to pass them to the app in the env var.                                     // 61
    // Backwards compat with old app config format.                                     // 62
    _.each(["settings", "METEOR_SETTINGS"], function (settingsKey) {                    // 63
      if (appConfig[settingsKey] && typeof appConfig[settingsKey] === "object")         // 64
        appConfig[settingsKey] = JSON.stringify(appConfig[settingsKey]);                // 65
    });                                                                                 // 66
                                                                                        // 67
    // XXX args? env?                                                                   // 68
    var env = {                                                                         // 69
      ROOT_URL: rootUrl,                                                                // 70
      METEOR_SETTINGS: appConfig.settings || appConfig.METEOR_SETTINGS                  // 71
    };                                                                                  // 72
    if (admin)                                                                          // 73
      env.ADMIN_APP = 'true';                                                           // 74
    jobId = Ctl.prettyCall(Ctl.findGalaxy(), 'run', [Ctl.myAppName(), program, {        // 75
      exitPolicy: 'restart',                                                            // 76
      env: env,                                                                         // 77
      ports: {                                                                          // 78
        "main": {                                                                       // 79
          bindEnv: "PORT",                                                              // 80
          routeEnv: "ROUTE"//,                                                          // 81
          //bindIpEnv: "BIND_IP" // Later, we can teach Satellite to do                 // 82
          //something like recommend the process bind to a particular IP here.          // 83
          //For now, we don't have a way of setting this, so Satellite binds            // 84
          //to 0.0.0.0                                                                  // 85
        }                                                                               // 86
      },                                                                                // 87
      tags: tags                                                                        // 88
    }]);                                                                                // 89
    console.log("Started", program);                                                    // 90
    return jobId;                                                                       // 91
  },                                                                                    // 92
                                                                                        // 93
  findCommand: function (name) {                                                        // 94
    var cmd = _.where(Ctl.Commands, { name: name })[0];                                 // 95
    if (! cmd) {                                                                        // 96
      console.log("'" + name + "' is not a ctl command. See 'ctl --help'.");            // 97
      process.exit(1);                                                                  // 98
    }                                                                                   // 99
                                                                                        // 100
    return cmd;                                                                         // 101
  },                                                                                    // 102
                                                                                        // 103
  hasProgram: function (name) {                                                         // 104
    Ctl.subscribeToAppJobs(Ctl.myAppName());                                            // 105
    var myJob = Ctl.jobsCollection().findOne(Ctl.myJobId());                            // 106
    var manifest = Ctl.prettyCall(Ctl.findGalaxy(), 'getStarManifest', [myJob.star]);   // 107
    if (!manifest)                                                                      // 108
      return false;                                                                     // 109
    var found = false;                                                                  // 110
    return _.find(manifest.programs, function (prog) { return prog.name === name; });   // 111
  },                                                                                    // 112
                                                                                        // 113
  findGalaxy: _.once(function () {                                                      // 114
    if (!('GALAXY' in process.env)) {                                                   // 115
      console.log(                                                                      // 116
        "GALAXY environment variable must be set. See 'galaxy --help'.");               // 117
      process.exit(1);                                                                  // 118
    }                                                                                   // 119
                                                                                        // 120
    connection = Follower.connect(process.env['ULTRAWORLD_DDP_ENDPOINT']);              // 121
    checkConnection = Meteor.setInterval(function () {                                  // 122
      if (Ctl.findGalaxy().status().status !== "connected" &&                           // 123
          Ctl.findGalaxy().status().retryCount > 2) {                                   // 124
        console.log("Cannot connect to galaxy; exiting");                               // 125
        process.exit(3);                                                                // 126
      }                                                                                 // 127
    }, 2*1000);                                                                         // 128
    return connection;                                                                  // 129
  }),                                                                                   // 130
                                                                                        // 131
  disconnect: function () {                                                             // 132
    if (connection) {                                                                   // 133
      connection.disconnect();                                                          // 134
    }                                                                                   // 135
    if (checkConnection) {                                                              // 136
      Meteor.clearInterval(checkConnection);                                            // 137
      checkConnection = null;                                                           // 138
    }                                                                                   // 139
  },                                                                                    // 140
                                                                                        // 141
  updateProxyActiveTags: function (tags, options) {                                     // 142
    var proxy;                                                                          // 143
    var proxyTagSwitchFuture = new Future;                                              // 144
    options = options || {};                                                            // 145
    AppConfig.configureService('proxy', 'pre0', function (proxyService) {               // 146
      if (proxyService && ! _.isEmpty(proxyService)) {                                  // 147
        try {                                                                           // 148
          proxy = Follower.connect(proxyService, {                                      // 149
            group: "proxy"                                                              // 150
          });                                                                           // 151
          var tries = 0;                                                                // 152
          while (tries < 100) {                                                         // 153
            try {                                                                       // 154
              proxy.call('updateTags', Ctl.myAppName(), tags, options);                 // 155
              break;                                                                    // 156
            } catch (e) {                                                               // 157
              if (e.error === 'not-enough-bindings') {                                  // 158
                tries++;                                                                // 159
                // try again in a sec.                                                  // 160
                Meteor._sleepForMs(1000);                                               // 161
              } else {                                                                  // 162
                throw e;                                                                // 163
              }                                                                         // 164
            }                                                                           // 165
          }                                                                             // 166
          proxy.disconnect();                                                           // 167
          if (!proxyTagSwitchFuture.isResolved())                                       // 168
            proxyTagSwitchFuture['return']();                                           // 169
        } catch (e) {                                                                   // 170
          if (!proxyTagSwitchFuture.isResolved())                                       // 171
            proxyTagSwitchFuture['throw'](e);                                           // 172
        }                                                                               // 173
      }                                                                                 // 174
    });                                                                                 // 175
                                                                                        // 176
    var proxyTimeout = Meteor.setTimeout(function () {                                  // 177
      if (!proxyTagSwitchFuture.isResolved())                                           // 178
        proxyTagSwitchFuture['throw'](                                                  // 179
          new Error("Timed out looking for a proxy " +                                  // 180
                    "or trying to change tags on it. Status: " +                        // 181
                    (proxy ? proxy.status().status : "no connection"))                  // 182
        );                                                                              // 183
    }, 50*1000);                                                                        // 184
    proxyTagSwitchFuture.wait();                                                        // 185
    Meteor.clearTimeout(proxyTimeout);                                                  // 186
  },                                                                                    // 187
                                                                                        // 188
  jobsCollection: _.once(function () {                                                  // 189
    return new Mongo.Collection("jobs", {manager: Ctl.findGalaxy()});                   // 190
  }),                                                                                   // 191
                                                                                        // 192
  // use _.memoize so that this is called only once per app.                            // 193
  subscribeToAppJobs: _.memoize(function (appName) {                                    // 194
    Ctl.findGalaxy()._subscribeAndWait("jobsByApp", [appName]);                         // 195
  }),                                                                                   // 196
                                                                                        // 197
  // XXX this never unsubs...                                                           // 198
  getJobsByApp: function (appName, restOfSelector) {                                    // 199
    var galaxy = Ctl.findGalaxy();                                                      // 200
    Ctl.subscribeToAppJobs(appName);                                                    // 201
    var selector = {app: appName};                                                      // 202
    if (restOfSelector)                                                                 // 203
      _.extend(selector, restOfSelector);                                               // 204
    return Ctl.jobsCollection().find(selector);                                         // 205
  },                                                                                    // 206
                                                                                        // 207
  myAppName: _.once(function () {                                                       // 208
    if (!('GALAXY_APP' in process.env)) {                                               // 209
      console.log("GALAXY_APP environment variable must be set.");                      // 210
      process.exit(1);                                                                  // 211
    }                                                                                   // 212
    return process.env.GALAXY_APP;                                                      // 213
  }),                                                                                   // 214
                                                                                        // 215
  myJobId: _.once(function () {                                                         // 216
    if (!('GALAXY_JOB' in process.env)) {                                               // 217
      console.log("GALAXY_JOB environment variable must be set.");                      // 218
      process.exit(1);                                                                  // 219
    }                                                                                   // 220
    return process.env.GALAXY_JOB;                                                      // 221
  }),                                                                                   // 222
                                                                                        // 223
  usage: function() {                                                                   // 224
    process.stdout.write(                                                               // 225
      "Usage: ctl [--help] <command> [<args>]\n" +                                      // 226
        "\n" +                                                                          // 227
        "For now, the GALAXY environment variable must be set to the location of\n" +   // 228
        "your Galaxy management server (Ultraworld.) This string is in the same\n" +    // 229
        "format as the argument to DDP.connect().\n" +                                  // 230
        "\n" +                                                                          // 231
        "Commands:\n");                                                                 // 232
    _.each(Ctl.Commands, function (cmd) {                                               // 233
      if (cmd.help && ! cmd.hidden) {                                                   // 234
        var name = cmd.name + "                ".substr(cmd.name.length);               // 235
        process.stdout.write("   " + name + cmd.help + "\n");                           // 236
      }                                                                                 // 237
    });                                                                                 // 238
    process.stdout.write("\n");                                                         // 239
    process.stdout.write(                                                               // 240
      "See 'ctl help <command>' for details on a command.\n");                          // 241
    process.exit(1);                                                                    // 242
  },                                                                                    // 243
                                                                                        // 244
  // XXX copied to meteor/tools/deploy-galaxy.js                                        // 245
  exitWithError: function (error, messages) {                                           // 246
    messages = messages || {};                                                          // 247
                                                                                        // 248
    if (! (error instanceof Meteor.Error))                                              // 249
      throw error; // get a stack                                                       // 250
                                                                                        // 251
    var msg = messages[error.error];                                                    // 252
    if (msg)                                                                            // 253
      process.stderr.write(msg + "\n");                                                 // 254
    else if (error instanceof Meteor.Error)                                             // 255
      process.stderr.write("Denied: " + error.message + "\n");                          // 256
                                                                                        // 257
    process.exit(1);                                                                    // 258
  },                                                                                    // 259
                                                                                        // 260
  // XXX copied to meteor/tools/deploy-galaxy.js                                        // 261
  prettyCall: function (galaxy, name, args, messages) {                                 // 262
    try {                                                                               // 263
      var ret = galaxy.apply(name, args);                                               // 264
    } catch (e) {                                                                       // 265
      Ctl.exitWithError(e, messages);                                                   // 266
    }                                                                                   // 267
    return ret;                                                                         // 268
  },                                                                                    // 269
                                                                                        // 270
  kill: function (programName, jobId) {                                                 // 271
  console.log("Killing %s (%s)", programName, jobId);                                   // 272
  Ctl.prettyCall(Ctl.findGalaxy(), 'kill', [jobId]);                                    // 273
  }                                                                                     // 274
});                                                                                     // 275
                                                                                        // 276
//////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['ctl-helper'] = {
  Ctl: Ctl
};

})();

//# sourceMappingURL=ctl-helper.js.map
