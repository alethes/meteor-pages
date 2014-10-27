(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var _ = Package.underscore._;
var DDP = Package.ddp.DDP;
var DDPServer = Package.ddp.DDPServer;
var MongoInternals = Package.mongo.MongoInternals;
var Mongo = Package.mongo.Mongo;
var Ctl = Package['ctl-helper'].Ctl;
var AppConfig = Package['application-configuration'].AppConfig;
var Follower = Package['follower-livedata'].Follower;

/* Package-scope variables */
var main;

(function () {

///////////////////////////////////////////////////////////////////////////////////
//                                                                               //
// packages/ctl/ctl.js                                                           //
//                                                                               //
///////////////////////////////////////////////////////////////////////////////////
                                                                                 //
var Future = Npm.require("fibers/future");                                       // 1
                                                                                 // 2
Ctl.Commands.push({                                                              // 3
  name: "help",                                                                  // 4
  func: function (argv) {                                                        // 5
    if (!argv._.length || argv.help)                                             // 6
      Ctl.usage();                                                               // 7
    var cmd = argv._.splice(0,1)[0];                                             // 8
    argv.help = true;                                                            // 9
                                                                                 // 10
    Ctl.findCommand(cmd).func(argv);                                             // 11
  }                                                                              // 12
});                                                                              // 13
                                                                                 // 14
var startFun = function (argv) {                                                 // 15
  if (argv.help || argv._.length !== 0) {                                        // 16
    process.stderr.write(                                                        // 17
      "Usage: ctl start\n" +                                                     // 18
        "\n" +                                                                   // 19
        "Starts the app. For now, this just means that it runs the 'server'\n" + // 20
        "program.\n"                                                             // 21
    );                                                                           // 22
    process.exit(1);                                                             // 23
  }                                                                              // 24
  Ctl.subscribeToAppJobs(Ctl.myAppName());                                       // 25
  var jobs = Ctl.jobsCollection();                                               // 26
  var thisJob = jobs.findOne(Ctl.myJobId());                                     // 27
  Ctl.updateProxyActiveTags(['', thisJob.star]);                                 // 28
  if (Ctl.hasProgram("console")) {                                               // 29
    console.log("starting console for app", Ctl.myAppName());                    // 30
    Ctl.startServerlikeProgramIfNotPresent("console", ["admin"], true);          // 31
  }                                                                              // 32
  console.log("starting server for app", Ctl.myAppName());                       // 33
  Ctl.startServerlikeProgramIfNotPresent("server", ["runner"]);                  // 34
};                                                                               // 35
                                                                                 // 36
Ctl.Commands.push({                                                              // 37
  name: "start",                                                                 // 38
  help: "Start this app",                                                        // 39
  func: startFun                                                                 // 40
});                                                                              // 41
                                                                                 // 42
                                                                                 // 43
Ctl.Commands.push({                                                              // 44
  name: "endUpdate",                                                             // 45
  help: "Start this app to end an update",                                       // 46
  func: startFun                                                                 // 47
});                                                                              // 48
                                                                                 // 49
var stopFun =  function (argv) {                                                 // 50
  if (argv.help || argv._.length !== 0) {                                        // 51
    process.stderr.write(                                                        // 52
      "Usage: ctl stop\n" +                                                      // 53
        "\n" +                                                                   // 54
        "Stops the app. For now, this just means that it kills all jobs\n" +     // 55
        "other than itself.\n"                                                   // 56
    );                                                                           // 57
    process.exit(1);                                                             // 58
  }                                                                              // 59
                                                                                 // 60
  // Get all jobs (other than this job: don't commit suicide!) that are not      // 61
  // already killed.                                                             // 62
  var jobs = Ctl.getJobsByApp(                                                   // 63
    Ctl.myAppName(), {_id: {$ne: Ctl.myJobId()}, done: false});                  // 64
  jobs.forEach(function (job) {                                                  // 65
    // Don't commit suicide.                                                     // 66
    if (job._id === Ctl.myJobId())                                               // 67
      return;                                                                    // 68
    // It's dead, Jim.                                                           // 69
    if (job.done)                                                                // 70
      return;                                                                    // 71
    Ctl.kill(job.program, job._id);                                              // 72
  });                                                                            // 73
  console.log("Server stopped.");                                                // 74
};                                                                               // 75
                                                                                 // 76
Ctl.Commands.push({                                                              // 77
  name: "stop",                                                                  // 78
  help: "Stop this app",                                                         // 79
  func: stopFun                                                                  // 80
});                                                                              // 81
                                                                                 // 82
var waitForDone = function (jobCollection, jobId) {                              // 83
  var fut = new Future();                                                        // 84
  var found = false;                                                             // 85
  try {                                                                          // 86
    var observation = jobCollection.find(jobId).observe({                        // 87
      added: function (doc) {                                                    // 88
        found = true;                                                            // 89
        if (doc.done)                                                            // 90
          fut['return']();                                                       // 91
      },                                                                         // 92
      changed: function (doc) {                                                  // 93
        if (doc.done)                                                            // 94
          fut['return']();                                                       // 95
      },                                                                         // 96
      removed: function (doc) {                                                  // 97
        fut['return']();                                                         // 98
      }                                                                          // 99
    });                                                                          // 100
    // if the document doesn't exist at all, it's certainly done.                // 101
    if (!found)                                                                  // 102
      fut['return']();                                                           // 103
    fut.wait();                                                                  // 104
  } finally {                                                                    // 105
    observation.stop();                                                          // 106
  }                                                                              // 107
};                                                                               // 108
                                                                                 // 109
                                                                                 // 110
Ctl.Commands.push({                                                              // 111
  name: "beginUpdate",                                                           // 112
  help: "Stop this app to begin an update",                                      // 113
  func: function (argv) {                                                        // 114
    Ctl.subscribeToAppJobs(Ctl.myAppName());                                     // 115
    var jobs = Ctl.jobsCollection();                                             // 116
    var thisJob = jobs.findOne(Ctl.myJobId());                                   // 117
    // Look at all the server jobs that are on the old star.                     // 118
    var oldJobSelector = {                                                       // 119
      app: Ctl.myAppName(),                                                      // 120
      star: {$ne: thisJob.star},                                                 // 121
      program: "server",                                                         // 122
      done: false                                                                // 123
    };                                                                           // 124
    var oldServers = jobs.find(oldJobSelector).fetch();                          // 125
    // Start a new job for each of them.                                         // 126
    var newServersAlreadyPresent = jobs.find({                                   // 127
      app: Ctl.myAppName(),                                                      // 128
      star: thisJob.star,                                                        // 129
      program: "server",                                                         // 130
      done: false                                                                // 131
    }).count();                                                                  // 132
    // discount any new servers we've already started.                           // 133
    oldServers.splice(0, newServersAlreadyPresent);                              // 134
    console.log("starting " + oldServers.length + " new servers to match old");  // 135
    _.each(oldServers, function (oldServer) {                                    // 136
      Ctl.startServerlikeProgram("server",                                       // 137
                                 oldServer.tags,                                 // 138
                                 oldServer.env.ADMIN_APP);                       // 139
    });                                                                          // 140
    // Wait for them all to come up and bind to the proxy.                       // 141
    var updateProxyActiveTagsOptions = {                                         // 142
      requireRegisteredBindingCount: {}                                          // 143
    };                                                                           // 144
    // How many new servers should be up when we update the tags, given how many // 145
    // servers we're aiming at:                                                  // 146
    var target;                                                                  // 147
    switch (oldServers.length) {                                                 // 148
    case 0:                                                                      // 149
      target = 0;                                                                // 150
      break;                                                                     // 151
    case 1:                                                                      // 152
      target = 1;                                                                // 153
      break;                                                                     // 154
    case 2:                                                                      // 155
      target = 1;                                                                // 156
      break;                                                                     // 157
    default:                                                                     // 158
      var c = oldServers.length;                                                 // 159
      target =  Math.min(c - 1, Math.ceil(c*.8));                                // 160
      break;                                                                     // 161
    }                                                                            // 162
    updateProxyActiveTagsOptions.requireRegisteredBindingCount[thisJob.star] =   // 163
      target;                                                                    // 164
    Ctl.updateProxyActiveTags(['', thisJob.star], updateProxyActiveTagsOptions); // 165
                                                                                 // 166
    // (eventually) tell the proxy to switch over to using the new star          // 167
    // One by one, kill all the old star's server jobs.                          // 168
    var jobToKill = jobs.findOne(oldJobSelector);                                // 169
    while (jobToKill) {                                                          // 170
      Ctl.kill("server", jobToKill._id);                                         // 171
      // Wait for it to go down                                                  // 172
      waitForDone(jobs, jobToKill._id);                                          // 173
      // Spend some time in between to allow any reconnect storm to die down.    // 174
      Meteor._sleepForMs(5000);                                                  // 175
      jobToKill = jobs.findOne(oldJobSelector);                                  // 176
    }                                                                            // 177
    // Now kill all old non-server jobs.  They're less important.                // 178
    jobs.find({                                                                  // 179
      app: Ctl.myAppName(),                                                      // 180
      star: {$ne: thisJob.star},                                                 // 181
      program: {$ne: "server"},                                                  // 182
      done: false                                                                // 183
    }).forEach(function (job) {                                                  // 184
      Ctl.kill(job.program, job._id);                                            // 185
    });                                                                          // 186
    // fin                                                                       // 187
    process.exit(0);                                                             // 188
  }                                                                              // 189
});                                                                              // 190
                                                                                 // 191
main = function (argv) {                                                         // 192
  return Ctl.main(argv);                                                         // 193
};                                                                               // 194
                                                                                 // 195
///////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package.ctl = {
  main: main
};

})();

//# sourceMappingURL=ctl.js.map
