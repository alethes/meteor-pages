(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var Log = Package.logging.Log;
var _ = Package.underscore._;
var RoutePolicy = Package.routepolicy.RoutePolicy;
var Boilerplate = Package['boilerplate-generator'].Boilerplate;
var Spacebars = Package.spacebars.Spacebars;
var HTML = Package.htmljs.HTML;
var Blaze = Package.blaze.Blaze;
var UI = Package.blaze.UI;
var Handlebars = Package.blaze.Handlebars;
var WebAppHashing = Package['webapp-hashing'].WebAppHashing;

/* Package-scope variables */
var WebApp, main, WebAppInternals;

(function () {

///////////////////////////////////////////////////////////////////////////////////////////
//                                                                                       //
// packages/webapp/webapp_server.js                                                      //
//                                                                                       //
///////////////////////////////////////////////////////////////////////////////////////////
                                                                                         //
////////// Requires //////////                                                           // 1
                                                                                         // 2
var fs = Npm.require("fs");                                                              // 3
var http = Npm.require("http");                                                          // 4
var os = Npm.require("os");                                                              // 5
var path = Npm.require("path");                                                          // 6
var url = Npm.require("url");                                                            // 7
var crypto = Npm.require("crypto");                                                      // 8
                                                                                         // 9
var connect = Npm.require('connect');                                                    // 10
var useragent = Npm.require('useragent');                                                // 11
var send = Npm.require('send');                                                          // 12
                                                                                         // 13
var Future = Npm.require('fibers/future');                                               // 14
var Fiber = Npm.require('fibers');                                                       // 15
                                                                                         // 16
var SHORT_SOCKET_TIMEOUT = 5*1000;                                                       // 17
var LONG_SOCKET_TIMEOUT = 120*1000;                                                      // 18
                                                                                         // 19
WebApp = {};                                                                             // 20
WebAppInternals = {};                                                                    // 21
                                                                                         // 22
WebApp.defaultArch = 'web.browser';                                                      // 23
                                                                                         // 24
// XXX maps archs to manifests                                                           // 25
WebApp.clientPrograms = {};                                                              // 26
                                                                                         // 27
// XXX maps archs to program path on filesystem                                          // 28
var archPath = {};                                                                       // 29
                                                                                         // 30
var bundledJsCssPrefix;                                                                  // 31
                                                                                         // 32
// Keepalives so that when the outer server dies unceremoniously and                     // 33
// doesn't kill us, we quit ourselves. A little gross, but better than                   // 34
// pidfiles.                                                                             // 35
// XXX This should really be part of the boot script, not the webapp package.            // 36
//     Or we should just get rid of it, and rely on containerization.                    // 37
//                                                                                       // 38
// XXX COMPAT WITH 0.9.2.2                                                               // 39
// Keepalives have been replaced with a check that the parent pid is                     // 40
// still running. We keep the --keep-alive option for backwards                          // 41
// compatibility.                                                                        // 42
var initKeepalive = function () {                                                        // 43
  var keepaliveCount = 0;                                                                // 44
                                                                                         // 45
  process.stdin.on('data', function (data) {                                             // 46
    keepaliveCount = 0;                                                                  // 47
  });                                                                                    // 48
                                                                                         // 49
  process.stdin.resume();                                                                // 50
                                                                                         // 51
  setInterval(function () {                                                              // 52
    keepaliveCount ++;                                                                   // 53
    if (keepaliveCount >= 3) {                                                           // 54
      console.log("Failed to receive keepalive! Exiting.");                              // 55
      process.exit(1);                                                                   // 56
    }                                                                                    // 57
  }, 3000);                                                                              // 58
};                                                                                       // 59
                                                                                         // 60
// Check that we have a pid that looks like an integer (non-decimal                      // 61
// integer is okay).                                                                     // 62
var validPid = function (pid) {                                                          // 63
  return ! isNaN(+pid);                                                                  // 64
};                                                                                       // 65
                                                                                         // 66
// As a replacement to the old keepalives mechanism, check for a running                 // 67
// parent every few seconds. Exit if the parent is not running.                          // 68
//                                                                                       // 69
// Two caveats to this strategy:                                                         // 70
// * Doesn't catch the case where the parent is CPU-hogging (but maybe we                // 71
//   don't want to catch that case anyway, since the bundler not yielding                // 72
//   is what caused #2536).                                                              // 73
// * Could be fooled by pid re-use, i.e. if another process comes up and                 // 74
//   takes the parent process's place before the child process dies.                     // 75
var startCheckForLiveParent = function (parentPid) {                                     // 76
  if (parentPid) {                                                                       // 77
    if (! validPid(parentPid)) {                                                         // 78
      console.error("--parent-pid must be a valid process ID.");                         // 79
      process.exit(1);                                                                   // 80
    }                                                                                    // 81
                                                                                         // 82
    setInterval(function () {                                                            // 83
      try {                                                                              // 84
        process.kill(parentPid, 0);                                                      // 85
      } catch (err) {                                                                    // 86
        console.error("Parent process is dead! Exiting.");                               // 87
        process.exit(1);                                                                 // 88
      }                                                                                  // 89
    });                                                                                  // 90
  }                                                                                      // 91
};                                                                                       // 92
                                                                                         // 93
                                                                                         // 94
var sha1 = function (contents) {                                                         // 95
  var hash = crypto.createHash('sha1');                                                  // 96
  hash.update(contents);                                                                 // 97
  return hash.digest('hex');                                                             // 98
};                                                                                       // 99
                                                                                         // 100
var readUtf8FileSync = function (filename) {                                             // 101
  return Meteor.wrapAsync(fs.readFile)(filename, 'utf8');                                // 102
};                                                                                       // 103
                                                                                         // 104
// #BrowserIdentification                                                                // 105
//                                                                                       // 106
// We have multiple places that want to identify the browser: the                        // 107
// unsupported browser page, the appcache package, and, eventually                       // 108
// delivering browser polyfills only as needed.                                          // 109
//                                                                                       // 110
// To avoid detecting the browser in multiple places ad-hoc, we create a                 // 111
// Meteor "browser" object. It uses but does not expose the npm                          // 112
// useragent module (we could choose a different mechanism to identify                   // 113
// the browser in the future if we wanted to).  The browser object                       // 114
// contains                                                                              // 115
//                                                                                       // 116
// * `name`: the name of the browser in camel case                                       // 117
// * `major`, `minor`, `patch`: integers describing the browser version                  // 118
//                                                                                       // 119
// Also here is an early version of a Meteor `request` object, intended                  // 120
// to be a high-level description of the request without exposing                        // 121
// details of connect's low-level `req`.  Currently it contains:                         // 122
//                                                                                       // 123
// * `browser`: browser identification object described above                            // 124
// * `url`: parsed url, including parsed query params                                    // 125
//                                                                                       // 126
// As a temporary hack there is a `categorizeRequest` function on WebApp which           // 127
// converts a connect `req` to a Meteor `request`. This can go away once smart           // 128
// packages such as appcache are being passed a `request` object directly when           // 129
// they serve content.                                                                   // 130
//                                                                                       // 131
// This allows `request` to be used uniformly: it is passed to the html                  // 132
// attributes hook, and the appcache package can use it when deciding                    // 133
// whether to generate a 404 for the manifest.                                           // 134
//                                                                                       // 135
// Real routing / server side rendering will probably refactor this                      // 136
// heavily.                                                                              // 137
                                                                                         // 138
                                                                                         // 139
// e.g. "Mobile Safari" => "mobileSafari"                                                // 140
var camelCase = function (name) {                                                        // 141
  var parts = name.split(' ');                                                           // 142
  parts[0] = parts[0].toLowerCase();                                                     // 143
  for (var i = 1;  i < parts.length;  ++i) {                                             // 144
    parts[i] = parts[i].charAt(0).toUpperCase() + parts[i].substr(1);                    // 145
  }                                                                                      // 146
  return parts.join('');                                                                 // 147
};                                                                                       // 148
                                                                                         // 149
var identifyBrowser = function (userAgentString) {                                       // 150
  var userAgent = useragent.lookup(userAgentString);                                     // 151
  return {                                                                               // 152
    name: camelCase(userAgent.family),                                                   // 153
    major: +userAgent.major,                                                             // 154
    minor: +userAgent.minor,                                                             // 155
    patch: +userAgent.patch                                                              // 156
  };                                                                                     // 157
};                                                                                       // 158
                                                                                         // 159
// XXX Refactor as part of implementing real routing.                                    // 160
WebAppInternals.identifyBrowser = identifyBrowser;                                       // 161
                                                                                         // 162
WebApp.categorizeRequest = function (req) {                                              // 163
  return {                                                                               // 164
    browser: identifyBrowser(req.headers['user-agent']),                                 // 165
    url: url.parse(req.url, true)                                                        // 166
  };                                                                                     // 167
};                                                                                       // 168
                                                                                         // 169
// HTML attribute hooks: functions to be called to determine any attributes to           // 170
// be added to the '<html>' tag. Each function is passed a 'request' object (see         // 171
// #BrowserIdentification) and should return a string,                                   // 172
var htmlAttributeHooks = [];                                                             // 173
var getHtmlAttributes = function (request) {                                             // 174
  var combinedAttributes  = {};                                                          // 175
  _.each(htmlAttributeHooks || [], function (hook) {                                     // 176
    var attributes = hook(request);                                                      // 177
    if (attributes === null)                                                             // 178
      return;                                                                            // 179
    if (typeof attributes !== 'object')                                                  // 180
      throw Error("HTML attribute hook must return null or object");                     // 181
    _.extend(combinedAttributes, attributes);                                            // 182
  });                                                                                    // 183
  return combinedAttributes;                                                             // 184
};                                                                                       // 185
WebApp.addHtmlAttributeHook = function (hook) {                                          // 186
  htmlAttributeHooks.push(hook);                                                         // 187
};                                                                                       // 188
                                                                                         // 189
// Serve app HTML for this URL?                                                          // 190
var appUrl = function (url) {                                                            // 191
  if (url === '/favicon.ico' || url === '/robots.txt')                                   // 192
    return false;                                                                        // 193
                                                                                         // 194
  // NOTE: app.manifest is not a web standard like favicon.ico and                       // 195
  // robots.txt. It is a file name we have chosen to use for HTML5                       // 196
  // appcache URLs. It is included here to prevent using an appcache                     // 197
  // then removing it from poisoning an app permanently. Eventually,                     // 198
  // once we have server side routing, this won't be needed as                           // 199
  // unknown URLs with return a 404 automatically.                                       // 200
  if (url === '/app.manifest')                                                           // 201
    return false;                                                                        // 202
                                                                                         // 203
  // Avoid serving app HTML for declared routes such as /sockjs/.                        // 204
  if (RoutePolicy.classify(url))                                                         // 205
    return false;                                                                        // 206
                                                                                         // 207
  // we currently return app HTML on all URLs by default                                 // 208
  return true;                                                                           // 209
};                                                                                       // 210
                                                                                         // 211
                                                                                         // 212
// We need to calculate the client hash after all packages have loaded                   // 213
// to give them a chance to populate __meteor_runtime_config__.                          // 214
//                                                                                       // 215
// Calculating the hash during startup means that packages can only                      // 216
// populate __meteor_runtime_config__ during load, not during startup.                   // 217
//                                                                                       // 218
// Calculating instead it at the beginning of main after all startup                     // 219
// hooks had run would allow packages to also populate                                   // 220
// __meteor_runtime_config__ during startup, but that's too late for                     // 221
// autoupdate because it needs to have the client hash at startup to                     // 222
// insert the auto update version itself into                                            // 223
// __meteor_runtime_config__ to get it to the client.                                    // 224
//                                                                                       // 225
// An alternative would be to give autoupdate a "post-start,                             // 226
// pre-listen" hook to allow it to insert the auto update version at                     // 227
// the right moment.                                                                     // 228
                                                                                         // 229
Meteor.startup(function () {                                                             // 230
  var calculateClientHash = WebAppHashing.calculateClientHash;                           // 231
  WebApp.clientHash = function (archName) {                                              // 232
    archName = archName || WebApp.defaultArch;                                           // 233
    return calculateClientHash(WebApp.clientPrograms[archName].manifest);                // 234
  };                                                                                     // 235
                                                                                         // 236
  WebApp.calculateClientHashRefreshable = function (archName) {                          // 237
    archName = archName || WebApp.defaultArch;                                           // 238
    return calculateClientHash(WebApp.clientPrograms[archName].manifest,                 // 239
      function (name) {                                                                  // 240
        return name === "css";                                                           // 241
      });                                                                                // 242
  };                                                                                     // 243
  WebApp.calculateClientHashNonRefreshable = function (archName) {                       // 244
    archName = archName || WebApp.defaultArch;                                           // 245
    return calculateClientHash(WebApp.clientPrograms[archName].manifest,                 // 246
      function (name) {                                                                  // 247
        return name !== "css";                                                           // 248
      });                                                                                // 249
  };                                                                                     // 250
  WebApp.calculateClientHashCordova = function () {                                      // 251
    var archName = 'web.cordova';                                                        // 252
    if (! WebApp.clientPrograms[archName])                                               // 253
      return 'none';                                                                     // 254
                                                                                         // 255
    return calculateClientHash(                                                          // 256
      WebApp.clientPrograms[archName].manifest, null, _.pick(                            // 257
        __meteor_runtime_config__, 'PUBLIC_SETTINGS'));                                  // 258
  };                                                                                     // 259
});                                                                                      // 260
                                                                                         // 261
                                                                                         // 262
                                                                                         // 263
// When we have a request pending, we want the socket timeout to be long, to             // 264
// give ourselves a while to serve it, and to allow sockjs long polls to                 // 265
// complete.  On the other hand, we want to close idle sockets relatively                // 266
// quickly, so that we can shut down relatively promptly but cleanly, without            // 267
// cutting off anyone's response.                                                        // 268
WebApp._timeoutAdjustmentRequestCallback = function (req, res) {                         // 269
  // this is really just req.socket.setTimeout(LONG_SOCKET_TIMEOUT);                     // 270
  req.setTimeout(LONG_SOCKET_TIMEOUT);                                                   // 271
  // Insert our new finish listener to run BEFORE the existing one which removes         // 272
  // the response from the socket.                                                       // 273
  var finishListeners = res.listeners('finish');                                         // 274
  // XXX Apparently in Node 0.12 this event is now called 'prefinish'.                   // 275
  // https://github.com/joyent/node/commit/7c9b6070                                      // 276
  res.removeAllListeners('finish');                                                      // 277
  res.on('finish', function () {                                                         // 278
    res.setTimeout(SHORT_SOCKET_TIMEOUT);                                                // 279
  });                                                                                    // 280
  _.each(finishListeners, function (l) { res.on('finish', l); });                        // 281
};                                                                                       // 282
                                                                                         // 283
                                                                                         // 284
// Will be updated by main before we listen.                                             // 285
// Map from client arch to boilerplate object.                                           // 286
// Boilerplate object has:                                                               // 287
//   - func: XXX                                                                         // 288
//   - baseData: XXX                                                                     // 289
var boilerplateByArch = {};                                                              // 290
                                                                                         // 291
// Given a request (as returned from `categorizeRequest`), return the                    // 292
// boilerplate HTML to serve for that request. Memoizes on HTML                          // 293
// attributes (used by, eg, appcache) and whether inline scripts are                     // 294
// currently allowed.                                                                    // 295
// XXX so far this function is always called with arch === 'web.browser'                 // 296
var memoizedBoilerplate = {};                                                            // 297
var getBoilerplate = function (request, arch) {                                          // 298
                                                                                         // 299
  var htmlAttributes = getHtmlAttributes(request);                                       // 300
                                                                                         // 301
  // The only thing that changes from request to request (for now) are                   // 302
  // the HTML attributes (used by, eg, appcache) and whether inline                      // 303
  // scripts are allowed, so we can memoize based on that.                               // 304
  var memHash = JSON.stringify({                                                         // 305
    inlineScriptsAllowed: inlineScriptsAllowed,                                          // 306
    htmlAttributes: htmlAttributes,                                                      // 307
    arch: arch                                                                           // 308
  });                                                                                    // 309
                                                                                         // 310
  if (! memoizedBoilerplate[memHash]) {                                                  // 311
    memoizedBoilerplate[memHash] = boilerplateByArch[arch].toHTML({                      // 312
      htmlAttributes: htmlAttributes                                                     // 313
    });                                                                                  // 314
  }                                                                                      // 315
  return memoizedBoilerplate[memHash];                                                   // 316
};                                                                                       // 317
                                                                                         // 318
WebAppInternals.generateBoilerplateInstance = function (arch,                            // 319
                                                        manifest,                        // 320
                                                        additionalOptions) {             // 321
  additionalOptions = additionalOptions || {};                                           // 322
                                                                                         // 323
  var runtimeConfig = _.extend(                                                          // 324
    _.clone(__meteor_runtime_config__),                                                  // 325
    additionalOptions.runtimeConfigOverrides || {}                                       // 326
  );                                                                                     // 327
                                                                                         // 328
  return new Boilerplate(arch, manifest,                                                 // 329
    _.extend({                                                                           // 330
      pathMapper: function (itemPath) {                                                  // 331
        return path.join(archPath[arch], itemPath); },                                   // 332
      baseDataExtension: {                                                               // 333
        additionalStaticJs: _.map(                                                       // 334
          additionalStaticJs || [],                                                      // 335
          function (contents, pathname) {                                                // 336
            return {                                                                     // 337
              pathname: pathname,                                                        // 338
              contents: contents                                                         // 339
            };                                                                           // 340
          }                                                                              // 341
        ),                                                                               // 342
        meteorRuntimeConfig: JSON.stringify(runtimeConfig),                              // 343
        rootUrlPathPrefix: __meteor_runtime_config__.ROOT_URL_PATH_PREFIX || '',         // 344
        bundledJsCssPrefix: bundledJsCssPrefix ||                                        // 345
          __meteor_runtime_config__.ROOT_URL_PATH_PREFIX || '',                          // 346
        inlineScriptsAllowed: WebAppInternals.inlineScriptsAllowed(),                    // 347
        inline: additionalOptions.inline                                                 // 348
      }                                                                                  // 349
    }, additionalOptions)                                                                // 350
  );                                                                                     // 351
};                                                                                       // 352
                                                                                         // 353
// A mapping from url path to "info". Where "info" has the following fields:             // 354
// - type: the type of file to be served                                                 // 355
// - cacheable: optionally, whether the file should be cached or not                     // 356
// - sourceMapUrl: optionally, the url of the source map                                 // 357
//                                                                                       // 358
// Info also contains one of the following:                                              // 359
// - content: the stringified content that should be served at this path                 // 360
// - absolutePath: the absolute path on disk to the file                                 // 361
                                                                                         // 362
var staticFiles;                                                                         // 363
                                                                                         // 364
// Serve static files from the manifest or added with                                    // 365
// `addStaticJs`. Exported for tests.                                                    // 366
WebAppInternals.staticFilesMiddleware = function (staticFiles, req, res, next) {         // 367
  if ('GET' != req.method && 'HEAD' != req.method) {                                     // 368
    next();                                                                              // 369
    return;                                                                              // 370
  }                                                                                      // 371
  var pathname = connect.utils.parseUrl(req).pathname;                                   // 372
  try {                                                                                  // 373
    pathname = decodeURIComponent(pathname);                                             // 374
  } catch (e) {                                                                          // 375
    next();                                                                              // 376
    return;                                                                              // 377
  }                                                                                      // 378
                                                                                         // 379
  var serveStaticJs = function (s) {                                                     // 380
    res.writeHead(200, {                                                                 // 381
      'Content-type': 'application/javascript; charset=UTF-8'                            // 382
    });                                                                                  // 383
    res.write(s);                                                                        // 384
    res.end();                                                                           // 385
  };                                                                                     // 386
                                                                                         // 387
  if (pathname === "/meteor_runtime_config.js" &&                                        // 388
      ! WebAppInternals.inlineScriptsAllowed()) {                                        // 389
    serveStaticJs("__meteor_runtime_config__ = " +                                       // 390
                  JSON.stringify(__meteor_runtime_config__) + ";");                      // 391
    return;                                                                              // 392
  } else if (_.has(additionalStaticJs, pathname) &&                                      // 393
              ! WebAppInternals.inlineScriptsAllowed()) {                                // 394
    serveStaticJs(additionalStaticJs[pathname]);                                         // 395
    return;                                                                              // 396
  }                                                                                      // 397
                                                                                         // 398
  if (!_.has(staticFiles, pathname)) {                                                   // 399
    next();                                                                              // 400
    return;                                                                              // 401
  }                                                                                      // 402
                                                                                         // 403
  // We don't need to call pause because, unlike 'static', once we call into             // 404
  // 'send' and yield to the event loop, we never call another handler with              // 405
  // 'next'.                                                                             // 406
                                                                                         // 407
  var info = staticFiles[pathname];                                                      // 408
                                                                                         // 409
  // Cacheable files are files that should never change. Typically                       // 410
  // named by their hash (eg meteor bundled js and css files).                           // 411
  // We cache them ~forever (1yr).                                                       // 412
  //                                                                                     // 413
  // We cache non-cacheable files anyway. This isn't really correct, as users            // 414
  // can change the files and changes won't propagate immediately. However, if           // 415
  // we don't cache them, browsers will 'flicker' when rerendering                       // 416
  // images. Eventually we will probably want to rewrite URLs of static assets           // 417
  // to include a query parameter to bust caches. That way we can both get               // 418
  // good caching behavior and allow users to change assets without delay.               // 419
  // https://github.com/meteor/meteor/issues/773                                         // 420
  var maxAge = info.cacheable                                                            // 421
        ? 1000 * 60 * 60 * 24 * 365                                                      // 422
        : 1000 * 60 * 60 * 24;                                                           // 423
                                                                                         // 424
  // Set the X-SourceMap header, which current Chrome, FireFox, and Safari               // 425
  // understand.  (The SourceMap header is slightly more spec-correct but FF             // 426
  // doesn't understand it.)                                                             // 427
  //                                                                                     // 428
  // You may also need to enable source maps in Chrome: open dev tools, click            // 429
  // the gear in the bottom right corner, and select "enable source maps".               // 430
  if (info.sourceMapUrl) {                                                               // 431
    res.setHeader('X-SourceMap',                                                         // 432
                  __meteor_runtime_config__.ROOT_URL_PATH_PREFIX +                       // 433
                  info.sourceMapUrl);                                                    // 434
  }                                                                                      // 435
                                                                                         // 436
  if (info.type === "js") {                                                              // 437
    res.setHeader("Content-Type", "application/javascript; charset=UTF-8");              // 438
  } else if (info.type === "css") {                                                      // 439
    res.setHeader("Content-Type", "text/css; charset=UTF-8");                            // 440
  } else if (info.type === "json") {                                                     // 441
    res.setHeader("Content-Type", "application/json; charset=UTF-8");                    // 442
    // XXX if it is a manifest we are serving, set additional headers                    // 443
    if (/\/manifest.json$/.test(pathname)) {                                             // 444
      res.setHeader("Access-Control-Allow-Origin", "*");                                 // 445
    }                                                                                    // 446
  }                                                                                      // 447
                                                                                         // 448
  if (info.content) {                                                                    // 449
    res.write(info.content);                                                             // 450
    res.end();                                                                           // 451
  } else {                                                                               // 452
    send(req, info.absolutePath)                                                         // 453
      .maxage(maxAge)                                                                    // 454
      .hidden(true)  // if we specified a dotfile in the manifest, serve it              // 455
      .on('error', function (err) {                                                      // 456
        Log.error("Error serving static file " + err);                                   // 457
        res.writeHead(500);                                                              // 458
        res.end();                                                                       // 459
      })                                                                                 // 460
      .on('directory', function () {                                                     // 461
        Log.error("Unexpected directory " + info.absolutePath);                          // 462
        res.writeHead(500);                                                              // 463
        res.end();                                                                       // 464
      })                                                                                 // 465
      .pipe(res);                                                                        // 466
  }                                                                                      // 467
};                                                                                       // 468
                                                                                         // 469
var getUrlPrefixForArch = function (arch) {                                              // 470
  // XXX we rely on the fact that arch names don't contain slashes                       // 471
  // in that case we would need to uri escape it                                         // 472
                                                                                         // 473
  // We add '__' to the beginning of non-standard archs to "scope" the url               // 474
  // to Meteor internals.                                                                // 475
  return arch === WebApp.defaultArch ?                                                   // 476
    '' : '/' + '__' + arch.replace(/^web\./, '');                                        // 477
};                                                                                       // 478
                                                                                         // 479
var runWebAppServer = function () {                                                      // 480
  var shuttingDown = false;                                                              // 481
  var syncQueue = new Meteor._SynchronousQueue();                                        // 482
                                                                                         // 483
  var getItemPathname = function (itemUrl) {                                             // 484
    return decodeURIComponent(url.parse(itemUrl).pathname);                              // 485
  };                                                                                     // 486
                                                                                         // 487
  WebAppInternals.reloadClientPrograms = function () {                                   // 488
    syncQueue.runTask(function() {                                                       // 489
      staticFiles = {};                                                                  // 490
      var generateClientProgram = function (clientPath, arch) {                          // 491
        // read the control for the client we'll be serving up                           // 492
        var clientJsonPath = path.join(__meteor_bootstrap__.serverDir,                   // 493
                                   clientPath);                                          // 494
        var clientDir = path.dirname(clientJsonPath);                                    // 495
        var clientJson = JSON.parse(readUtf8FileSync(clientJsonPath));                   // 496
        if (clientJson.format !== "web-program-pre1")                                    // 497
          throw new Error("Unsupported format for client assets: " +                     // 498
                          JSON.stringify(clientJson.format));                            // 499
                                                                                         // 500
        if (! clientJsonPath || ! clientDir || ! clientJson)                             // 501
          throw new Error("Client config file not parsed.");                             // 502
                                                                                         // 503
        var urlPrefix = getUrlPrefixForArch(arch);                                       // 504
                                                                                         // 505
        var manifest = clientJson.manifest;                                              // 506
        _.each(manifest, function (item) {                                               // 507
          if (item.url && item.where === "client") {                                     // 508
            staticFiles[urlPrefix + getItemPathname(item.url)] = {                       // 509
              absolutePath: path.join(clientDir, item.path),                             // 510
              cacheable: item.cacheable,                                                 // 511
              // Link from source to its map                                             // 512
              sourceMapUrl: item.sourceMapUrl,                                           // 513
              type: item.type                                                            // 514
            };                                                                           // 515
                                                                                         // 516
            if (item.sourceMap) {                                                        // 517
              // Serve the source map too, under the specified URL. We assume all        // 518
              // source maps are cacheable.                                              // 519
              staticFiles[urlPrefix + getItemPathname(item.sourceMapUrl)] = {            // 520
                absolutePath: path.join(clientDir, item.sourceMap),                      // 521
                cacheable: true                                                          // 522
              };                                                                         // 523
            }                                                                            // 524
          }                                                                              // 525
        });                                                                              // 526
                                                                                         // 527
        var program = {                                                                  // 528
          manifest: manifest,                                                            // 529
          version: WebAppHashing.calculateClientHash(manifest, null, _.pick(             // 530
            __meteor_runtime_config__, 'PUBLIC_SETTINGS')),                              // 531
          PUBLIC_SETTINGS: __meteor_runtime_config__.PUBLIC_SETTINGS                     // 532
        };                                                                               // 533
                                                                                         // 534
        WebApp.clientPrograms[arch] = program;                                           // 535
                                                                                         // 536
        // Serve the program as a string at /foo/<arch>/manifest.json                    // 537
        // XXX change manifest.json -> program.json                                      // 538
        staticFiles[path.join(urlPrefix, 'manifest.json')] = {                           // 539
          content: JSON.stringify(program),                                              // 540
          cacheable: true,                                                               // 541
          type: "json"                                                                   // 542
        };                                                                               // 543
      };                                                                                 // 544
                                                                                         // 545
      try {                                                                              // 546
        var clientPaths = __meteor_bootstrap__.configJson.clientPaths;                   // 547
        _.each(clientPaths, function (clientPath, arch) {                                // 548
          archPath[arch] = path.dirname(clientPath);                                     // 549
          generateClientProgram(clientPath, arch);                                       // 550
        });                                                                              // 551
                                                                                         // 552
        // Exported for tests.                                                           // 553
        WebAppInternals.staticFiles = staticFiles;                                       // 554
      } catch (e) {                                                                      // 555
        Log.error("Error reloading the client program: " + e.stack);                     // 556
        process.exit(1);                                                                 // 557
      }                                                                                  // 558
    });                                                                                  // 559
  };                                                                                     // 560
                                                                                         // 561
  WebAppInternals.generateBoilerplate = function () {                                    // 562
    // This boilerplate will be served to the mobile devices when used with              // 563
    // Meteor/Cordova for the Hot-Code Push and since the file will be served by         // 564
    // the device's server, it is important to set the DDP url to the actual             // 565
    // Meteor server accepting DDP connections and not the device's file server.         // 566
    var defaultOptionsForArch = {                                                        // 567
      'web.cordova': {                                                                   // 568
        runtimeConfigOverrides: {                                                        // 569
          DDP_DEFAULT_CONNECTION_URL: process.env.MOBILE_DDP_URL ||                      // 570
            __meteor_runtime_config__.ROOT_URL,                                          // 571
          ROOT_URL: process.env.MOBILE_ROOT_URL ||                                       // 572
            __meteor_runtime_config__.ROOT_URL                                           // 573
        }                                                                                // 574
      }                                                                                  // 575
    };                                                                                   // 576
                                                                                         // 577
    syncQueue.runTask(function() {                                                       // 578
      _.each(WebApp.clientPrograms, function (program, archName) {                       // 579
        boilerplateByArch[archName] =                                                    // 580
          WebAppInternals.generateBoilerplateInstance(                                   // 581
            archName, program.manifest,                                                  // 582
            defaultOptionsForArch[archName]);                                            // 583
      });                                                                                // 584
                                                                                         // 585
      // Clear the memoized boilerplate cache.                                           // 586
      memoizedBoilerplate = {};                                                          // 587
                                                                                         // 588
      // Configure CSS injection for the default arch                                    // 589
      // XXX implement the CSS injection for all archs?                                  // 590
      WebAppInternals.refreshableAssets = {                                              // 591
        allCss: boilerplateByArch[WebApp.defaultArch].baseData.css                       // 592
      };                                                                                 // 593
    });                                                                                  // 594
  };                                                                                     // 595
                                                                                         // 596
  WebAppInternals.reloadClientPrograms();                                                // 597
                                                                                         // 598
  // webserver                                                                           // 599
  var app = connect();                                                                   // 600
                                                                                         // 601
  // Auto-compress any json, javascript, or text.                                        // 602
  app.use(connect.compress());                                                           // 603
                                                                                         // 604
  // Packages and apps can add handlers that run before any other Meteor                 // 605
  // handlers via WebApp.rawConnectHandlers.                                             // 606
  var rawConnectHandlers = connect();                                                    // 607
  app.use(rawConnectHandlers);                                                           // 608
                                                                                         // 609
  // Strip off the path prefix, if it exists.                                            // 610
  app.use(function (request, response, next) {                                           // 611
    var pathPrefix = __meteor_runtime_config__.ROOT_URL_PATH_PREFIX;                     // 612
    var url = Npm.require('url').parse(request.url);                                     // 613
    var pathname = url.pathname;                                                         // 614
    // check if the path in the url starts with the path prefix (and the part            // 615
    // after the path prefix must start with a / if it exists.)                          // 616
    if (pathPrefix && pathname.substring(0, pathPrefix.length) === pathPrefix &&         // 617
       (pathname.length == pathPrefix.length                                             // 618
        || pathname.substring(pathPrefix.length, pathPrefix.length + 1) === "/")) {      // 619
      request.url = request.url.substring(pathPrefix.length);                            // 620
      next();                                                                            // 621
    } else if (pathname === "/favicon.ico" || pathname === "/robots.txt") {              // 622
      next();                                                                            // 623
    } else if (pathPrefix) {                                                             // 624
      response.writeHead(404);                                                           // 625
      response.write("Unknown path");                                                    // 626
      response.end();                                                                    // 627
    } else {                                                                             // 628
      next();                                                                            // 629
    }                                                                                    // 630
  });                                                                                    // 631
                                                                                         // 632
  // Parse the query string into res.query. Used by oauth_server, but it's               // 633
  // generally pretty handy..                                                            // 634
  app.use(connect.query());                                                              // 635
                                                                                         // 636
  // Serve static files from the manifest.                                               // 637
  // This is inspired by the 'static' middleware.                                        // 638
  app.use(function (req, res, next) {                                                    // 639
    Fiber(function () {                                                                  // 640
     WebAppInternals.staticFilesMiddleware(staticFiles, req, res, next);                 // 641
    }).run();                                                                            // 642
  });                                                                                    // 643
                                                                                         // 644
  // Packages and apps can add handlers to this via WebApp.connectHandlers.              // 645
  // They are inserted before our default handler.                                       // 646
  var packageAndAppHandlers = connect();                                                 // 647
  app.use(packageAndAppHandlers);                                                        // 648
                                                                                         // 649
  var suppressConnectErrors = false;                                                     // 650
  // connect knows it is an error handler because it has 4 arguments instead of          // 651
  // 3. go figure.  (It is not smart enough to find such a thing if it's hidden          // 652
  // inside packageAndAppHandlers.)                                                      // 653
  app.use(function (err, req, res, next) {                                               // 654
    if (!err || !suppressConnectErrors || !req.headers['x-suppress-error']) {            // 655
      next(err);                                                                         // 656
      return;                                                                            // 657
    }                                                                                    // 658
    res.writeHead(err.status, { 'Content-Type': 'text/plain' });                         // 659
    res.end("An error message");                                                         // 660
  });                                                                                    // 661
                                                                                         // 662
  app.use(function (req, res, next) {                                                    // 663
    if (! appUrl(req.url))                                                               // 664
      return next();                                                                     // 665
                                                                                         // 666
    var headers = {                                                                      // 667
      'Content-Type':  'text/html; charset=utf-8'                                        // 668
    };                                                                                   // 669
    if (shuttingDown)                                                                    // 670
      headers['Connection'] = 'Close';                                                   // 671
                                                                                         // 672
    var request = WebApp.categorizeRequest(req);                                         // 673
                                                                                         // 674
    if (request.url.query && request.url.query['meteor_css_resource']) {                 // 675
      // In this case, we're requesting a CSS resource in the meteor-specific            // 676
      // way, but we don't have it.  Serve a static css file that indicates that         // 677
      // we didn't have it, so we can detect that and refresh.                           // 678
      headers['Content-Type'] = 'text/css; charset=utf-8';                               // 679
      res.writeHead(200, headers);                                                       // 680
      res.write(".meteor-css-not-found-error { width: 0px;}");                           // 681
      res.end();                                                                         // 682
      return undefined;                                                                  // 683
    }                                                                                    // 684
                                                                                         // 685
    // /packages/asdfsad ... /__cordova/dafsdf.js                                        // 686
    var pathname = connect.utils.parseUrl(req).pathname;                                 // 687
    var archKey = pathname.split('/')[1];                                                // 688
    var archKeyCleaned = 'web.' + archKey.replace(/^__/, '');                            // 689
                                                                                         // 690
    if (! /^__/.test(archKey) || ! _.has(archPath, archKeyCleaned)) {                    // 691
      archKey = WebApp.defaultArch;                                                      // 692
    } else {                                                                             // 693
      archKey = archKeyCleaned;                                                          // 694
    }                                                                                    // 695
                                                                                         // 696
    var boilerplate;                                                                     // 697
    try {                                                                                // 698
      boilerplate = getBoilerplate(request, archKey);                                    // 699
    } catch (e) {                                                                        // 700
      Log.error("Error running template: " + e);                                         // 701
      res.writeHead(500, headers);                                                       // 702
      res.end();                                                                         // 703
      return undefined;                                                                  // 704
    }                                                                                    // 705
                                                                                         // 706
    res.writeHead(200, headers);                                                         // 707
    res.write(boilerplate);                                                              // 708
    res.end();                                                                           // 709
    return undefined;                                                                    // 710
  });                                                                                    // 711
                                                                                         // 712
  // Return 404 by default, if no other handlers serve this URL.                         // 713
  app.use(function (req, res) {                                                          // 714
    res.writeHead(404);                                                                  // 715
    res.end();                                                                           // 716
  });                                                                                    // 717
                                                                                         // 718
                                                                                         // 719
  var httpServer = http.createServer(app);                                               // 720
  var onListeningCallbacks = [];                                                         // 721
                                                                                         // 722
  // After 5 seconds w/o data on a socket, kill it.  On the other hand, if               // 723
  // there's an outstanding request, give it a higher timeout instead (to avoid          // 724
  // killing long-polling requests)                                                      // 725
  httpServer.setTimeout(SHORT_SOCKET_TIMEOUT);                                           // 726
                                                                                         // 727
  // Do this here, and then also in livedata/stream_server.js, because                   // 728
  // stream_server.js kills all the current request handlers when installing its         // 729
  // own.                                                                                // 730
  httpServer.on('request', WebApp._timeoutAdjustmentRequestCallback);                    // 731
                                                                                         // 732
                                                                                         // 733
  // For now, handle SIGHUP here.  Later, this should be in some centralized             // 734
  // Meteor shutdown code.                                                               // 735
  process.on('SIGHUP', Meteor.bindEnvironment(function () {                              // 736
    shuttingDown = true;                                                                 // 737
    // tell others with websockets open that we plan to close this.                      // 738
    // XXX: Eventually, this should be done with a standard meteor shut-down             // 739
    // logic path.                                                                       // 740
    httpServer.emit('meteor-closing');                                                   // 741
                                                                                         // 742
    httpServer.close(Meteor.bindEnvironment(function () {                                // 743
      if (proxy) {                                                                       // 744
        try {                                                                            // 745
          proxy.call('removeBindingsForJob', process.env.GALAXY_JOB);                    // 746
        } catch (e) {                                                                    // 747
          Log.error("Error removing bindings: " + e.message);                            // 748
          process.exit(1);                                                               // 749
        }                                                                                // 750
      }                                                                                  // 751
      process.exit(0);                                                                   // 752
                                                                                         // 753
    }, "On http server close failed"));                                                  // 754
                                                                                         // 755
    // Ideally we will close before this hits.                                           // 756
    Meteor.setTimeout(function () {                                                      // 757
      Log.warn("Closed by SIGHUP but one or more HTTP requests may not have finished."); // 758
      process.exit(1);                                                                   // 759
    }, 5000);                                                                            // 760
                                                                                         // 761
  }, function (err) {                                                                    // 762
    console.log(err);                                                                    // 763
    process.exit(1);                                                                     // 764
  }));                                                                                   // 765
                                                                                         // 766
  // start up app                                                                        // 767
  _.extend(WebApp, {                                                                     // 768
    connectHandlers: packageAndAppHandlers,                                              // 769
    rawConnectHandlers: rawConnectHandlers,                                              // 770
    httpServer: httpServer,                                                              // 771
    // For testing.                                                                      // 772
    suppressConnectErrors: function () {                                                 // 773
      suppressConnectErrors = true;                                                      // 774
    },                                                                                   // 775
    onListening: function (f) {                                                          // 776
      if (onListeningCallbacks)                                                          // 777
        onListeningCallbacks.push(f);                                                    // 778
      else                                                                               // 779
        f();                                                                             // 780
    },                                                                                   // 781
    // Hack: allow http tests to call connect.basicAuth without making them              // 782
    // Npm.depends on another copy of connect. (That would be fine if we could           // 783
    // have test-only NPM dependencies but is overkill here.)                            // 784
    __basicAuth__: connect.basicAuth                                                     // 785
  });                                                                                    // 786
                                                                                         // 787
  // Let the rest of the packages (and Meteor.startup hooks) insert connect              // 788
  // middlewares and update __meteor_runtime_config__, then keep going to set up         // 789
  // actually serving HTML.                                                              // 790
  main = function (argv) {                                                               // 791
    // main happens post startup hooks, so we don't need a Meteor.startup() to           // 792
    // ensure this happens after the galaxy package is loaded.                           // 793
    var AppConfig = Package["application-configuration"].AppConfig;                      // 794
    // We used to use the optimist npm package to parse argv here, but it's              // 795
    // overkill (and no longer in the dev bundle). Just assume any instance of           // 796
    // '--keepalive' is a use of the option.                                             // 797
    // XXX COMPAT WITH 0.9.2.2                                                           // 798
    // We used to expect keepalives to be written to stdin every few                     // 799
    // seconds; now we just check if the parent process is still alive                   // 800
    // every few seconds.                                                                // 801
    var expectKeepalives = _.contains(argv, '--keepalive');                              // 802
    // XXX Saddest argument parsing ever, should we add optimist back to                 // 803
    // the dev bundle?                                                                   // 804
    var parentPid = null;                                                                // 805
    var parentPidIndex = _.indexOf(argv, "--parent-pid");                                // 806
    if (parentPidIndex !== -1) {                                                         // 807
      parentPid = argv[parentPidIndex + 1];                                              // 808
    }                                                                                    // 809
    WebAppInternals.generateBoilerplate();                                               // 810
                                                                                         // 811
    // only start listening after all the startup code has run.                          // 812
    var localPort = parseInt(process.env.PORT) || 0;                                     // 813
    var host = process.env.BIND_IP;                                                      // 814
    var localIp = host || '0.0.0.0';                                                     // 815
    httpServer.listen(localPort, localIp, Meteor.bindEnvironment(function() {            // 816
      if (expectKeepalives || parentPid)                                                 // 817
        console.log("LISTENING"); // must match run-app.js                               // 818
      var proxyBinding;                                                                  // 819
                                                                                         // 820
      AppConfig.configurePackage('webapp', function (configuration) {                    // 821
        if (proxyBinding)                                                                // 822
          proxyBinding.stop();                                                           // 823
        if (configuration && configuration.proxy) {                                      // 824
          // TODO: We got rid of the place where this checks the app's                   // 825
          // configuration, because this wants to be configured for some things          // 826
          // on a per-job basis.  Discuss w/ teammates.                                  // 827
          proxyBinding = AppConfig.configureService(                                     // 828
            "proxy",                                                                     // 829
            "pre0",                                                                      // 830
            function (proxyService) {                                                    // 831
              if (proxyService && ! _.isEmpty(proxyService)) {                           // 832
                var proxyConf;                                                           // 833
                // XXX Figure out a per-job way to specify bind location                 // 834
                // (besides hardcoding the location for ADMIN_APP jobs).                 // 835
                if (process.env.ADMIN_APP) {                                             // 836
                  var bindPathPrefix = "";                                               // 837
                  if (process.env.GALAXY_APP !== "panel") {                              // 838
                    bindPathPrefix = "/" + bindPathPrefix +                              // 839
                      encodeURIComponent(                                                // 840
                        process.env.GALAXY_APP                                           // 841
                      ).replace(/\./g, '_');                                             // 842
                  }                                                                      // 843
                  proxyConf = {                                                          // 844
                    bindHost: process.env.GALAXY_NAME,                                   // 845
                    bindPathPrefix: bindPathPrefix,                                      // 846
                    requiresAuth: true                                                   // 847
                  };                                                                     // 848
                } else {                                                                 // 849
                  proxyConf = configuration.proxy;                                       // 850
                }                                                                        // 851
                Log("Attempting to bind to proxy at " +                                  // 852
                    proxyService);                                                       // 853
                WebAppInternals.bindToProxy(_.extend({                                   // 854
                  proxyEndpoint: proxyService                                            // 855
                }, proxyConf));                                                          // 856
              }                                                                          // 857
            }                                                                            // 858
          );                                                                             // 859
        }                                                                                // 860
      });                                                                                // 861
                                                                                         // 862
      var callbacks = onListeningCallbacks;                                              // 863
      onListeningCallbacks = null;                                                       // 864
      _.each(callbacks, function (x) { x(); });                                          // 865
                                                                                         // 866
    }, function (e) {                                                                    // 867
      console.error("Error listening:", e);                                              // 868
      console.error(e && e.stack);                                                       // 869
    }));                                                                                 // 870
                                                                                         // 871
    if (expectKeepalives) {                                                              // 872
      initKeepalive();                                                                   // 873
    }                                                                                    // 874
    if (parentPid) {                                                                     // 875
      startCheckForLiveParent(parentPid);                                                // 876
    }                                                                                    // 877
    return 'DAEMON';                                                                     // 878
  };                                                                                     // 879
};                                                                                       // 880
                                                                                         // 881
                                                                                         // 882
var proxy;                                                                               // 883
WebAppInternals.bindToProxy = function (proxyConfig) {                                   // 884
  var securePort = proxyConfig.securePort || 4433;                                       // 885
  var insecurePort = proxyConfig.insecurePort || 8080;                                   // 886
  var bindPathPrefix = proxyConfig.bindPathPrefix || "";                                 // 887
  // XXX also support galaxy-based lookup                                                // 888
  if (!proxyConfig.proxyEndpoint)                                                        // 889
    throw new Error("missing proxyEndpoint");                                            // 890
  if (!proxyConfig.bindHost)                                                             // 891
    throw new Error("missing bindHost");                                                 // 892
  if (!process.env.GALAXY_JOB)                                                           // 893
    throw new Error("missing $GALAXY_JOB");                                              // 894
  if (!process.env.GALAXY_APP)                                                           // 895
    throw new Error("missing $GALAXY_APP");                                              // 896
  if (!process.env.LAST_START)                                                           // 897
    throw new Error("missing $LAST_START");                                              // 898
                                                                                         // 899
  // XXX rename pid argument to bindTo.                                                  // 900
  // XXX factor out into a 'getPid' function in a 'galaxy' package?                      // 901
  var pid = {                                                                            // 902
    job: process.env.GALAXY_JOB,                                                         // 903
    lastStarted: +(process.env.LAST_START),                                              // 904
    app: process.env.GALAXY_APP                                                          // 905
  };                                                                                     // 906
  var myHost = os.hostname();                                                            // 907
                                                                                         // 908
  WebAppInternals.usingDdpProxy = true;                                                  // 909
                                                                                         // 910
  // This is run after packages are loaded (in main) so we can use                       // 911
  // Follower.connect.                                                                   // 912
  if (proxy) {                                                                           // 913
    // XXX the concept here is that our configuration has changed and                    // 914
    // we have connected to an entirely new follower set, which does                     // 915
    // not have the state that we set up on the follower set that we                     // 916
    // were previously connected to, and so we need to recreate all of                   // 917
    // our bindings -- analogous to getting a SIGHUP and rereading                       // 918
    // your configuration file. so probably this should actually tear                    // 919
    // down the connection and make a whole new one, rather than                         // 920
    // hot-reconnecting to a different URL.                                              // 921
    proxy.reconnect({                                                                    // 922
      url: proxyConfig.proxyEndpoint                                                     // 923
    });                                                                                  // 924
  } else {                                                                               // 925
    proxy = Package["follower-livedata"].Follower.connect(                               // 926
      proxyConfig.proxyEndpoint, {                                                       // 927
        group: "proxy"                                                                   // 928
      }                                                                                  // 929
    );                                                                                   // 930
  }                                                                                      // 931
                                                                                         // 932
  var route = process.env.ROUTE;                                                         // 933
  var ourHost = route.split(":")[0];                                                     // 934
  var ourPort = +route.split(":")[1];                                                    // 935
                                                                                         // 936
  var outstanding = 0;                                                                   // 937
  var startedAll = false;                                                                // 938
  var checkComplete = function () {                                                      // 939
    if (startedAll && ! outstanding)                                                     // 940
      Log("Bound to proxy.");                                                            // 941
  };                                                                                     // 942
  var makeCallback = function () {                                                       // 943
    outstanding++;                                                                       // 944
    return function (err) {                                                              // 945
      if (err)                                                                           // 946
        throw err;                                                                       // 947
      outstanding--;                                                                     // 948
      checkComplete();                                                                   // 949
    };                                                                                   // 950
  };                                                                                     // 951
                                                                                         // 952
  // for now, have our (temporary) requiresAuth flag apply to all                        // 953
  // routes created by this process.                                                     // 954
  var requiresDdpAuth = !! proxyConfig.requiresAuth;                                     // 955
  var requiresHttpAuth = (!! proxyConfig.requiresAuth) &&                                // 956
        (pid.app !== "panel" && pid.app !== "auth");                                     // 957
                                                                                         // 958
  // XXX a current limitation is that we treat securePort and                            // 959
  // insecurePort as a global configuration parameter -- we assume                       // 960
  // that if the proxy wants us to ask for 8080 to get port 80 traffic                   // 961
  // on our default hostname, that's the same port that we would use                     // 962
  // to get traffic on some other hostname that our proxy listens                        // 963
  // for. Likewise, we assume that if the proxy can receive secure                       // 964
  // traffic for our domain, it can assume secure traffic for any                        // 965
  // domain! Hopefully this will get cleaned up before too long by                       // 966
  // pushing that logic into the proxy service, so we can just ask for                   // 967
  // port 80.                                                                            // 968
                                                                                         // 969
  // XXX BUG: if our configuration changes, and bindPathPrefix                           // 970
  // changes, it appears that we will not remove the routes derived                      // 971
  // from the old bindPathPrefix from the proxy (until the process                       // 972
  // exits). It is not actually normal for bindPathPrefix to change,                     // 973
  // certainly not without a process restart for other reasons, but                      // 974
  // it'd be nice to fix.                                                                // 975
                                                                                         // 976
  _.each(routes, function (route) {                                                      // 977
    var parsedUrl = url.parse(route.url, /* parseQueryString */ false,                   // 978
                              /* slashesDenoteHost aka workRight */ true);               // 979
    if (parsedUrl.protocol || parsedUrl.port || parsedUrl.search)                        // 980
      throw new Error("Bad url");                                                        // 981
    parsedUrl.host = null;                                                               // 982
    parsedUrl.path = null;                                                               // 983
    if (! parsedUrl.hostname) {                                                          // 984
      parsedUrl.hostname = proxyConfig.bindHost;                                         // 985
      if (! parsedUrl.pathname)                                                          // 986
        parsedUrl.pathname = "";                                                         // 987
      if (! parsedUrl.pathname.indexOf("/") !== 0) {                                     // 988
        // Relative path                                                                 // 989
        parsedUrl.pathname = bindPathPrefix + parsedUrl.pathname;                        // 990
      }                                                                                  // 991
    }                                                                                    // 992
    var version = "";                                                                    // 993
                                                                                         // 994
    var AppConfig = Package["application-configuration"].AppConfig;                      // 995
    version = AppConfig.getStarForThisJob() || "";                                       // 996
                                                                                         // 997
                                                                                         // 998
    var parsedDdpUrl = _.clone(parsedUrl);                                               // 999
    parsedDdpUrl.protocol = "ddp";                                                       // 1000
    // Node has a hardcoded list of protocols that get '://' instead                     // 1001
    // of ':'. ddp needs to be added to that whitelist. Until then, we                   // 1002
    // can set the undocumented attribute 'slashes' to get the right                     // 1003
    // behavior. It's not clear whether than is by design or accident.                   // 1004
    parsedDdpUrl.slashes = true;                                                         // 1005
    parsedDdpUrl.port = '' + securePort;                                                 // 1006
    var ddpUrl = url.format(parsedDdpUrl);                                               // 1007
                                                                                         // 1008
    var proxyToHost, proxyToPort, proxyToPathPrefix;                                     // 1009
    if (! _.has(route, 'forwardTo')) {                                                   // 1010
      proxyToHost = ourHost;                                                             // 1011
      proxyToPort = ourPort;                                                             // 1012
      proxyToPathPrefix = parsedUrl.pathname;                                            // 1013
    } else {                                                                             // 1014
      var parsedFwdUrl = url.parse(route.forwardTo, false, true);                        // 1015
      if (! parsedFwdUrl.hostname || parsedFwdUrl.protocol)                              // 1016
        throw new Error("Bad forward url");                                              // 1017
      proxyToHost = parsedFwdUrl.hostname;                                               // 1018
      proxyToPort = parseInt(parsedFwdUrl.port || "80");                                 // 1019
      proxyToPathPrefix = parsedFwdUrl.pathname || "";                                   // 1020
    }                                                                                    // 1021
                                                                                         // 1022
    if (route.ddp) {                                                                     // 1023
      proxy.call('bindDdp', {                                                            // 1024
        pid: pid,                                                                        // 1025
        bindTo: {                                                                        // 1026
          ddpUrl: ddpUrl,                                                                // 1027
          insecurePort: insecurePort                                                     // 1028
        },                                                                               // 1029
        proxyTo: {                                                                       // 1030
          tags: [version],                                                               // 1031
          host: proxyToHost,                                                             // 1032
          port: proxyToPort,                                                             // 1033
          pathPrefix: proxyToPathPrefix + '/websocket'                                   // 1034
        },                                                                               // 1035
        requiresAuth: requiresDdpAuth                                                    // 1036
      }, makeCallback());                                                                // 1037
    }                                                                                    // 1038
                                                                                         // 1039
    if (route.http) {                                                                    // 1040
      proxy.call('bindHttp', {                                                           // 1041
        pid: pid,                                                                        // 1042
        bindTo: {                                                                        // 1043
          host: parsedUrl.hostname,                                                      // 1044
          port: insecurePort,                                                            // 1045
          pathPrefix: parsedUrl.pathname                                                 // 1046
        },                                                                               // 1047
        proxyTo: {                                                                       // 1048
          tags: [version],                                                               // 1049
          host: proxyToHost,                                                             // 1050
          port: proxyToPort,                                                             // 1051
          pathPrefix: proxyToPathPrefix                                                  // 1052
        },                                                                               // 1053
        requiresAuth: requiresHttpAuth                                                   // 1054
      }, makeCallback());                                                                // 1055
                                                                                         // 1056
      // Only make the secure binding if we've been told that the                        // 1057
      // proxy knows how terminate secure connections for us (has an                     // 1058
      // appropriate cert, can bind the necessary port..)                                // 1059
      if (proxyConfig.securePort !== null) {                                             // 1060
        proxy.call('bindHttp', {                                                         // 1061
          pid: pid,                                                                      // 1062
          bindTo: {                                                                      // 1063
            host: parsedUrl.hostname,                                                    // 1064
            port: securePort,                                                            // 1065
            pathPrefix: parsedUrl.pathname,                                              // 1066
            ssl: true                                                                    // 1067
          },                                                                             // 1068
          proxyTo: {                                                                     // 1069
            tags: [version],                                                             // 1070
            host: proxyToHost,                                                           // 1071
            port: proxyToPort,                                                           // 1072
            pathPrefix: proxyToPathPrefix                                                // 1073
          },                                                                             // 1074
          requiresAuth: requiresHttpAuth                                                 // 1075
        }, makeCallback());                                                              // 1076
      }                                                                                  // 1077
    }                                                                                    // 1078
  });                                                                                    // 1079
                                                                                         // 1080
  startedAll = true;                                                                     // 1081
  checkComplete();                                                                       // 1082
};                                                                                       // 1083
                                                                                         // 1084
// (Internal, unsupported interface -- subject to change)                                // 1085
//                                                                                       // 1086
// Listen for HTTP and/or DDP traffic and route it somewhere. Only                       // 1087
// takes effect when using a proxy service.                                              // 1088
//                                                                                       // 1089
// 'url' is the traffic that we want to route, interpreted relative to                   // 1090
// the default URL where this app has been told to serve itself. It                      // 1091
// may not have a scheme or port, but it may have a host and a path,                     // 1092
// and if no host is provided the path need not be absolute. The                         // 1093
// following cases are possible:                                                         // 1094
//                                                                                       // 1095
//   //somehost.com                                                                      // 1096
//     All incoming traffic for 'somehost.com'                                           // 1097
//   //somehost.com/foo/bar                                                              // 1098
//     All incoming traffic for 'somehost.com', but only when                            // 1099
//     the first two path components are 'foo' and 'bar'.                                // 1100
//   /foo/bar                                                                            // 1101
//     Incoming traffic on our default host, but only when the                           // 1102
//     first two path components are 'foo' and 'bar'.                                    // 1103
//   foo/bar                                                                             // 1104
//     Incoming traffic on our default host, but only when the path                      // 1105
//     starts with our default path prefix, followed by 'foo' and                        // 1106
//     'bar'.                                                                            // 1107
//                                                                                       // 1108
// (Yes, these scheme-less URLs that start with '//' are legal URLs.)                    // 1109
//                                                                                       // 1110
// You can select either DDP traffic, HTTP traffic, or both. Both                        // 1111
// secure and insecure traffic will be gathered (assuming the proxy                      // 1112
// service is capable, eg, has appropriate certs and port mappings).                     // 1113
//                                                                                       // 1114
// With no 'forwardTo' option, the traffic is received by this process                   // 1115
// for service by the hooks in this 'webapp' package. The original URL                   // 1116
// is preserved (that is, if you bind "/a", and a user visits "/a/b",                    // 1117
// the app receives a request with a path of "/a/b", not a path of                       // 1118
// "/b").                                                                                // 1119
//                                                                                       // 1120
// With 'forwardTo', the process is instead sent to some other remote                    // 1121
// host. The URL is adjusted by stripping the path components in 'url'                   // 1122
// and putting the path components in the 'forwardTo' URL in their                       // 1123
// place. For example, if you forward "//somehost/a" to                                  // 1124
// "//otherhost/x", and the user types "//somehost/a/b" into their                       // 1125
// browser, then otherhost will receive a request with a Host header                     // 1126
// of "somehost" and a path of "/x/b".                                                   // 1127
//                                                                                       // 1128
// The routing continues until this process exits. For now, all of the                   // 1129
// routes must be set up ahead of time, before the initial                               // 1130
// registration with the proxy. Calling addRoute from the top level of                   // 1131
// your JS should do the trick.                                                          // 1132
//                                                                                       // 1133
// When multiple routes are present that match a given request, the                      // 1134
// most specific route wins. When routes with equal specificity are                      // 1135
// present, the proxy service will distribute the traffic between                        // 1136
// them.                                                                                 // 1137
//                                                                                       // 1138
// options may be:                                                                       // 1139
// - ddp: if true, the default, include DDP traffic. This includes                       // 1140
//   both secure and insecure traffic, and both websocket and sockjs                     // 1141
//   transports.                                                                         // 1142
// - http: if true, the default, include HTTP/HTTPS traffic.                             // 1143
// - forwardTo: if provided, should be a URL with a host, optional                       // 1144
//   path and port, and no scheme (the scheme will be derived from the                   // 1145
//   traffic type; for now it will always be a http or ws connection,                    // 1146
//   never https or wss, but we could add a forwardSecure flag to                        // 1147
//   re-encrypt).                                                                        // 1148
var routes = [];                                                                         // 1149
WebAppInternals.addRoute = function (url, options) {                                     // 1150
  options = _.extend({                                                                   // 1151
    ddp: true,                                                                           // 1152
    http: true                                                                           // 1153
  }, options || {});                                                                     // 1154
                                                                                         // 1155
  if (proxy)                                                                             // 1156
    // In the future, lift this restriction                                              // 1157
    throw new Error("Too late to add routes");                                           // 1158
                                                                                         // 1159
  routes.push(_.extend({ url: url }, options));                                          // 1160
};                                                                                       // 1161
                                                                                         // 1162
// Receive traffic on our default URL.                                                   // 1163
WebAppInternals.addRoute("");                                                            // 1164
                                                                                         // 1165
runWebAppServer();                                                                       // 1166
                                                                                         // 1167
                                                                                         // 1168
var inlineScriptsAllowed = true;                                                         // 1169
                                                                                         // 1170
WebAppInternals.inlineScriptsAllowed = function () {                                     // 1171
  return inlineScriptsAllowed;                                                           // 1172
};                                                                                       // 1173
                                                                                         // 1174
WebAppInternals.setInlineScriptsAllowed = function (value) {                             // 1175
  inlineScriptsAllowed = value;                                                          // 1176
  WebAppInternals.generateBoilerplate();                                                 // 1177
};                                                                                       // 1178
                                                                                         // 1179
WebAppInternals.setBundledJsCssPrefix = function (prefix) {                              // 1180
  bundledJsCssPrefix = prefix;                                                           // 1181
  WebAppInternals.generateBoilerplate();                                                 // 1182
};                                                                                       // 1183
                                                                                         // 1184
// Packages can call `WebAppInternals.addStaticJs` to specify static                     // 1185
// JavaScript to be included in the app. This static JS will be inlined,                 // 1186
// unless inline scripts have been disabled, in which case it will be                    // 1187
// served under `/<sha1 of contents>`.                                                   // 1188
var additionalStaticJs = {};                                                             // 1189
WebAppInternals.addStaticJs = function (contents) {                                      // 1190
  additionalStaticJs["/" + sha1(contents) + ".js"] = contents;                           // 1191
};                                                                                       // 1192
                                                                                         // 1193
// Exported for tests                                                                    // 1194
WebAppInternals.getBoilerplate = getBoilerplate;                                         // 1195
WebAppInternals.additionalStaticJs = additionalStaticJs;                                 // 1196
WebAppInternals.validPid = validPid;                                                     // 1197
                                                                                         // 1198
///////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package.webapp = {
  WebApp: WebApp,
  main: main,
  WebAppInternals: WebAppInternals
};

})();

//# sourceMappingURL=webapp.js.map
