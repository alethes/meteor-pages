(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var check = Package.check.check;
var Match = Package.check.Match;
var Random = Package.random.Random;
var EJSON = Package.ejson.EJSON;
var _ = Package.underscore._;
var Tracker = Package.tracker.Tracker;
var Deps = Package.tracker.Deps;
var Log = Package.logging.Log;
var Retry = Package.retry.Retry;
var Hook = Package['callback-hook'].Hook;
var LocalCollection = Package.minimongo.LocalCollection;
var Minimongo = Package.minimongo.Minimongo;

/* Package-scope variables */
var DDP, DDPServer, LivedataTest, toSockjsUrl, toWebsocketUrl, StreamServer, Heartbeat, Server, SUPPORTED_DDP_VERSIONS, MethodInvocation, parseDDP, stringifyDDP, RandomStream, makeRpcSeed, allConnections;

(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp/common.js                                                                                              //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
DDP = {};                                                                                                              // 1
LivedataTest = {};                                                                                                     // 2
                                                                                                                       // 3
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp/stream_client_nodejs.js                                                                                //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
// @param endpoint {String} URL to Meteor app                                                                          // 1
//   "http://subdomain.meteor.com/" or "/" or                                                                          // 2
//   "ddp+sockjs://foo-**.meteor.com/sockjs"                                                                           // 3
//                                                                                                                     // 4
// We do some rewriting of the URL to eventually make it "ws://" or "wss://",                                          // 5
// whatever was passed in.  At the very least, what Meteor.absoluteUrl() returns                                       // 6
// us should work.                                                                                                     // 7
//                                                                                                                     // 8
// We don't do any heartbeating. (The logic that did this in sockjs was removed,                                       // 9
// because it used a built-in sockjs mechanism. We could do it with WebSocket                                          // 10
// ping frames or with DDP-level messages.)                                                                            // 11
LivedataTest.ClientStream = function (endpoint, options) {                                                             // 12
  var self = this;                                                                                                     // 13
  options = options || {};                                                                                             // 14
                                                                                                                       // 15
  self.options = _.extend({                                                                                            // 16
    retry: true                                                                                                        // 17
  }, options);                                                                                                         // 18
                                                                                                                       // 19
  self.client = null;  // created in _launchConnection                                                                 // 20
  self.endpoint = endpoint;                                                                                            // 21
                                                                                                                       // 22
  self.headers = self.options.headers || {};                                                                           // 23
                                                                                                                       // 24
  self._initCommon(self.options);                                                                                      // 25
                                                                                                                       // 26
  //// Kickoff!                                                                                                        // 27
  self._launchConnection();                                                                                            // 28
};                                                                                                                     // 29
                                                                                                                       // 30
_.extend(LivedataTest.ClientStream.prototype, {                                                                        // 31
                                                                                                                       // 32
  // data is a utf8 string. Data sent while not connected is dropped on                                                // 33
  // the floor, and it is up the user of this API to retransmit lost                                                   // 34
  // messages on 'reset'                                                                                               // 35
  send: function (data) {                                                                                              // 36
    var self = this;                                                                                                   // 37
    if (self.currentStatus.connected) {                                                                                // 38
      self.client.messages.write(data);                                                                                // 39
    }                                                                                                                  // 40
  },                                                                                                                   // 41
                                                                                                                       // 42
  // Changes where this connection points                                                                              // 43
  _changeUrl: function (url) {                                                                                         // 44
    var self = this;                                                                                                   // 45
    self.endpoint = url;                                                                                               // 46
  },                                                                                                                   // 47
                                                                                                                       // 48
  _onConnect: function (client) {                                                                                      // 49
    var self = this;                                                                                                   // 50
                                                                                                                       // 51
    if (client !== self.client) {                                                                                      // 52
      // This connection is not from the last call to _launchConnection.                                               // 53
      // But _launchConnection calls _cleanup which closes previous connections.                                       // 54
      // It's our belief that this stifles future 'open' events, but maybe                                             // 55
      // we are wrong?                                                                                                 // 56
      throw new Error("Got open from inactive client " + !!self.client);                                               // 57
    }                                                                                                                  // 58
                                                                                                                       // 59
    if (self._forcedToDisconnect) {                                                                                    // 60
      // We were asked to disconnect between trying to open the connection and                                         // 61
      // actually opening it. Let's just pretend this never happened.                                                  // 62
      self.client.close();                                                                                             // 63
      self.client = null;                                                                                              // 64
      return;                                                                                                          // 65
    }                                                                                                                  // 66
                                                                                                                       // 67
    if (self.currentStatus.connected) {                                                                                // 68
      // We already have a connection. It must have been the case that we                                              // 69
      // started two parallel connection attempts (because we wanted to                                                // 70
      // 'reconnect now' on a hanging connection and we had no way to cancel the                                       // 71
      // connection attempt.) But this shouldn't happen (similarly to the client                                       // 72
      // !== self.client check above).                                                                                 // 73
      throw new Error("Two parallel connections?");                                                                    // 74
    }                                                                                                                  // 75
                                                                                                                       // 76
    self._clearConnectionTimer();                                                                                      // 77
                                                                                                                       // 78
    // update status                                                                                                   // 79
    self.currentStatus.status = "connected";                                                                           // 80
    self.currentStatus.connected = true;                                                                               // 81
    self.currentStatus.retryCount = 0;                                                                                 // 82
    self.statusChanged();                                                                                              // 83
                                                                                                                       // 84
    // fire resets. This must come after status change so that clients                                                 // 85
    // can call send from within a reset callback.                                                                     // 86
    _.each(self.eventCallbacks.reset, function (callback) { callback(); });                                            // 87
  },                                                                                                                   // 88
                                                                                                                       // 89
  _cleanup: function (maybeError) {                                                                                    // 90
    var self = this;                                                                                                   // 91
                                                                                                                       // 92
    self._clearConnectionTimer();                                                                                      // 93
    if (self.client) {                                                                                                 // 94
      var client = self.client;                                                                                        // 95
      self.client = null;                                                                                              // 96
      client.close();                                                                                                  // 97
                                                                                                                       // 98
      _.each(self.eventCallbacks.disconnect, function (callback) {                                                     // 99
        callback(maybeError);                                                                                          // 100
      });                                                                                                              // 101
    }                                                                                                                  // 102
  },                                                                                                                   // 103
                                                                                                                       // 104
  _clearConnectionTimer: function () {                                                                                 // 105
    var self = this;                                                                                                   // 106
                                                                                                                       // 107
    if (self.connectionTimer) {                                                                                        // 108
      clearTimeout(self.connectionTimer);                                                                              // 109
      self.connectionTimer = null;                                                                                     // 110
    }                                                                                                                  // 111
  },                                                                                                                   // 112
                                                                                                                       // 113
  _launchConnection: function () {                                                                                     // 114
    var self = this;                                                                                                   // 115
    self._cleanup(); // cleanup the old socket, if there was one.                                                      // 116
                                                                                                                       // 117
    // Since server-to-server DDP is still an experimental feature, we only                                            // 118
    // require the module if we actually create a server-to-server                                                     // 119
    // connection.                                                                                                     // 120
    var websocketDriver = Npm.require('websocket-driver');                                                             // 121
                                                                                                                       // 122
    // We would like to specify 'ddp' as the subprotocol here. The npm module we                                       // 123
    // used to use as a client would fail the handshake if we ask for a                                                // 124
    // subprotocol and the server doesn't send one back (and sockjs doesn't).                                          // 125
    // Faye doesn't have that behavior; it's unclear from reading RFC 6455 if                                          // 126
    // Faye is erroneous or not.  So for now, we don't specify protocols.                                              // 127
    var wsUrl = toWebsocketUrl(self.endpoint);                                                                         // 128
    var client = self.client = websocketDriver.client(wsUrl);                                                          // 129
                                                                                                                       // 130
    self._clearConnectionTimer();                                                                                      // 131
    self.connectionTimer = Meteor.setTimeout(                                                                          // 132
      function () {                                                                                                    // 133
        self._lostConnection(                                                                                          // 134
          new DDP.ConnectionError("DDP connection timed out"));                                                        // 135
      },                                                                                                               // 136
      self.CONNECT_TIMEOUT);                                                                                           // 137
                                                                                                                       // 138
    var onConnect = function () {                                                                                      // 139
      client.start();                                                                                                  // 140
    };                                                                                                                 // 141
    var stream = self._createSocket(wsUrl, onConnect);                                                                 // 142
                                                                                                                       // 143
    if (!self.client) {                                                                                                // 144
      // We hit a connection timeout or other issue while yielding in                                                  // 145
      // _createSocket. Drop the connection.                                                                           // 146
      stream.end();                                                                                                    // 147
      return;                                                                                                          // 148
    }                                                                                                                  // 149
                                                                                                                       // 150
    _.each(self.headers, function (header, name) {                                                                     // 151
      client.setHeader(name, header);                                                                                  // 152
    });                                                                                                                // 153
                                                                                                                       // 154
    self.client.on('open', Meteor.bindEnvironment(function () {                                                        // 155
      return self._onConnect(client);                                                                                  // 156
    }, "stream connect callback"));                                                                                    // 157
                                                                                                                       // 158
    var clientOnIfCurrent = function (event, description, f) {                                                         // 159
      self.client.on(event, Meteor.bindEnvironment(function () {                                                       // 160
        // Ignore events from any connection we've already cleaned up.                                                 // 161
        if (client !== self.client)                                                                                    // 162
          return;                                                                                                      // 163
        f.apply(this, arguments);                                                                                      // 164
      }, description));                                                                                                // 165
    };                                                                                                                 // 166
                                                                                                                       // 167
    var finalize = Meteor.bindEnvironment(function () {                                                                // 168
      stream.end();                                                                                                    // 169
      if (client === self.client) {                                                                                    // 170
        self._lostConnection();                                                                                        // 171
      }                                                                                                                // 172
    }, "finalizing stream");                                                                                           // 173
                                                                                                                       // 174
    stream.on('end', finalize);                                                                                        // 175
    stream.on('close', finalize);                                                                                      // 176
    client.on('close', finalize);                                                                                      // 177
                                                                                                                       // 178
    var onError = function (message) {                                                                                 // 179
      if (!self.options._dontPrintErrors)                                                                              // 180
        Meteor._debug("driver error", message);                                                                        // 181
                                                                                                                       // 182
      // Faye's 'error' object is not a JS error (and among other things,                                              // 183
      // doesn't stringify well). Convert it to one.                                                                   // 184
      self._lostConnection(new DDP.ConnectionError(message));                                                          // 185
    };                                                                                                                 // 186
                                                                                                                       // 187
    clientOnIfCurrent('error', 'driver error callback', function (error) {                                             // 188
      onError(error.message);                                                                                          // 189
    });                                                                                                                // 190
                                                                                                                       // 191
    stream.on('error', Meteor.bindEnvironment(function (error) {                                                       // 192
      if (client === self.client) {                                                                                    // 193
        onError('Network error: ' + wsUrl + ': ' + error.message);                                                     // 194
      }                                                                                                                // 195
      stream.end();                                                                                                    // 196
    }));                                                                                                               // 197
                                                                                                                       // 198
    clientOnIfCurrent('message', 'stream message callback', function (message) {                                       // 199
      // Ignore binary frames, where data is a Buffer                                                                  // 200
      if (typeof message.data !== "string")                                                                            // 201
        return;                                                                                                        // 202
      _.each(self.eventCallbacks.message, function (callback) {                                                        // 203
        callback(message.data);                                                                                        // 204
      });                                                                                                              // 205
    });                                                                                                                // 206
                                                                                                                       // 207
    stream.pipe(self.client.io);                                                                                       // 208
    self.client.io.pipe(stream);                                                                                       // 209
  },                                                                                                                   // 210
                                                                                                                       // 211
  _createSocket: function (wsUrl, onConnect) {                                                                         // 212
    var self = this;                                                                                                   // 213
    var urlModule = Npm.require('url');                                                                                // 214
    var parsedTargetUrl = urlModule.parse(wsUrl);                                                                      // 215
    var targetUrlPort = +parsedTargetUrl.port;                                                                         // 216
    if (!targetUrlPort) {                                                                                              // 217
      targetUrlPort = parsedTargetUrl.protocol === 'wss:' ? 443 : 80;                                                  // 218
    }                                                                                                                  // 219
                                                                                                                       // 220
    // Corporate proxy tunneling support.                                                                              // 221
    var proxyUrl = self._getProxyUrl(parsedTargetUrl.protocol);                                                        // 222
    if (proxyUrl) {                                                                                                    // 223
      var targetProtocol =                                                                                             // 224
            (parsedTargetUrl.protocol === 'wss:' ? 'https' : 'http');                                                  // 225
      var parsedProxyUrl = urlModule.parse(proxyUrl);                                                                  // 226
      var proxyProtocol =                                                                                              // 227
            (parsedProxyUrl.protocol === 'https:' ? 'Https' : 'Http');                                                 // 228
      var proxyUrlPort = +parsedProxyUrl.port;                                                                         // 229
      if (!proxyUrlPort) {                                                                                             // 230
        proxyUrlPort = parsedProxyUrl.protocol === 'https:' ? 443 : 80;                                                // 231
      }                                                                                                                // 232
      var tunnelFnName = targetProtocol + 'Over' + proxyProtocol;                                                      // 233
      var tunnelAgent = Npm.require('tunnel-agent');                                                                   // 234
      var proxyOptions = {                                                                                             // 235
        host: parsedProxyUrl.hostname,                                                                                 // 236
        port: proxyUrlPort,                                                                                            // 237
        headers: {                                                                                                     // 238
          host: parsedTargetUrl.host + ':' + targetUrlPort                                                             // 239
        }                                                                                                              // 240
      };                                                                                                               // 241
      if (parsedProxyUrl.auth) {                                                                                       // 242
        proxyOptions.proxyAuth = Npm.require('querystring').unescape(                                                  // 243
          parsedProxyUrl.auth);                                                                                        // 244
      }                                                                                                                // 245
      var tunneler = tunnelAgent[tunnelFnName]({proxy: proxyOptions});                                                 // 246
      var events = Npm.require('events');                                                                              // 247
      var fakeRequest = new events.EventEmitter();                                                                     // 248
      var Future = Npm.require('fibers/future');                                                                       // 249
      var fut = new Future;                                                                                            // 250
      fakeRequest.on('error', function (e) {                                                                           // 251
        fut.isResolved() || fut.throw(e);                                                                              // 252
      });                                                                                                              // 253
      tunneler.createSocket({                                                                                          // 254
        host: parsedTargetUrl.host,                                                                                    // 255
        port: targetUrlPort,                                                                                           // 256
        request: fakeRequest                                                                                           // 257
      }, function (socket) {                                                                                           // 258
        socket.on('close', function () {                                                                               // 259
          tunneler.removeSocket(socket);                                                                               // 260
        });                                                                                                            // 261
        process.nextTick(onConnect);                                                                                   // 262
        fut.return(socket);                                                                                            // 263
      });                                                                                                              // 264
      return fut.wait();                                                                                               // 265
    }                                                                                                                  // 266
                                                                                                                       // 267
    if (parsedTargetUrl.protocol === 'wss:') {                                                                         // 268
      return Npm.require('tls').connect(                                                                               // 269
        targetUrlPort, parsedTargetUrl.hostname, onConnect);                                                           // 270
    } else {                                                                                                           // 271
      var stream = Npm.require('net').createConnection(                                                                // 272
        targetUrlPort, parsedTargetUrl.hostname);                                                                      // 273
      stream.on('connect', onConnect);                                                                                 // 274
      return stream;                                                                                                   // 275
    }                                                                                                                  // 276
  },                                                                                                                   // 277
                                                                                                                       // 278
  _getProxyUrl: function (protocol) {                                                                                  // 279
    var self = this;                                                                                                   // 280
    // Similar to code in tools/http-helpers.js.                                                                       // 281
    var proxy = process.env.HTTP_PROXY || process.env.http_proxy || null;                                              // 282
    // if we're going to a secure url, try the https_proxy env variable first.                                         // 283
    if (protocol === 'wss:') {                                                                                         // 284
      proxy = process.env.HTTPS_PROXY || process.env.https_proxy || proxy;                                             // 285
    }                                                                                                                  // 286
    return proxy;                                                                                                      // 287
  }                                                                                                                    // 288
});                                                                                                                    // 289
                                                                                                                       // 290
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp/stream_client_common.js                                                                                //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
// XXX from Underscore.String (http://epeli.github.com/underscore.string/)                                             // 1
var startsWith = function(str, starts) {                                                                               // 2
  return str.length >= starts.length &&                                                                                // 3
    str.substring(0, starts.length) === starts;                                                                        // 4
};                                                                                                                     // 5
var endsWith = function(str, ends) {                                                                                   // 6
  return str.length >= ends.length &&                                                                                  // 7
    str.substring(str.length - ends.length) === ends;                                                                  // 8
};                                                                                                                     // 9
                                                                                                                       // 10
// @param url {String} URL to Meteor app, eg:                                                                          // 11
//   "/" or "madewith.meteor.com" or "https://foo.meteor.com"                                                          // 12
//   or "ddp+sockjs://ddp--****-foo.meteor.com/sockjs"                                                                 // 13
// @returns {String} URL to the endpoint with the specific scheme and subPath, e.g.                                    // 14
// for scheme "http" and subPath "sockjs"                                                                              // 15
//   "http://subdomain.meteor.com/sockjs" or "/sockjs"                                                                 // 16
//   or "https://ddp--1234-foo.meteor.com/sockjs"                                                                      // 17
var translateUrl =  function(url, newSchemeBase, subPath) {                                                            // 18
  if (! newSchemeBase) {                                                                                               // 19
    newSchemeBase = "http";                                                                                            // 20
  }                                                                                                                    // 21
                                                                                                                       // 22
  var ddpUrlMatch = url.match(/^ddp(i?)\+sockjs:\/\//);                                                                // 23
  var httpUrlMatch = url.match(/^http(s?):\/\//);                                                                      // 24
  var newScheme;                                                                                                       // 25
  if (ddpUrlMatch) {                                                                                                   // 26
    // Remove scheme and split off the host.                                                                           // 27
    var urlAfterDDP = url.substr(ddpUrlMatch[0].length);                                                               // 28
    newScheme = ddpUrlMatch[1] === "i" ? newSchemeBase : newSchemeBase + "s";                                          // 29
    var slashPos = urlAfterDDP.indexOf('/');                                                                           // 30
    var host =                                                                                                         // 31
          slashPos === -1 ? urlAfterDDP : urlAfterDDP.substr(0, slashPos);                                             // 32
    var rest = slashPos === -1 ? '' : urlAfterDDP.substr(slashPos);                                                    // 33
                                                                                                                       // 34
    // In the host (ONLY!), change '*' characters into random digits. This                                             // 35
    // allows different stream connections to connect to different hostnames                                           // 36
    // and avoid browser per-hostname connection limits.                                                               // 37
    host = host.replace(/\*/g, function () {                                                                           // 38
      return Math.floor(Random.fraction()*10);                                                                         // 39
    });                                                                                                                // 40
                                                                                                                       // 41
    return newScheme + '://' + host + rest;                                                                            // 42
  } else if (httpUrlMatch) {                                                                                           // 43
    newScheme = !httpUrlMatch[1] ? newSchemeBase : newSchemeBase + "s";                                                // 44
    var urlAfterHttp = url.substr(httpUrlMatch[0].length);                                                             // 45
    url = newScheme + "://" + urlAfterHttp;                                                                            // 46
  }                                                                                                                    // 47
                                                                                                                       // 48
  // Prefix FQDNs but not relative URLs                                                                                // 49
  if (url.indexOf("://") === -1 && !startsWith(url, "/")) {                                                            // 50
    url = newSchemeBase + "://" + url;                                                                                 // 51
  }                                                                                                                    // 52
                                                                                                                       // 53
  // XXX This is not what we should be doing: if I have a site                                                         // 54
  // deployed at "/foo", then DDP.connect("/") should actually connect                                                 // 55
  // to "/", not to "/foo". "/" is an absolute path. (Contrast: if                                                     // 56
  // deployed at "/foo", it would be reasonable for DDP.connect("bar")                                                 // 57
  // to connect to "/foo/bar").                                                                                        // 58
  //                                                                                                                   // 59
  // We should make this properly honor absolute paths rather than                                                     // 60
  // forcing the path to be relative to the site root. Simultaneously,                                                 // 61
  // we should set DDP_DEFAULT_CONNECTION_URL to include the site                                                      // 62
  // root. See also client_convenience.js #RationalizingRelativeDDPURLs                                                // 63
  url = Meteor._relativeToSiteRootUrl(url);                                                                            // 64
                                                                                                                       // 65
  if (endsWith(url, "/"))                                                                                              // 66
    return url + subPath;                                                                                              // 67
  else                                                                                                                 // 68
    return url + "/" + subPath;                                                                                        // 69
};                                                                                                                     // 70
                                                                                                                       // 71
toSockjsUrl = function (url) {                                                                                         // 72
  return translateUrl(url, "http", "sockjs");                                                                          // 73
};                                                                                                                     // 74
                                                                                                                       // 75
toWebsocketUrl = function (url) {                                                                                      // 76
  var ret = translateUrl(url, "ws", "websocket");                                                                      // 77
  return ret;                                                                                                          // 78
};                                                                                                                     // 79
                                                                                                                       // 80
LivedataTest.toSockjsUrl = toSockjsUrl;                                                                                // 81
                                                                                                                       // 82
                                                                                                                       // 83
_.extend(LivedataTest.ClientStream.prototype, {                                                                        // 84
                                                                                                                       // 85
  // Register for callbacks.                                                                                           // 86
  on: function (name, callback) {                                                                                      // 87
    var self = this;                                                                                                   // 88
                                                                                                                       // 89
    if (name !== 'message' && name !== 'reset' && name !== 'disconnect')                                               // 90
      throw new Error("unknown event type: " + name);                                                                  // 91
                                                                                                                       // 92
    if (!self.eventCallbacks[name])                                                                                    // 93
      self.eventCallbacks[name] = [];                                                                                  // 94
    self.eventCallbacks[name].push(callback);                                                                          // 95
  },                                                                                                                   // 96
                                                                                                                       // 97
                                                                                                                       // 98
  _initCommon: function (options) {                                                                                    // 99
    var self = this;                                                                                                   // 100
    options = options || {};                                                                                           // 101
                                                                                                                       // 102
    //// Constants                                                                                                     // 103
                                                                                                                       // 104
    // how long to wait until we declare the connection attempt                                                        // 105
    // failed.                                                                                                         // 106
    self.CONNECT_TIMEOUT = options.connectTimeoutMs || 10000;                                                          // 107
                                                                                                                       // 108
    self.eventCallbacks = {}; // name -> [callback]                                                                    // 109
                                                                                                                       // 110
    self._forcedToDisconnect = false;                                                                                  // 111
                                                                                                                       // 112
    //// Reactive status                                                                                               // 113
    self.currentStatus = {                                                                                             // 114
      status: "connecting",                                                                                            // 115
      connected: false,                                                                                                // 116
      retryCount: 0                                                                                                    // 117
    };                                                                                                                 // 118
                                                                                                                       // 119
                                                                                                                       // 120
    self.statusListeners = typeof Tracker !== 'undefined' && new Tracker.Dependency;                                   // 121
    self.statusChanged = function () {                                                                                 // 122
      if (self.statusListeners)                                                                                        // 123
        self.statusListeners.changed();                                                                                // 124
    };                                                                                                                 // 125
                                                                                                                       // 126
    //// Retry logic                                                                                                   // 127
    self._retry = new Retry;                                                                                           // 128
    self.connectionTimer = null;                                                                                       // 129
                                                                                                                       // 130
  },                                                                                                                   // 131
                                                                                                                       // 132
  // Trigger a reconnect.                                                                                              // 133
  reconnect: function (options) {                                                                                      // 134
    var self = this;                                                                                                   // 135
    options = options || {};                                                                                           // 136
                                                                                                                       // 137
    if (options.url) {                                                                                                 // 138
      self._changeUrl(options.url);                                                                                    // 139
    }                                                                                                                  // 140
                                                                                                                       // 141
    if (options._sockjsOptions) {                                                                                      // 142
      self.options._sockjsOptions = options._sockjsOptions;                                                            // 143
    }                                                                                                                  // 144
                                                                                                                       // 145
    if (self.currentStatus.connected) {                                                                                // 146
      if (options._force || options.url) {                                                                             // 147
        // force reconnect.                                                                                            // 148
        self._lostConnection(new DDP.ForcedReconnectError);                                                            // 149
      } // else, noop.                                                                                                 // 150
      return;                                                                                                          // 151
    }                                                                                                                  // 152
                                                                                                                       // 153
    // if we're mid-connection, stop it.                                                                               // 154
    if (self.currentStatus.status === "connecting") {                                                                  // 155
      self._lostConnection();                                                                                          // 156
    }                                                                                                                  // 157
                                                                                                                       // 158
    self._retry.clear();                                                                                               // 159
    self.currentStatus.retryCount -= 1; // don't count manual retries                                                  // 160
    self._retryNow();                                                                                                  // 161
  },                                                                                                                   // 162
                                                                                                                       // 163
  disconnect: function (options) {                                                                                     // 164
    var self = this;                                                                                                   // 165
    options = options || {};                                                                                           // 166
                                                                                                                       // 167
    // Failed is permanent. If we're failed, don't let people go back                                                  // 168
    // online by calling 'disconnect' then 'reconnect'.                                                                // 169
    if (self._forcedToDisconnect)                                                                                      // 170
      return;                                                                                                          // 171
                                                                                                                       // 172
    // If _permanent is set, permanently disconnect a stream. Once a stream                                            // 173
    // is forced to disconnect, it can never reconnect. This is for                                                    // 174
    // error cases such as ddp version mismatch, where trying again                                                    // 175
    // won't fix the problem.                                                                                          // 176
    if (options._permanent) {                                                                                          // 177
      self._forcedToDisconnect = true;                                                                                 // 178
    }                                                                                                                  // 179
                                                                                                                       // 180
    self._cleanup();                                                                                                   // 181
    self._retry.clear();                                                                                               // 182
                                                                                                                       // 183
    self.currentStatus = {                                                                                             // 184
      status: (options._permanent ? "failed" : "offline"),                                                             // 185
      connected: false,                                                                                                // 186
      retryCount: 0                                                                                                    // 187
    };                                                                                                                 // 188
                                                                                                                       // 189
    if (options._permanent && options._error)                                                                          // 190
      self.currentStatus.reason = options._error;                                                                      // 191
                                                                                                                       // 192
    self.statusChanged();                                                                                              // 193
  },                                                                                                                   // 194
                                                                                                                       // 195
  // maybeError is only guaranteed to be set for the Node implementation, and                                          // 196
  // not on a clean close.                                                                                             // 197
  _lostConnection: function (maybeError) {                                                                             // 198
    var self = this;                                                                                                   // 199
                                                                                                                       // 200
    self._cleanup(maybeError);                                                                                         // 201
    self._retryLater(maybeError); // sets status. no need to do it here.                                               // 202
  },                                                                                                                   // 203
                                                                                                                       // 204
  // fired when we detect that we've gone online. try to reconnect                                                     // 205
  // immediately.                                                                                                      // 206
  _online: function () {                                                                                               // 207
    // if we've requested to be offline by disconnecting, don't reconnect.                                             // 208
    if (this.currentStatus.status != "offline")                                                                        // 209
      this.reconnect();                                                                                                // 210
  },                                                                                                                   // 211
                                                                                                                       // 212
  _retryLater: function (maybeError) {                                                                                 // 213
    var self = this;                                                                                                   // 214
                                                                                                                       // 215
    var timeout = 0;                                                                                                   // 216
    if (self.options.retry ||                                                                                          // 217
        (maybeError && maybeError.errorType === "DDP.ForcedReconnectError")) {                                         // 218
      timeout = self._retry.retryLater(                                                                                // 219
        self.currentStatus.retryCount,                                                                                 // 220
        _.bind(self._retryNow, self)                                                                                   // 221
      );                                                                                                               // 222
      self.currentStatus.status = "waiting";                                                                           // 223
      self.currentStatus.retryTime = (new Date()).getTime() + timeout;                                                 // 224
    } else {                                                                                                           // 225
      self.currentStatus.status = "failed";                                                                            // 226
      delete self.currentStatus.retryTime;                                                                             // 227
    }                                                                                                                  // 228
                                                                                                                       // 229
    self.currentStatus.connected = false;                                                                              // 230
    self.statusChanged();                                                                                              // 231
  },                                                                                                                   // 232
                                                                                                                       // 233
  _retryNow: function () {                                                                                             // 234
    var self = this;                                                                                                   // 235
                                                                                                                       // 236
    if (self._forcedToDisconnect)                                                                                      // 237
      return;                                                                                                          // 238
                                                                                                                       // 239
    self.currentStatus.retryCount += 1;                                                                                // 240
    self.currentStatus.status = "connecting";                                                                          // 241
    self.currentStatus.connected = false;                                                                              // 242
    delete self.currentStatus.retryTime;                                                                               // 243
    self.statusChanged();                                                                                              // 244
                                                                                                                       // 245
    self._launchConnection();                                                                                          // 246
  },                                                                                                                   // 247
                                                                                                                       // 248
                                                                                                                       // 249
  // Get current status. Reactive.                                                                                     // 250
  status: function () {                                                                                                // 251
    var self = this;                                                                                                   // 252
    if (self.statusListeners)                                                                                          // 253
      self.statusListeners.depend();                                                                                   // 254
    return self.currentStatus;                                                                                         // 255
  }                                                                                                                    // 256
});                                                                                                                    // 257
                                                                                                                       // 258
DDP.ConnectionError = Meteor.makeErrorType(                                                                            // 259
  "DDP.ConnectionError", function (message) {                                                                          // 260
    var self = this;                                                                                                   // 261
    self.message = message;                                                                                            // 262
});                                                                                                                    // 263
                                                                                                                       // 264
DDP.ForcedReconnectError = Meteor.makeErrorType(                                                                       // 265
  "DDP.ForcedReconnectError", function () {});                                                                         // 266
                                                                                                                       // 267
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp/stream_server.js                                                                                       //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
var url = Npm.require('url');                                                                                          // 1
                                                                                                                       // 2
var pathPrefix = __meteor_runtime_config__.ROOT_URL_PATH_PREFIX ||  "";                                                // 3
                                                                                                                       // 4
StreamServer = function () {                                                                                           // 5
  var self = this;                                                                                                     // 6
  self.registration_callbacks = [];                                                                                    // 7
  self.open_sockets = [];                                                                                              // 8
                                                                                                                       // 9
  // Because we are installing directly onto WebApp.httpServer instead of using                                        // 10
  // WebApp.app, we have to process the path prefix ourselves.                                                         // 11
  self.prefix = pathPrefix + '/sockjs';                                                                                // 12
  // routepolicy is only a weak dependency, because we don't need it if we're                                          // 13
  // just doing server-to-server DDP as a client.                                                                      // 14
  if (Package.routepolicy) {                                                                                           // 15
    Package.routepolicy.RoutePolicy.declare(self.prefix + '/', 'network');                                             // 16
  }                                                                                                                    // 17
                                                                                                                       // 18
  // set up sockjs                                                                                                     // 19
  var sockjs = Npm.require('sockjs');                                                                                  // 20
  var serverOptions = {                                                                                                // 21
    prefix: self.prefix,                                                                                               // 22
    log: function() {},                                                                                                // 23
    // this is the default, but we code it explicitly because we depend                                                // 24
    // on it in stream_client:HEARTBEAT_TIMEOUT                                                                        // 25
    heartbeat_delay: 45000,                                                                                            // 26
    // The default disconnect_delay is 5 seconds, but if the server ends up CPU                                        // 27
    // bound for that much time, SockJS might not notice that the user has                                             // 28
    // reconnected because the timer (of disconnect_delay ms) can fire before                                          // 29
    // SockJS processes the new connection. Eventually we'll fix this by not                                           // 30
    // combining CPU-heavy processing with SockJS termination (eg a proxy which                                        // 31
    // converts to Unix sockets) but for now, raise the delay.                                                         // 32
    disconnect_delay: 60 * 1000,                                                                                       // 33
    // Set the USE_JSESSIONID environment variable to enable setting the                                               // 34
    // JSESSIONID cookie. This is useful for setting up proxies with                                                   // 35
    // session affinity.                                                                                               // 36
    jsessionid: !!process.env.USE_JSESSIONID                                                                           // 37
  };                                                                                                                   // 38
                                                                                                                       // 39
  // If you know your server environment (eg, proxies) will prevent websockets                                         // 40
  // from ever working, set $DISABLE_WEBSOCKETS and SockJS clients (ie,                                                // 41
  // browsers) will not waste time attempting to use them.                                                             // 42
  // (Your server will still have a /websocket endpoint.)                                                              // 43
  if (process.env.DISABLE_WEBSOCKETS)                                                                                  // 44
    serverOptions.websocket = false;                                                                                   // 45
                                                                                                                       // 46
  self.server = sockjs.createServer(serverOptions);                                                                    // 47
  if (!Package.webapp) {                                                                                               // 48
    throw new Error("Cannot create a DDP server without the webapp package");                                          // 49
  }                                                                                                                    // 50
  // Install the sockjs handlers, but we want to keep around our own particular                                        // 51
  // request handler that adjusts idle timeouts while we have an outstanding                                           // 52
  // request.  This compensates for the fact that sockjs removes all listeners                                         // 53
  // for "request" to add its own.                                                                                     // 54
  Package.webapp.WebApp.httpServer.removeListener('request', Package.webapp.WebApp._timeoutAdjustmentRequestCallback); // 55
  self.server.installHandlers(Package.webapp.WebApp.httpServer);                                                       // 56
  Package.webapp.WebApp.httpServer.addListener('request', Package.webapp.WebApp._timeoutAdjustmentRequestCallback);    // 57
                                                                                                                       // 58
  Package.webapp.WebApp.httpServer.on('meteor-closing', function () {                                                  // 59
    _.each(self.open_sockets, function (socket) {                                                                      // 60
      socket.end();                                                                                                    // 61
    });                                                                                                                // 62
  });                                                                                                                  // 63
                                                                                                                       // 64
  // Support the /websocket endpoint                                                                                   // 65
  self._redirectWebsocketEndpoint();                                                                                   // 66
                                                                                                                       // 67
  self.server.on('connection', function (socket) {                                                                     // 68
                                                                                                                       // 69
    if (Package.webapp.WebAppInternals.usingDdpProxy) {                                                                // 70
      // If we are behind a DDP proxy, immediately close any sockjs connections                                        // 71
      // that are not using websockets; the proxy will terminate sockjs for us,                                        // 72
      // so we don't expect to be handling any other transports.                                                       // 73
      if (socket.protocol !== "websocket" &&                                                                           // 74
          socket.protocol !== "websocket-raw") {                                                                       // 75
        socket.close();                                                                                                // 76
        return;                                                                                                        // 77
      }                                                                                                                // 78
    }                                                                                                                  // 79
                                                                                                                       // 80
    socket.send = function (data) {                                                                                    // 81
      socket.write(data);                                                                                              // 82
    };                                                                                                                 // 83
    socket.on('close', function () {                                                                                   // 84
      self.open_sockets = _.without(self.open_sockets, socket);                                                        // 85
    });                                                                                                                // 86
    self.open_sockets.push(socket);                                                                                    // 87
                                                                                                                       // 88
    // XXX COMPAT WITH 0.6.6. Send the old style welcome message, which                                                // 89
    // will force old clients to reload. Remove this once we're not                                                    // 90
    // concerned about people upgrading from a pre-0.7.0 release. Also,                                                // 91
    // remove the clause in the client that ignores the welcome message                                                // 92
    // (livedata_connection.js)                                                                                        // 93
    socket.send(JSON.stringify({server_id: "0"}));                                                                     // 94
                                                                                                                       // 95
    // call all our callbacks when we get a new socket. they will do the                                               // 96
    // work of setting up handlers and such for specific messages.                                                     // 97
    _.each(self.registration_callbacks, function (callback) {                                                          // 98
      callback(socket);                                                                                                // 99
    });                                                                                                                // 100
  });                                                                                                                  // 101
                                                                                                                       // 102
};                                                                                                                     // 103
                                                                                                                       // 104
_.extend(StreamServer.prototype, {                                                                                     // 105
  // call my callback when a new socket connects.                                                                      // 106
  // also call it for all current connections.                                                                         // 107
  register: function (callback) {                                                                                      // 108
    var self = this;                                                                                                   // 109
    self.registration_callbacks.push(callback);                                                                        // 110
    _.each(self.all_sockets(), function (socket) {                                                                     // 111
      callback(socket);                                                                                                // 112
    });                                                                                                                // 113
  },                                                                                                                   // 114
                                                                                                                       // 115
  // get a list of all sockets                                                                                         // 116
  all_sockets: function () {                                                                                           // 117
    var self = this;                                                                                                   // 118
    return _.values(self.open_sockets);                                                                                // 119
  },                                                                                                                   // 120
                                                                                                                       // 121
  // Redirect /websocket to /sockjs/websocket in order to not expose                                                   // 122
  // sockjs to clients that want to use raw websockets                                                                 // 123
  _redirectWebsocketEndpoint: function() {                                                                             // 124
    var self = this;                                                                                                   // 125
    // Unfortunately we can't use a connect middleware here since                                                      // 126
    // sockjs installs itself prior to all existing listeners                                                          // 127
    // (meaning prior to any connect middlewares) so we need to take                                                   // 128
    // an approach similar to overshadowListeners in                                                                   // 129
    // https://github.com/sockjs/sockjs-node/blob/cf820c55af6a9953e16558555a31decea554f70e/src/utils.coffee            // 130
    _.each(['request', 'upgrade'], function(event) {                                                                   // 131
      var httpServer = Package.webapp.WebApp.httpServer;                                                               // 132
      var oldHttpServerListeners = httpServer.listeners(event).slice(0);                                               // 133
      httpServer.removeAllListeners(event);                                                                            // 134
                                                                                                                       // 135
      // request and upgrade have different arguments passed but                                                       // 136
      // we only care about the first one which is always request                                                      // 137
      var newListener = function(request /*, moreArguments */) {                                                       // 138
        // Store arguments for use within the closure below                                                            // 139
        var args = arguments;                                                                                          // 140
                                                                                                                       // 141
        // Rewrite /websocket and /websocket/ urls to /sockjs/websocket while                                          // 142
        // preserving query string.                                                                                    // 143
        var parsedUrl = url.parse(request.url);                                                                        // 144
        if (parsedUrl.pathname === pathPrefix + '/websocket' ||                                                        // 145
            parsedUrl.pathname === pathPrefix + '/websocket/') {                                                       // 146
          parsedUrl.pathname = self.prefix + '/websocket';                                                             // 147
          request.url = url.format(parsedUrl);                                                                         // 148
        }                                                                                                              // 149
        _.each(oldHttpServerListeners, function(oldListener) {                                                         // 150
          oldListener.apply(httpServer, args);                                                                         // 151
        });                                                                                                            // 152
      };                                                                                                               // 153
      httpServer.addListener(event, newListener);                                                                      // 154
    });                                                                                                                // 155
  }                                                                                                                    // 156
});                                                                                                                    // 157
                                                                                                                       // 158
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp/heartbeat.js                                                                                           //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
// Heartbeat options:                                                                                                  // 1
//   heartbeatInterval: interval to send pings, in milliseconds.                                                       // 2
//   heartbeatTimeout: timeout to close the connection if a reply isn't                                                // 3
//     received, in milliseconds.                                                                                      // 4
//   sendPing: function to call to send a ping on the connection.                                                      // 5
//   onTimeout: function to call to close the connection.                                                              // 6
                                                                                                                       // 7
Heartbeat = function (options) {                                                                                       // 8
  var self = this;                                                                                                     // 9
                                                                                                                       // 10
  self.heartbeatInterval = options.heartbeatInterval;                                                                  // 11
  self.heartbeatTimeout = options.heartbeatTimeout;                                                                    // 12
  self._sendPing = options.sendPing;                                                                                   // 13
  self._onTimeout = options.onTimeout;                                                                                 // 14
                                                                                                                       // 15
  self._heartbeatIntervalHandle = null;                                                                                // 16
  self._heartbeatTimeoutHandle = null;                                                                                 // 17
};                                                                                                                     // 18
                                                                                                                       // 19
_.extend(Heartbeat.prototype, {                                                                                        // 20
  stop: function () {                                                                                                  // 21
    var self = this;                                                                                                   // 22
    self._clearHeartbeatIntervalTimer();                                                                               // 23
    self._clearHeartbeatTimeoutTimer();                                                                                // 24
  },                                                                                                                   // 25
                                                                                                                       // 26
  start: function () {                                                                                                 // 27
    var self = this;                                                                                                   // 28
    self.stop();                                                                                                       // 29
    self._startHeartbeatIntervalTimer();                                                                               // 30
  },                                                                                                                   // 31
                                                                                                                       // 32
  _startHeartbeatIntervalTimer: function () {                                                                          // 33
    var self = this;                                                                                                   // 34
    self._heartbeatIntervalHandle = Meteor.setTimeout(                                                                 // 35
      _.bind(self._heartbeatIntervalFired, self),                                                                      // 36
      self.heartbeatInterval                                                                                           // 37
    );                                                                                                                 // 38
  },                                                                                                                   // 39
                                                                                                                       // 40
  _startHeartbeatTimeoutTimer: function () {                                                                           // 41
    var self = this;                                                                                                   // 42
    self._heartbeatTimeoutHandle = Meteor.setTimeout(                                                                  // 43
      _.bind(self._heartbeatTimeoutFired, self),                                                                       // 44
      self.heartbeatTimeout                                                                                            // 45
    );                                                                                                                 // 46
  },                                                                                                                   // 47
                                                                                                                       // 48
  _clearHeartbeatIntervalTimer: function () {                                                                          // 49
    var self = this;                                                                                                   // 50
    if (self._heartbeatIntervalHandle) {                                                                               // 51
      Meteor.clearTimeout(self._heartbeatIntervalHandle);                                                              // 52
      self._heartbeatIntervalHandle = null;                                                                            // 53
    }                                                                                                                  // 54
  },                                                                                                                   // 55
                                                                                                                       // 56
  _clearHeartbeatTimeoutTimer: function () {                                                                           // 57
    var self = this;                                                                                                   // 58
    if (self._heartbeatTimeoutHandle) {                                                                                // 59
      Meteor.clearTimeout(self._heartbeatTimeoutHandle);                                                               // 60
      self._heartbeatTimeoutHandle = null;                                                                             // 61
    }                                                                                                                  // 62
  },                                                                                                                   // 63
                                                                                                                       // 64
  // The heartbeat interval timer is fired when we should send a ping.                                                 // 65
  _heartbeatIntervalFired: function () {                                                                               // 66
    var self = this;                                                                                                   // 67
    self._heartbeatIntervalHandle = null;                                                                              // 68
    self._sendPing();                                                                                                  // 69
    // Wait for a pong.                                                                                                // 70
    self._startHeartbeatTimeoutTimer();                                                                                // 71
  },                                                                                                                   // 72
                                                                                                                       // 73
  // The heartbeat timeout timer is fired when we sent a ping, but we                                                  // 74
  // timed out waiting for the pong.                                                                                   // 75
  _heartbeatTimeoutFired: function () {                                                                                // 76
    var self = this;                                                                                                   // 77
    self._heartbeatTimeoutHandle = null;                                                                               // 78
    self._onTimeout();                                                                                                 // 79
  },                                                                                                                   // 80
                                                                                                                       // 81
  pingReceived: function () {                                                                                          // 82
    var self = this;                                                                                                   // 83
    // We know the connection is alive if we receive a ping, so we                                                     // 84
    // don't need to send a ping ourselves.  Reset the interval timer.                                                 // 85
    if (self._heartbeatIntervalHandle) {                                                                               // 86
      self._clearHeartbeatIntervalTimer();                                                                             // 87
      self._startHeartbeatIntervalTimer();                                                                             // 88
    }                                                                                                                  // 89
  },                                                                                                                   // 90
                                                                                                                       // 91
  pongReceived: function () {                                                                                          // 92
    var self = this;                                                                                                   // 93
                                                                                                                       // 94
    // Receiving a pong means we won't timeout, so clear the timeout                                                   // 95
    // timer and start the interval again.                                                                             // 96
    if (self._heartbeatTimeoutHandle) {                                                                                // 97
      self._clearHeartbeatTimeoutTimer();                                                                              // 98
      self._startHeartbeatIntervalTimer();                                                                             // 99
    }                                                                                                                  // 100
  }                                                                                                                    // 101
});                                                                                                                    // 102
                                                                                                                       // 103
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp/livedata_server.js                                                                                     //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
DDPServer = {};                                                                                                        // 1
                                                                                                                       // 2
var Fiber = Npm.require('fibers');                                                                                     // 3
                                                                                                                       // 4
// This file contains classes:                                                                                         // 5
// * Session - The server's connection to a single DDP client                                                          // 6
// * Subscription - A single subscription for a single client                                                          // 7
// * Server - An entire server that may talk to > 1 client. A DDP endpoint.                                            // 8
//                                                                                                                     // 9
// Session and Subscription are file scope. For now, until we freeze                                                   // 10
// the interface, Server is package scope (in the future it should be                                                  // 11
// exported.)                                                                                                          // 12
                                                                                                                       // 13
// Represents a single document in a SessionCollectionView                                                             // 14
var SessionDocumentView = function () {                                                                                // 15
  var self = this;                                                                                                     // 16
  self.existsIn = {}; // set of subscriptionHandle                                                                     // 17
  self.dataByKey = {}; // key-> [ {subscriptionHandle, value} by precedence]                                           // 18
};                                                                                                                     // 19
                                                                                                                       // 20
_.extend(SessionDocumentView.prototype, {                                                                              // 21
                                                                                                                       // 22
  getFields: function () {                                                                                             // 23
    var self = this;                                                                                                   // 24
    var ret = {};                                                                                                      // 25
    _.each(self.dataByKey, function (precedenceList, key) {                                                            // 26
      ret[key] = precedenceList[0].value;                                                                              // 27
    });                                                                                                                // 28
    return ret;                                                                                                        // 29
  },                                                                                                                   // 30
                                                                                                                       // 31
  clearField: function (subscriptionHandle, key, changeCollector) {                                                    // 32
    var self = this;                                                                                                   // 33
    // Publish API ignores _id if present in fields                                                                    // 34
    if (key === "_id")                                                                                                 // 35
      return;                                                                                                          // 36
    var precedenceList = self.dataByKey[key];                                                                          // 37
                                                                                                                       // 38
    // It's okay to clear fields that didn't exist. No need to throw                                                   // 39
    // an error.                                                                                                       // 40
    if (!precedenceList)                                                                                               // 41
      return;                                                                                                          // 42
                                                                                                                       // 43
    var removedValue = undefined;                                                                                      // 44
    for (var i = 0; i < precedenceList.length; i++) {                                                                  // 45
      var precedence = precedenceList[i];                                                                              // 46
      if (precedence.subscriptionHandle === subscriptionHandle) {                                                      // 47
        // The view's value can only change if this subscription is the one that                                       // 48
        // used to have precedence.                                                                                    // 49
        if (i === 0)                                                                                                   // 50
          removedValue = precedence.value;                                                                             // 51
        precedenceList.splice(i, 1);                                                                                   // 52
        break;                                                                                                         // 53
      }                                                                                                                // 54
    }                                                                                                                  // 55
    if (_.isEmpty(precedenceList)) {                                                                                   // 56
      delete self.dataByKey[key];                                                                                      // 57
      changeCollector[key] = undefined;                                                                                // 58
    } else if (removedValue !== undefined &&                                                                           // 59
               !EJSON.equals(removedValue, precedenceList[0].value)) {                                                 // 60
      changeCollector[key] = precedenceList[0].value;                                                                  // 61
    }                                                                                                                  // 62
  },                                                                                                                   // 63
                                                                                                                       // 64
  changeField: function (subscriptionHandle, key, value,                                                               // 65
                         changeCollector, isAdd) {                                                                     // 66
    var self = this;                                                                                                   // 67
    // Publish API ignores _id if present in fields                                                                    // 68
    if (key === "_id")                                                                                                 // 69
      return;                                                                                                          // 70
                                                                                                                       // 71
    // Don't share state with the data passed in by the user.                                                          // 72
    value = EJSON.clone(value);                                                                                        // 73
                                                                                                                       // 74
    if (!_.has(self.dataByKey, key)) {                                                                                 // 75
      self.dataByKey[key] = [{subscriptionHandle: subscriptionHandle,                                                  // 76
                              value: value}];                                                                          // 77
      changeCollector[key] = value;                                                                                    // 78
      return;                                                                                                          // 79
    }                                                                                                                  // 80
    var precedenceList = self.dataByKey[key];                                                                          // 81
    var elt;                                                                                                           // 82
    if (!isAdd) {                                                                                                      // 83
      elt = _.find(precedenceList, function (precedence) {                                                             // 84
        return precedence.subscriptionHandle === subscriptionHandle;                                                   // 85
      });                                                                                                              // 86
    }                                                                                                                  // 87
                                                                                                                       // 88
    if (elt) {                                                                                                         // 89
      if (elt === precedenceList[0] && !EJSON.equals(value, elt.value)) {                                              // 90
        // this subscription is changing the value of this field.                                                      // 91
        changeCollector[key] = value;                                                                                  // 92
      }                                                                                                                // 93
      elt.value = value;                                                                                               // 94
    } else {                                                                                                           // 95
      // this subscription is newly caring about this field                                                            // 96
      precedenceList.push({subscriptionHandle: subscriptionHandle, value: value});                                     // 97
    }                                                                                                                  // 98
                                                                                                                       // 99
  }                                                                                                                    // 100
});                                                                                                                    // 101
                                                                                                                       // 102
/**                                                                                                                    // 103
 * Represents a client's view of a single collection                                                                   // 104
 * @param {String} collectionName Name of the collection it represents                                                 // 105
 * @param {Object.<String, Function>} sessionCallbacks The callbacks for added, changed, removed                       // 106
 * @class SessionCollectionView                                                                                        // 107
 */                                                                                                                    // 108
var SessionCollectionView = function (collectionName, sessionCallbacks) {                                              // 109
  var self = this;                                                                                                     // 110
  self.collectionName = collectionName;                                                                                // 111
  self.documents = {};                                                                                                 // 112
  self.callbacks = sessionCallbacks;                                                                                   // 113
};                                                                                                                     // 114
                                                                                                                       // 115
LivedataTest.SessionCollectionView = SessionCollectionView;                                                            // 116
                                                                                                                       // 117
                                                                                                                       // 118
_.extend(SessionCollectionView.prototype, {                                                                            // 119
                                                                                                                       // 120
  isEmpty: function () {                                                                                               // 121
    var self = this;                                                                                                   // 122
    return _.isEmpty(self.documents);                                                                                  // 123
  },                                                                                                                   // 124
                                                                                                                       // 125
  diff: function (previous) {                                                                                          // 126
    var self = this;                                                                                                   // 127
    LocalCollection._diffObjects(previous.documents, self.documents, {                                                 // 128
      both: _.bind(self.diffDocument, self),                                                                           // 129
                                                                                                                       // 130
      rightOnly: function (id, nowDV) {                                                                                // 131
        self.callbacks.added(self.collectionName, id, nowDV.getFields());                                              // 132
      },                                                                                                               // 133
                                                                                                                       // 134
      leftOnly: function (id, prevDV) {                                                                                // 135
        self.callbacks.removed(self.collectionName, id);                                                               // 136
      }                                                                                                                // 137
    });                                                                                                                // 138
  },                                                                                                                   // 139
                                                                                                                       // 140
  diffDocument: function (id, prevDV, nowDV) {                                                                         // 141
    var self = this;                                                                                                   // 142
    var fields = {};                                                                                                   // 143
    LocalCollection._diffObjects(prevDV.getFields(), nowDV.getFields(), {                                              // 144
      both: function (key, prev, now) {                                                                                // 145
        if (!EJSON.equals(prev, now))                                                                                  // 146
          fields[key] = now;                                                                                           // 147
      },                                                                                                               // 148
      rightOnly: function (key, now) {                                                                                 // 149
        fields[key] = now;                                                                                             // 150
      },                                                                                                               // 151
      leftOnly: function(key, prev) {                                                                                  // 152
        fields[key] = undefined;                                                                                       // 153
      }                                                                                                                // 154
    });                                                                                                                // 155
    self.callbacks.changed(self.collectionName, id, fields);                                                           // 156
  },                                                                                                                   // 157
                                                                                                                       // 158
  added: function (subscriptionHandle, id, fields) {                                                                   // 159
    var self = this;                                                                                                   // 160
    var docView = self.documents[id];                                                                                  // 161
    var added = false;                                                                                                 // 162
    if (!docView) {                                                                                                    // 163
      added = true;                                                                                                    // 164
      docView = new SessionDocumentView();                                                                             // 165
      self.documents[id] = docView;                                                                                    // 166
    }                                                                                                                  // 167
    docView.existsIn[subscriptionHandle] = true;                                                                       // 168
    var changeCollector = {};                                                                                          // 169
    _.each(fields, function (value, key) {                                                                             // 170
      docView.changeField(                                                                                             // 171
        subscriptionHandle, key, value, changeCollector, true);                                                        // 172
    });                                                                                                                // 173
    if (added)                                                                                                         // 174
      self.callbacks.added(self.collectionName, id, changeCollector);                                                  // 175
    else                                                                                                               // 176
      self.callbacks.changed(self.collectionName, id, changeCollector);                                                // 177
  },                                                                                                                   // 178
                                                                                                                       // 179
  changed: function (subscriptionHandle, id, changed) {                                                                // 180
    var self = this;                                                                                                   // 181
    var changedResult = {};                                                                                            // 182
    var docView = self.documents[id];                                                                                  // 183
    if (!docView)                                                                                                      // 184
      throw new Error("Could not find element with id " + id + " to change");                                          // 185
    _.each(changed, function (value, key) {                                                                            // 186
      if (value === undefined)                                                                                         // 187
        docView.clearField(subscriptionHandle, key, changedResult);                                                    // 188
      else                                                                                                             // 189
        docView.changeField(subscriptionHandle, key, value, changedResult);                                            // 190
    });                                                                                                                // 191
    self.callbacks.changed(self.collectionName, id, changedResult);                                                    // 192
  },                                                                                                                   // 193
                                                                                                                       // 194
  removed: function (subscriptionHandle, id) {                                                                         // 195
    var self = this;                                                                                                   // 196
    var docView = self.documents[id];                                                                                  // 197
    if (!docView) {                                                                                                    // 198
      var err = new Error("Removed nonexistent document " + id);                                                       // 199
      throw err;                                                                                                       // 200
    }                                                                                                                  // 201
    delete docView.existsIn[subscriptionHandle];                                                                       // 202
    if (_.isEmpty(docView.existsIn)) {                                                                                 // 203
      // it is gone from everyone                                                                                      // 204
      self.callbacks.removed(self.collectionName, id);                                                                 // 205
      delete self.documents[id];                                                                                       // 206
    } else {                                                                                                           // 207
      var changed = {};                                                                                                // 208
      // remove this subscription from every precedence list                                                           // 209
      // and record the changes                                                                                        // 210
      _.each(docView.dataByKey, function (precedenceList, key) {                                                       // 211
        docView.clearField(subscriptionHandle, key, changed);                                                          // 212
      });                                                                                                              // 213
                                                                                                                       // 214
      self.callbacks.changed(self.collectionName, id, changed);                                                        // 215
    }                                                                                                                  // 216
  }                                                                                                                    // 217
});                                                                                                                    // 218
                                                                                                                       // 219
/******************************************************************************/                                       // 220
/* Session                                                                    */                                       // 221
/******************************************************************************/                                       // 222
                                                                                                                       // 223
var Session = function (server, version, socket, options) {                                                            // 224
  var self = this;                                                                                                     // 225
  self.id = Random.id();                                                                                               // 226
                                                                                                                       // 227
  self.server = server;                                                                                                // 228
  self.version = version;                                                                                              // 229
                                                                                                                       // 230
  self.initialized = false;                                                                                            // 231
  self.socket = socket;                                                                                                // 232
                                                                                                                       // 233
  // set to null when the session is destroyed. multiple places below                                                  // 234
  // use this to determine if the session is alive or not.                                                             // 235
  self.inQueue = [];                                                                                                   // 236
                                                                                                                       // 237
  self.blocked = false;                                                                                                // 238
  self.workerRunning = false;                                                                                          // 239
                                                                                                                       // 240
  // Sub objects for active subscriptions                                                                              // 241
  self._namedSubs = {};                                                                                                // 242
  self._universalSubs = [];                                                                                            // 243
                                                                                                                       // 244
  self.userId = null;                                                                                                  // 245
                                                                                                                       // 246
  self.collectionViews = {};                                                                                           // 247
                                                                                                                       // 248
  // Set this to false to not send messages when collectionViews are                                                   // 249
  // modified. This is done when rerunning subs in _setUserId and those messages                                       // 250
  // are calculated via a diff instead.                                                                                // 251
  self._isSending = true;                                                                                              // 252
                                                                                                                       // 253
  // If this is true, don't start a newly-created universal publisher on this                                          // 254
  // session. The session will take care of starting it when appropriate.                                              // 255
  self._dontStartNewUniversalSubs = false;                                                                             // 256
                                                                                                                       // 257
  // when we are rerunning subscriptions, any ready messages                                                           // 258
  // we want to buffer up for when we are done rerunning subscriptions                                                 // 259
  self._pendingReady = [];                                                                                             // 260
                                                                                                                       // 261
  // List of callbacks to call when this connection is closed.                                                         // 262
  self._closeCallbacks = [];                                                                                           // 263
                                                                                                                       // 264
                                                                                                                       // 265
  // XXX HACK: If a sockjs connection, save off the URL. This is                                                       // 266
  // temporary and will go away in the near future.                                                                    // 267
  self._socketUrl = socket.url;                                                                                        // 268
                                                                                                                       // 269
  // Allow tests to disable responding to pings.                                                                       // 270
  self._respondToPings = options.respondToPings;                                                                       // 271
                                                                                                                       // 272
  // This object is the public interface to the session. In the public                                                 // 273
  // API, it is called the `connection` object.  Internally we call it                                                 // 274
  // a `connectionHandle` to avoid ambiguity.                                                                          // 275
  self.connectionHandle = {                                                                                            // 276
    id: self.id,                                                                                                       // 277
    close: function () {                                                                                               // 278
      self.close();                                                                                                    // 279
    },                                                                                                                 // 280
    onClose: function (fn) {                                                                                           // 281
      var cb = Meteor.bindEnvironment(fn, "connection onClose callback");                                              // 282
      if (self.inQueue) {                                                                                              // 283
        self._closeCallbacks.push(cb);                                                                                 // 284
      } else {                                                                                                         // 285
        // if we're already closed, call the callback.                                                                 // 286
        Meteor.defer(cb);                                                                                              // 287
      }                                                                                                                // 288
    },                                                                                                                 // 289
    clientAddress: self._clientAddress(),                                                                              // 290
    httpHeaders: self.socket.headers                                                                                   // 291
  };                                                                                                                   // 292
                                                                                                                       // 293
  socket.send(stringifyDDP({msg: 'connected',                                                                          // 294
                            session: self.id}));                                                                       // 295
  // On initial connect, spin up all the universal publishers.                                                         // 296
  Fiber(function () {                                                                                                  // 297
    self.startUniversalSubs();                                                                                         // 298
  }).run();                                                                                                            // 299
                                                                                                                       // 300
  if (version !== 'pre1' && options.heartbeatInterval !== 0) {                                                         // 301
    self.heartbeat = new Heartbeat({                                                                                   // 302
      heartbeatInterval: options.heartbeatInterval,                                                                    // 303
      heartbeatTimeout: options.heartbeatTimeout,                                                                      // 304
      onTimeout: function () {                                                                                         // 305
        self.close();                                                                                                  // 306
      },                                                                                                               // 307
      sendPing: function () {                                                                                          // 308
        self.send({msg: 'ping'});                                                                                      // 309
      }                                                                                                                // 310
    });                                                                                                                // 311
    self.heartbeat.start();                                                                                            // 312
  }                                                                                                                    // 313
                                                                                                                       // 314
  Package.facts && Package.facts.Facts.incrementServerFact(                                                            // 315
    "livedata", "sessions", 1);                                                                                        // 316
};                                                                                                                     // 317
                                                                                                                       // 318
_.extend(Session.prototype, {                                                                                          // 319
                                                                                                                       // 320
  sendReady: function (subscriptionIds) {                                                                              // 321
    var self = this;                                                                                                   // 322
    if (self._isSending)                                                                                               // 323
      self.send({msg: "ready", subs: subscriptionIds});                                                                // 324
    else {                                                                                                             // 325
      _.each(subscriptionIds, function (subscriptionId) {                                                              // 326
        self._pendingReady.push(subscriptionId);                                                                       // 327
      });                                                                                                              // 328
    }                                                                                                                  // 329
  },                                                                                                                   // 330
                                                                                                                       // 331
  sendAdded: function (collectionName, id, fields) {                                                                   // 332
    var self = this;                                                                                                   // 333
    if (self._isSending)                                                                                               // 334
      self.send({msg: "added", collection: collectionName, id: id, fields: fields});                                   // 335
  },                                                                                                                   // 336
                                                                                                                       // 337
  sendChanged: function (collectionName, id, fields) {                                                                 // 338
    var self = this;                                                                                                   // 339
    if (_.isEmpty(fields))                                                                                             // 340
      return;                                                                                                          // 341
                                                                                                                       // 342
    if (self._isSending) {                                                                                             // 343
      self.send({                                                                                                      // 344
        msg: "changed",                                                                                                // 345
        collection: collectionName,                                                                                    // 346
        id: id,                                                                                                        // 347
        fields: fields                                                                                                 // 348
      });                                                                                                              // 349
    }                                                                                                                  // 350
  },                                                                                                                   // 351
                                                                                                                       // 352
  sendRemoved: function (collectionName, id) {                                                                         // 353
    var self = this;                                                                                                   // 354
    if (self._isSending)                                                                                               // 355
      self.send({msg: "removed", collection: collectionName, id: id});                                                 // 356
  },                                                                                                                   // 357
                                                                                                                       // 358
  getSendCallbacks: function () {                                                                                      // 359
    var self = this;                                                                                                   // 360
    return {                                                                                                           // 361
      added: _.bind(self.sendAdded, self),                                                                             // 362
      changed: _.bind(self.sendChanged, self),                                                                         // 363
      removed: _.bind(self.sendRemoved, self)                                                                          // 364
    };                                                                                                                 // 365
  },                                                                                                                   // 366
                                                                                                                       // 367
  getCollectionView: function (collectionName) {                                                                       // 368
    var self = this;                                                                                                   // 369
    if (_.has(self.collectionViews, collectionName)) {                                                                 // 370
      return self.collectionViews[collectionName];                                                                     // 371
    }                                                                                                                  // 372
    var ret = new SessionCollectionView(collectionName,                                                                // 373
                                        self.getSendCallbacks());                                                      // 374
    self.collectionViews[collectionName] = ret;                                                                        // 375
    return ret;                                                                                                        // 376
  },                                                                                                                   // 377
                                                                                                                       // 378
  added: function (subscriptionHandle, collectionName, id, fields) {                                                   // 379
    var self = this;                                                                                                   // 380
    var view = self.getCollectionView(collectionName);                                                                 // 381
    view.added(subscriptionHandle, id, fields);                                                                        // 382
  },                                                                                                                   // 383
                                                                                                                       // 384
  removed: function (subscriptionHandle, collectionName, id) {                                                         // 385
    var self = this;                                                                                                   // 386
    var view = self.getCollectionView(collectionName);                                                                 // 387
    view.removed(subscriptionHandle, id);                                                                              // 388
    if (view.isEmpty()) {                                                                                              // 389
      delete self.collectionViews[collectionName];                                                                     // 390
    }                                                                                                                  // 391
  },                                                                                                                   // 392
                                                                                                                       // 393
  changed: function (subscriptionHandle, collectionName, id, fields) {                                                 // 394
    var self = this;                                                                                                   // 395
    var view = self.getCollectionView(collectionName);                                                                 // 396
    view.changed(subscriptionHandle, id, fields);                                                                      // 397
  },                                                                                                                   // 398
                                                                                                                       // 399
  startUniversalSubs: function () {                                                                                    // 400
    var self = this;                                                                                                   // 401
    // Make a shallow copy of the set of universal handlers and start them. If                                         // 402
    // additional universal publishers start while we're running them (due to                                          // 403
    // yielding), they will run separately as part of Server.publish.                                                  // 404
    var handlers = _.clone(self.server.universal_publish_handlers);                                                    // 405
    _.each(handlers, function (handler) {                                                                              // 406
      self._startSubscription(handler);                                                                                // 407
    });                                                                                                                // 408
  },                                                                                                                   // 409
                                                                                                                       // 410
  // Destroy this session and unregister it at the server.                                                             // 411
  close: function () {                                                                                                 // 412
    var self = this;                                                                                                   // 413
                                                                                                                       // 414
    // Destroy this session, even if it's not registered at the                                                        // 415
    // server. Stop all processing and tear everything down. If a socket                                               // 416
    // was attached, close it.                                                                                         // 417
                                                                                                                       // 418
    // Already destroyed.                                                                                              // 419
    if (! self.inQueue)                                                                                                // 420
      return;                                                                                                          // 421
                                                                                                                       // 422
    if (self.heartbeat) {                                                                                              // 423
      self.heartbeat.stop();                                                                                           // 424
      self.heartbeat = null;                                                                                           // 425
    }                                                                                                                  // 426
                                                                                                                       // 427
    if (self.socket) {                                                                                                 // 428
      self.socket.close();                                                                                             // 429
      self.socket._meteorSession = null;                                                                               // 430
    }                                                                                                                  // 431
                                                                                                                       // 432
    // Drop the merge box data immediately.                                                                            // 433
    self.collectionViews = {};                                                                                         // 434
    self.inQueue = null;                                                                                               // 435
                                                                                                                       // 436
    Package.facts && Package.facts.Facts.incrementServerFact(                                                          // 437
      "livedata", "sessions", -1);                                                                                     // 438
                                                                                                                       // 439
    Meteor.defer(function () {                                                                                         // 440
      // stop callbacks can yield, so we defer this on close.                                                          // 441
      // sub._isDeactivated() detects that we set inQueue to null and                                                  // 442
      // treats it as semi-deactivated (it will ignore incoming callbacks, etc).                                       // 443
      self._deactivateAllSubscriptions();                                                                              // 444
                                                                                                                       // 445
      // Defer calling the close callbacks, so that the caller closing                                                 // 446
      // the session isn't waiting for all the callbacks to complete.                                                  // 447
      _.each(self._closeCallbacks, function (callback) {                                                               // 448
        callback();                                                                                                    // 449
      });                                                                                                              // 450
    });                                                                                                                // 451
                                                                                                                       // 452
    // Unregister the session.                                                                                         // 453
    self.server._removeSession(self);                                                                                  // 454
  },                                                                                                                   // 455
                                                                                                                       // 456
  // Send a message (doing nothing if no socket is connected right now.)                                               // 457
  // It should be a JSON object (it will be stringified.)                                                              // 458
  send: function (msg) {                                                                                               // 459
    var self = this;                                                                                                   // 460
    if (self.socket) {                                                                                                 // 461
      if (Meteor._printSentDDP)                                                                                        // 462
        Meteor._debug("Sent DDP", stringifyDDP(msg));                                                                  // 463
      self.socket.send(stringifyDDP(msg));                                                                             // 464
    }                                                                                                                  // 465
  },                                                                                                                   // 466
                                                                                                                       // 467
  // Send a connection error.                                                                                          // 468
  sendError: function (reason, offendingMessage) {                                                                     // 469
    var self = this;                                                                                                   // 470
    var msg = {msg: 'error', reason: reason};                                                                          // 471
    if (offendingMessage)                                                                                              // 472
      msg.offendingMessage = offendingMessage;                                                                         // 473
    self.send(msg);                                                                                                    // 474
  },                                                                                                                   // 475
                                                                                                                       // 476
  // Process 'msg' as an incoming message. (But as a guard against                                                     // 477
  // race conditions during reconnection, ignore the message if                                                        // 478
  // 'socket' is not the currently connected socket.)                                                                  // 479
  //                                                                                                                   // 480
  // We run the messages from the client one at a time, in the order                                                   // 481
  // given by the client. The message handler is passed an idempotent                                                  // 482
  // function 'unblock' which it may call to allow other messages to                                                   // 483
  // begin running in parallel in another fiber (for example, a method                                                 // 484
  // that wants to yield.) Otherwise, it is automatically unblocked                                                    // 485
  // when it returns.                                                                                                  // 486
  //                                                                                                                   // 487
  // Actually, we don't have to 'totally order' the messages in this                                                   // 488
  // way, but it's the easiest thing that's correct. (unsub needs to                                                   // 489
  // be ordered against sub, methods need to be ordered against each                                                   // 490
  // other.)                                                                                                           // 491
  processMessage: function (msg_in) {                                                                                  // 492
    var self = this;                                                                                                   // 493
    if (!self.inQueue) // we have been destroyed.                                                                      // 494
      return;                                                                                                          // 495
                                                                                                                       // 496
    // Respond to ping and pong messages immediately without queuing.                                                  // 497
    // If the negotiated DDP version is "pre1" which didn't support                                                    // 498
    // pings, preserve the "pre1" behavior of responding with a "bad                                                   // 499
    // request" for the unknown messages.                                                                              // 500
    //                                                                                                                 // 501
    // Fibers are needed because heartbeat uses Meteor.setTimeout, which                                               // 502
    // needs a Fiber. We could actually use regular setTimeout and avoid                                               // 503
    // these new fibers, but it is easier to just make everything use                                                  // 504
    // Meteor.setTimeout and not think too hard.                                                                       // 505
    if (self.version !== 'pre1' && msg_in.msg === 'ping') {                                                            // 506
      if (self._respondToPings)                                                                                        // 507
        self.send({msg: "pong", id: msg_in.id});                                                                       // 508
      if (self.heartbeat)                                                                                              // 509
        Fiber(function () {                                                                                            // 510
          self.heartbeat.pingReceived();                                                                               // 511
        }).run();                                                                                                      // 512
      return;                                                                                                          // 513
    }                                                                                                                  // 514
    if (self.version !== 'pre1' && msg_in.msg === 'pong') {                                                            // 515
      if (self.heartbeat)                                                                                              // 516
        Fiber(function () {                                                                                            // 517
          self.heartbeat.pongReceived();                                                                               // 518
        }).run();                                                                                                      // 519
      return;                                                                                                          // 520
    }                                                                                                                  // 521
                                                                                                                       // 522
    self.inQueue.push(msg_in);                                                                                         // 523
    if (self.workerRunning)                                                                                            // 524
      return;                                                                                                          // 525
    self.workerRunning = true;                                                                                         // 526
                                                                                                                       // 527
    var processNext = function () {                                                                                    // 528
      var msg = self.inQueue && self.inQueue.shift();                                                                  // 529
      if (!msg) {                                                                                                      // 530
        self.workerRunning = false;                                                                                    // 531
        return;                                                                                                        // 532
      }                                                                                                                // 533
                                                                                                                       // 534
      Fiber(function () {                                                                                              // 535
        var blocked = true;                                                                                            // 536
                                                                                                                       // 537
        var unblock = function () {                                                                                    // 538
          if (!blocked)                                                                                                // 539
            return; // idempotent                                                                                      // 540
          blocked = false;                                                                                             // 541
          processNext();                                                                                               // 542
        };                                                                                                             // 543
                                                                                                                       // 544
        if (_.has(self.protocol_handlers, msg.msg))                                                                    // 545
          self.protocol_handlers[msg.msg].call(self, msg, unblock);                                                    // 546
        else                                                                                                           // 547
          self.sendError('Bad request', msg);                                                                          // 548
        unblock(); // in case the handler didn't already do it                                                         // 549
      }).run();                                                                                                        // 550
    };                                                                                                                 // 551
                                                                                                                       // 552
    processNext();                                                                                                     // 553
  },                                                                                                                   // 554
                                                                                                                       // 555
  protocol_handlers: {                                                                                                 // 556
    sub: function (msg) {                                                                                              // 557
      var self = this;                                                                                                 // 558
                                                                                                                       // 559
      // reject malformed messages                                                                                     // 560
      if (typeof (msg.id) !== "string" ||                                                                              // 561
          typeof (msg.name) !== "string" ||                                                                            // 562
          (('params' in msg) && !(msg.params instanceof Array))) {                                                     // 563
        self.sendError("Malformed subscription", msg);                                                                 // 564
        return;                                                                                                        // 565
      }                                                                                                                // 566
                                                                                                                       // 567
      if (!self.server.publish_handlers[msg.name]) {                                                                   // 568
        self.send({                                                                                                    // 569
          msg: 'nosub', id: msg.id,                                                                                    // 570
          error: new Meteor.Error(404, "Subscription not found")});                                                    // 571
        return;                                                                                                        // 572
      }                                                                                                                // 573
                                                                                                                       // 574
      if (_.has(self._namedSubs, msg.id))                                                                              // 575
        // subs are idempotent, or rather, they are ignored if a sub                                                   // 576
        // with that id already exists. this is important during                                                       // 577
        // reconnect.                                                                                                  // 578
        return;                                                                                                        // 579
                                                                                                                       // 580
      var handler = self.server.publish_handlers[msg.name];                                                            // 581
      self._startSubscription(handler, msg.id, msg.params, msg.name);                                                  // 582
                                                                                                                       // 583
    },                                                                                                                 // 584
                                                                                                                       // 585
    unsub: function (msg) {                                                                                            // 586
      var self = this;                                                                                                 // 587
                                                                                                                       // 588
      self._stopSubscription(msg.id);                                                                                  // 589
    },                                                                                                                 // 590
                                                                                                                       // 591
    method: function (msg, unblock) {                                                                                  // 592
      var self = this;                                                                                                 // 593
                                                                                                                       // 594
      // reject malformed messages                                                                                     // 595
      // For now, we silently ignore unknown attributes,                                                               // 596
      // for forwards compatibility.                                                                                   // 597
      if (typeof (msg.id) !== "string" ||                                                                              // 598
          typeof (msg.method) !== "string" ||                                                                          // 599
          (('params' in msg) && !(msg.params instanceof Array)) ||                                                     // 600
          (('randomSeed' in msg) && (typeof msg.randomSeed !== "string"))) {                                           // 601
        self.sendError("Malformed method invocation", msg);                                                            // 602
        return;                                                                                                        // 603
      }                                                                                                                // 604
                                                                                                                       // 605
      var randomSeed = msg.randomSeed || null;                                                                         // 606
                                                                                                                       // 607
      // set up to mark the method as satisfied once all observers                                                     // 608
      // (and subscriptions) have reacted to any writes that were                                                      // 609
      // done.                                                                                                         // 610
      var fence = new DDPServer._WriteFence;                                                                           // 611
      fence.onAllCommitted(function () {                                                                               // 612
        // Retire the fence so that future writes are allowed.                                                         // 613
        // This means that callbacks like timers are free to use                                                       // 614
        // the fence, and if they fire before it's armed (for                                                          // 615
        // example, because the method waits for them) their                                                           // 616
        // writes will be included in the fence.                                                                       // 617
        fence.retire();                                                                                                // 618
        self.send({                                                                                                    // 619
          msg: 'updated', methods: [msg.id]});                                                                         // 620
      });                                                                                                              // 621
                                                                                                                       // 622
      // find the handler                                                                                              // 623
      var handler = self.server.method_handlers[msg.method];                                                           // 624
      if (!handler) {                                                                                                  // 625
        self.send({                                                                                                    // 626
          msg: 'result', id: msg.id,                                                                                   // 627
          error: new Meteor.Error(404, "Method not found")});                                                          // 628
        fence.arm();                                                                                                   // 629
        return;                                                                                                        // 630
      }                                                                                                                // 631
                                                                                                                       // 632
      var setUserId = function(userId) {                                                                               // 633
        self._setUserId(userId);                                                                                       // 634
      };                                                                                                               // 635
                                                                                                                       // 636
      var invocation = new MethodInvocation({                                                                          // 637
        isSimulation: false,                                                                                           // 638
        userId: self.userId,                                                                                           // 639
        setUserId: setUserId,                                                                                          // 640
        unblock: unblock,                                                                                              // 641
        connection: self.connectionHandle,                                                                             // 642
        randomSeed: randomSeed                                                                                         // 643
      });                                                                                                              // 644
      try {                                                                                                            // 645
        var result = DDPServer._CurrentWriteFence.withValue(fence, function () {                                       // 646
          return DDP._CurrentInvocation.withValue(invocation, function () {                                            // 647
            return maybeAuditArgumentChecks(                                                                           // 648
              handler, invocation, msg.params, "call to '" + msg.method + "'");                                        // 649
          });                                                                                                          // 650
        });                                                                                                            // 651
      } catch (e) {                                                                                                    // 652
        var exception = e;                                                                                             // 653
      }                                                                                                                // 654
                                                                                                                       // 655
      fence.arm(); // we're done adding writes to the fence                                                            // 656
      unblock(); // unblock, if the method hasn't done it already                                                      // 657
                                                                                                                       // 658
      exception = wrapInternalException(                                                                               // 659
        exception, "while invoking method '" + msg.method + "'");                                                      // 660
                                                                                                                       // 661
      // send response and add to cache                                                                                // 662
      var payload =                                                                                                    // 663
        exception ? {error: exception} : (result !== undefined ?                                                       // 664
                                          {result: result} : {});                                                      // 665
      self.send(_.extend({msg: 'result', id: msg.id}, payload));                                                       // 666
    }                                                                                                                  // 667
  },                                                                                                                   // 668
                                                                                                                       // 669
  _eachSub: function (f) {                                                                                             // 670
    var self = this;                                                                                                   // 671
    _.each(self._namedSubs, f);                                                                                        // 672
    _.each(self._universalSubs, f);                                                                                    // 673
  },                                                                                                                   // 674
                                                                                                                       // 675
  _diffCollectionViews: function (beforeCVs) {                                                                         // 676
    var self = this;                                                                                                   // 677
    LocalCollection._diffObjects(beforeCVs, self.collectionViews, {                                                    // 678
      both: function (collectionName, leftValue, rightValue) {                                                         // 679
        rightValue.diff(leftValue);                                                                                    // 680
      },                                                                                                               // 681
      rightOnly: function (collectionName, rightValue) {                                                               // 682
        _.each(rightValue.documents, function (docView, id) {                                                          // 683
          self.sendAdded(collectionName, id, docView.getFields());                                                     // 684
        });                                                                                                            // 685
      },                                                                                                               // 686
      leftOnly: function (collectionName, leftValue) {                                                                 // 687
        _.each(leftValue.documents, function (doc, id) {                                                               // 688
          self.sendRemoved(collectionName, id);                                                                        // 689
        });                                                                                                            // 690
      }                                                                                                                // 691
    });                                                                                                                // 692
  },                                                                                                                   // 693
                                                                                                                       // 694
  // Sets the current user id in all appropriate contexts and reruns                                                   // 695
  // all subscriptions                                                                                                 // 696
  _setUserId: function(userId) {                                                                                       // 697
    var self = this;                                                                                                   // 698
                                                                                                                       // 699
    if (userId !== null && typeof userId !== "string")                                                                 // 700
      throw new Error("setUserId must be called on string or null, not " +                                             // 701
                      typeof userId);                                                                                  // 702
                                                                                                                       // 703
    // Prevent newly-created universal subscriptions from being added to our                                           // 704
    // session; they will be found below when we call startUniversalSubs.                                              // 705
    //                                                                                                                 // 706
    // (We don't have to worry about named subscriptions, because we only add                                          // 707
    // them when we process a 'sub' message. We are currently processing a                                             // 708
    // 'method' message, and the method did not unblock, because it is illegal                                         // 709
    // to call setUserId after unblock. Thus we cannot be concurrently adding a                                        // 710
    // new named subscription.)                                                                                        // 711
    self._dontStartNewUniversalSubs = true;                                                                            // 712
                                                                                                                       // 713
    // Prevent current subs from updating our collectionViews and call their                                           // 714
    // stop callbacks. This may yield.                                                                                 // 715
    self._eachSub(function (sub) {                                                                                     // 716
      sub._deactivate();                                                                                               // 717
    });                                                                                                                // 718
                                                                                                                       // 719
    // All subs should now be deactivated. Stop sending messages to the client,                                        // 720
    // save the state of the published collections, reset to an empty view, and                                        // 721
    // update the userId.                                                                                              // 722
    self._isSending = false;                                                                                           // 723
    var beforeCVs = self.collectionViews;                                                                              // 724
    self.collectionViews = {};                                                                                         // 725
    self.userId = userId;                                                                                              // 726
                                                                                                                       // 727
    // Save the old named subs, and reset to having no subscriptions.                                                  // 728
    var oldNamedSubs = self._namedSubs;                                                                                // 729
    self._namedSubs = {};                                                                                              // 730
    self._universalSubs = [];                                                                                          // 731
                                                                                                                       // 732
    _.each(oldNamedSubs, function (sub, subscriptionId) {                                                              // 733
      self._namedSubs[subscriptionId] = sub._recreate();                                                               // 734
      // nb: if the handler throws or calls this.error(), it will in fact                                              // 735
      // immediately send its 'nosub'. This is OK, though.                                                             // 736
      self._namedSubs[subscriptionId]._runHandler();                                                                   // 737
    });                                                                                                                // 738
                                                                                                                       // 739
    // Allow newly-created universal subs to be started on our connection in                                           // 740
    // parallel with the ones we're spinning up here, and spin up universal                                            // 741
    // subs.                                                                                                           // 742
    self._dontStartNewUniversalSubs = false;                                                                           // 743
    self.startUniversalSubs();                                                                                         // 744
                                                                                                                       // 745
    // Start sending messages again, beginning with the diff from the previous                                         // 746
    // state of the world to the current state. No yields are allowed during                                           // 747
    // this diff, so that other changes cannot interleave.                                                             // 748
    Meteor._noYieldsAllowed(function () {                                                                              // 749
      self._isSending = true;                                                                                          // 750
      self._diffCollectionViews(beforeCVs);                                                                            // 751
      if (!_.isEmpty(self._pendingReady)) {                                                                            // 752
        self.sendReady(self._pendingReady);                                                                            // 753
        self._pendingReady = [];                                                                                       // 754
      }                                                                                                                // 755
    });                                                                                                                // 756
  },                                                                                                                   // 757
                                                                                                                       // 758
  _startSubscription: function (handler, subId, params, name) {                                                        // 759
    var self = this;                                                                                                   // 760
                                                                                                                       // 761
    var sub = new Subscription(                                                                                        // 762
      self, handler, subId, params, name);                                                                             // 763
    if (subId)                                                                                                         // 764
      self._namedSubs[subId] = sub;                                                                                    // 765
    else                                                                                                               // 766
      self._universalSubs.push(sub);                                                                                   // 767
                                                                                                                       // 768
    sub._runHandler();                                                                                                 // 769
  },                                                                                                                   // 770
                                                                                                                       // 771
  // tear down specified subscription                                                                                  // 772
  _stopSubscription: function (subId, error) {                                                                         // 773
    var self = this;                                                                                                   // 774
                                                                                                                       // 775
    if (subId && self._namedSubs[subId]) {                                                                             // 776
      self._namedSubs[subId]._removeAllDocuments();                                                                    // 777
      self._namedSubs[subId]._deactivate();                                                                            // 778
      delete self._namedSubs[subId];                                                                                   // 779
    }                                                                                                                  // 780
                                                                                                                       // 781
    var response = {msg: 'nosub', id: subId};                                                                          // 782
                                                                                                                       // 783
    if (error)                                                                                                         // 784
      response.error = wrapInternalException(error, "from sub " + subId);                                              // 785
                                                                                                                       // 786
    self.send(response);                                                                                               // 787
  },                                                                                                                   // 788
                                                                                                                       // 789
  // tear down all subscriptions. Note that this does NOT send removed or nosub                                        // 790
  // messages, since we assume the client is gone.                                                                     // 791
  _deactivateAllSubscriptions: function () {                                                                           // 792
    var self = this;                                                                                                   // 793
                                                                                                                       // 794
    _.each(self._namedSubs, function (sub, id) {                                                                       // 795
      sub._deactivate();                                                                                               // 796
    });                                                                                                                // 797
    self._namedSubs = {};                                                                                              // 798
                                                                                                                       // 799
    _.each(self._universalSubs, function (sub) {                                                                       // 800
      sub._deactivate();                                                                                               // 801
    });                                                                                                                // 802
    self._universalSubs = [];                                                                                          // 803
  },                                                                                                                   // 804
                                                                                                                       // 805
  // Determine the remote client's IP address, based on the                                                            // 806
  // HTTP_FORWARDED_COUNT environment variable representing how many                                                   // 807
  // proxies the server is behind.                                                                                     // 808
  _clientAddress: function () {                                                                                        // 809
    var self = this;                                                                                                   // 810
                                                                                                                       // 811
    // For the reported client address for a connection to be correct,                                                 // 812
    // the developer must set the HTTP_FORWARDED_COUNT environment                                                     // 813
    // variable to an integer representing the number of hops they                                                     // 814
    // expect in the `x-forwarded-for` header. E.g., set to "1" if the                                                 // 815
    // server is behind one proxy.                                                                                     // 816
    //                                                                                                                 // 817
    // This could be computed once at startup instead of every time.                                                   // 818
    var httpForwardedCount = parseInt(process.env['HTTP_FORWARDED_COUNT']) || 0;                                       // 819
                                                                                                                       // 820
    if (httpForwardedCount === 0)                                                                                      // 821
      return self.socket.remoteAddress;                                                                                // 822
                                                                                                                       // 823
    var forwardedFor = self.socket.headers["x-forwarded-for"];                                                         // 824
    if (! _.isString(forwardedFor))                                                                                    // 825
      return null;                                                                                                     // 826
    forwardedFor = forwardedFor.trim().split(/\s*,\s*/);                                                               // 827
                                                                                                                       // 828
    // Typically the first value in the `x-forwarded-for` header is                                                    // 829
    // the original IP address of the client connecting to the first                                                   // 830
    // proxy.  However, the end user can easily spoof the header, in                                                   // 831
    // which case the first value(s) will be the fake IP address from                                                  // 832
    // the user pretending to be a proxy reporting the original IP                                                     // 833
    // address value.  By counting HTTP_FORWARDED_COUNT back from the                                                  // 834
    // end of the list, we ensure that we get the IP address being                                                     // 835
    // reported by *our* first proxy.                                                                                  // 836
                                                                                                                       // 837
    if (httpForwardedCount < 0 || httpForwardedCount > forwardedFor.length)                                            // 838
      return null;                                                                                                     // 839
                                                                                                                       // 840
    return forwardedFor[forwardedFor.length - httpForwardedCount];                                                     // 841
  }                                                                                                                    // 842
});                                                                                                                    // 843
                                                                                                                       // 844
/******************************************************************************/                                       // 845
/* Subscription                                                               */                                       // 846
/******************************************************************************/                                       // 847
                                                                                                                       // 848
// ctor for a sub handle: the input to each publish function                                                           // 849
                                                                                                                       // 850
// Instance name is this because it's usually referred to as this inside a                                             // 851
// publish                                                                                                             // 852
/**                                                                                                                    // 853
 * @summary The server's side of a subscription                                                                        // 854
 * @class Subscription                                                                                                 // 855
 * @instanceName this                                                                                                  // 856
 */                                                                                                                    // 857
var Subscription = function (                                                                                          // 858
    session, handler, subscriptionId, params, name) {                                                                  // 859
  var self = this;                                                                                                     // 860
  self._session = session; // type is Session                                                                          // 861
                                                                                                                       // 862
  /**                                                                                                                  // 863
   * @summary Access inside the publish function. The incoming [connection](#meteor_onconnection) for this subscription.
   * @locus Server                                                                                                     // 865
   * @name  connection                                                                                                 // 866
   * @memberOf Subscription                                                                                            // 867
   * @instance                                                                                                         // 868
   */                                                                                                                  // 869
  self.connection = session.connectionHandle; // public API object                                                     // 870
                                                                                                                       // 871
  self._handler = handler;                                                                                             // 872
                                                                                                                       // 873
  // my subscription ID (generated by client, undefined for universal subs).                                           // 874
  self._subscriptionId = subscriptionId;                                                                               // 875
  // undefined for universal subs                                                                                      // 876
  self._name = name;                                                                                                   // 877
                                                                                                                       // 878
  self._params = params || [];                                                                                         // 879
                                                                                                                       // 880
  // Only named subscriptions have IDs, but we need some sort of string                                                // 881
  // internally to keep track of all subscriptions inside                                                              // 882
  // SessionDocumentViews. We use this subscriptionHandle for that.                                                    // 883
  if (self._subscriptionId) {                                                                                          // 884
    self._subscriptionHandle = 'N' + self._subscriptionId;                                                             // 885
  } else {                                                                                                             // 886
    self._subscriptionHandle = 'U' + Random.id();                                                                      // 887
  }                                                                                                                    // 888
                                                                                                                       // 889
  // has _deactivate been called?                                                                                      // 890
  self._deactivated = false;                                                                                           // 891
                                                                                                                       // 892
  // stop callbacks to g/c this sub.  called w/ zero arguments.                                                        // 893
  self._stopCallbacks = [];                                                                                            // 894
                                                                                                                       // 895
  // the set of (collection, documentid) that this subscription has                                                    // 896
  // an opinion about                                                                                                  // 897
  self._documents = {};                                                                                                // 898
                                                                                                                       // 899
  // remember if we are ready.                                                                                         // 900
  self._ready = false;                                                                                                 // 901
                                                                                                                       // 902
  // Part of the public API: the user of this sub.                                                                     // 903
                                                                                                                       // 904
  /**                                                                                                                  // 905
   * @summary Access inside the publish function. The id of the logged-in user, or `null` if no user is logged in.     // 906
   * @locus Server                                                                                                     // 907
   * @memberOf Subscription                                                                                            // 908
   * @name  userId                                                                                                     // 909
   * @instance                                                                                                         // 910
   */                                                                                                                  // 911
  self.userId = session.userId;                                                                                        // 912
                                                                                                                       // 913
  // For now, the id filter is going to default to                                                                     // 914
  // the to/from DDP methods on LocalCollection, to                                                                    // 915
  // specifically deal with mongo/minimongo ObjectIds.                                                                 // 916
                                                                                                                       // 917
  // Later, you will be able to make this be "raw"                                                                     // 918
  // if you want to publish a collection that you know                                                                 // 919
  // just has strings for keys and no funny business, to                                                               // 920
  // a ddp consumer that isn't minimongo                                                                               // 921
                                                                                                                       // 922
  self._idFilter = {                                                                                                   // 923
    idStringify: LocalCollection._idStringify,                                                                         // 924
    idParse: LocalCollection._idParse                                                                                  // 925
  };                                                                                                                   // 926
                                                                                                                       // 927
  Package.facts && Package.facts.Facts.incrementServerFact(                                                            // 928
    "livedata", "subscriptions", 1);                                                                                   // 929
};                                                                                                                     // 930
                                                                                                                       // 931
_.extend(Subscription.prototype, {                                                                                     // 932
  _runHandler: function () {                                                                                           // 933
    // XXX should we unblock() here? Either before running the publish                                                 // 934
    // function, or before running _publishCursor.                                                                     // 935
    //                                                                                                                 // 936
    // Right now, each publish function blocks all future publishes and                                                // 937
    // methods waiting on data from Mongo (or whatever else the function                                               // 938
    // blocks on). This probably slows page load in common cases.                                                      // 939
                                                                                                                       // 940
    var self = this;                                                                                                   // 941
    try {                                                                                                              // 942
      var res = maybeAuditArgumentChecks(                                                                              // 943
        self._handler, self, EJSON.clone(self._params),                                                                // 944
        // It's OK that this would look weird for universal subscriptions,                                             // 945
        // because they have no arguments so there can never be an                                                     // 946
        // audit-argument-checks failure.                                                                              // 947
        "publisher '" + self._name + "'");                                                                             // 948
    } catch (e) {                                                                                                      // 949
      self.error(e);                                                                                                   // 950
      return;                                                                                                          // 951
    }                                                                                                                  // 952
                                                                                                                       // 953
    // Did the handler call this.error or this.stop?                                                                   // 954
    if (self._isDeactivated())                                                                                         // 955
      return;                                                                                                          // 956
                                                                                                                       // 957
    // SPECIAL CASE: Instead of writing their own callbacks that invoke                                                // 958
    // this.added/changed/ready/etc, the user can just return a collection                                             // 959
    // cursor or array of cursors from the publish function; we call their                                             // 960
    // _publishCursor method which starts observing the cursor and publishes the                                       // 961
    // results. Note that _publishCursor does NOT call ready().                                                        // 962
    //                                                                                                                 // 963
    // XXX This uses an undocumented interface which only the Mongo cursor                                             // 964
    // interface publishes. Should we make this interface public and encourage                                         // 965
    // users to implement it themselves? Arguably, it's unnecessary; users can                                         // 966
    // already write their own functions like                                                                          // 967
    //   var publishMyReactiveThingy = function (name, handler) {                                                      // 968
    //     Meteor.publish(name, function () {                                                                          // 969
    //       var reactiveThingy = handler();                                                                           // 970
    //       reactiveThingy.publishMe();                                                                               // 971
    //     });                                                                                                         // 972
    //   };                                                                                                            // 973
    var isCursor = function (c) {                                                                                      // 974
      return c && c._publishCursor;                                                                                    // 975
    };                                                                                                                 // 976
    if (isCursor(res)) {                                                                                               // 977
      res._publishCursor(self);                                                                                        // 978
      // _publishCursor only returns after the initial added callbacks have run.                                       // 979
      // mark subscription as ready.                                                                                   // 980
      self.ready();                                                                                                    // 981
    } else if (_.isArray(res)) {                                                                                       // 982
      // check all the elements are cursors                                                                            // 983
      if (! _.all(res, isCursor)) {                                                                                    // 984
        self.error(new Error("Publish function returned an array of non-Cursors"));                                    // 985
        return;                                                                                                        // 986
      }                                                                                                                // 987
      // find duplicate collection names                                                                               // 988
      // XXX we should support overlapping cursors, but that would require the                                         // 989
      // merge box to allow overlap within a subscription                                                              // 990
      var collectionNames = {};                                                                                        // 991
      for (var i = 0; i < res.length; ++i) {                                                                           // 992
        var collectionName = res[i]._getCollectionName();                                                              // 993
        if (_.has(collectionNames, collectionName)) {                                                                  // 994
          self.error(new Error(                                                                                        // 995
            "Publish function returned multiple cursors for collection " +                                             // 996
              collectionName));                                                                                        // 997
          return;                                                                                                      // 998
        }                                                                                                              // 999
        collectionNames[collectionName] = true;                                                                        // 1000
      };                                                                                                               // 1001
                                                                                                                       // 1002
      _.each(res, function (cur) {                                                                                     // 1003
        cur._publishCursor(self);                                                                                      // 1004
      });                                                                                                              // 1005
      self.ready();                                                                                                    // 1006
    } else if (res) {                                                                                                  // 1007
      // truthy values other than cursors or arrays are probably a                                                     // 1008
      // user mistake (possible returning a Mongo document via, say,                                                   // 1009
      // `coll.findOne()`).                                                                                            // 1010
      self.error(new Error("Publish function can only return a Cursor or "                                             // 1011
                           + "an array of Cursors"));                                                                  // 1012
    }                                                                                                                  // 1013
  },                                                                                                                   // 1014
                                                                                                                       // 1015
  // This calls all stop callbacks and prevents the handler from updating any                                          // 1016
  // SessionCollectionViews further. It's used when the user unsubscribes or                                           // 1017
  // disconnects, as well as during setUserId re-runs. It does *NOT* send                                              // 1018
  // removed messages for the published objects; if that is necessary, call                                            // 1019
  // _removeAllDocuments first.                                                                                        // 1020
  _deactivate: function() {                                                                                            // 1021
    var self = this;                                                                                                   // 1022
    if (self._deactivated)                                                                                             // 1023
      return;                                                                                                          // 1024
    self._deactivated = true;                                                                                          // 1025
    self._callStopCallbacks();                                                                                         // 1026
    Package.facts && Package.facts.Facts.incrementServerFact(                                                          // 1027
      "livedata", "subscriptions", -1);                                                                                // 1028
  },                                                                                                                   // 1029
                                                                                                                       // 1030
  _callStopCallbacks: function () {                                                                                    // 1031
    var self = this;                                                                                                   // 1032
    // tell listeners, so they can clean up                                                                            // 1033
    var callbacks = self._stopCallbacks;                                                                               // 1034
    self._stopCallbacks = [];                                                                                          // 1035
    _.each(callbacks, function (callback) {                                                                            // 1036
      callback();                                                                                                      // 1037
    });                                                                                                                // 1038
  },                                                                                                                   // 1039
                                                                                                                       // 1040
  // Send remove messages for every document.                                                                          // 1041
  _removeAllDocuments: function () {                                                                                   // 1042
    var self = this;                                                                                                   // 1043
    Meteor._noYieldsAllowed(function () {                                                                              // 1044
      _.each(self._documents, function(collectionDocs, collectionName) {                                               // 1045
        // Iterate over _.keys instead of the dictionary itself, since we'll be                                        // 1046
        // mutating it.                                                                                                // 1047
        _.each(_.keys(collectionDocs), function (strId) {                                                              // 1048
          self.removed(collectionName, self._idFilter.idParse(strId));                                                 // 1049
        });                                                                                                            // 1050
      });                                                                                                              // 1051
    });                                                                                                                // 1052
  },                                                                                                                   // 1053
                                                                                                                       // 1054
  // Returns a new Subscription for the same session with the same                                                     // 1055
  // initial creation parameters. This isn't a clone: it doesn't have                                                  // 1056
  // the same _documents cache, stopped state or callbacks; may have a                                                 // 1057
  // different _subscriptionHandle, and gets its userId from the                                                       // 1058
  // session, not from this object.                                                                                    // 1059
  _recreate: function () {                                                                                             // 1060
    var self = this;                                                                                                   // 1061
    return new Subscription(                                                                                           // 1062
      self._session, self._handler, self._subscriptionId, self._params,                                                // 1063
      self._name);                                                                                                     // 1064
  },                                                                                                                   // 1065
                                                                                                                       // 1066
  /**                                                                                                                  // 1067
   * @summary Call inside the publish function.  Stops this client's subscription, triggering a call on the client to the `onError` callback passed to [`Meteor.subscribe`](#meteor_subscribe), if any. If `error` is not a [`Meteor.Error`](#meteor_error), it will be [sanitized](#meteor_error).
   * @locus Server                                                                                                     // 1069
   * @param {Error} error The error to pass to the client.                                                             // 1070
   * @instance                                                                                                         // 1071
   * @memberOf Subscription                                                                                            // 1072
   */                                                                                                                  // 1073
  error: function (error) {                                                                                            // 1074
    var self = this;                                                                                                   // 1075
    if (self._isDeactivated())                                                                                         // 1076
      return;                                                                                                          // 1077
    self._session._stopSubscription(self._subscriptionId, error);                                                      // 1078
  },                                                                                                                   // 1079
                                                                                                                       // 1080
  // Note that while our DDP client will notice that you've called stop() on the                                       // 1081
  // server (and clean up its _subscriptions table) we don't actually provide a                                        // 1082
  // mechanism for an app to notice this (the subscribe onError callback only                                          // 1083
  // triggers if there is an error).                                                                                   // 1084
                                                                                                                       // 1085
  /**                                                                                                                  // 1086
   * @summary Call inside the publish function.  Stops this client's subscription; the `onError` callback is *not* invoked on the client.
   * @locus Server                                                                                                     // 1088
   * @instance                                                                                                         // 1089
   * @memberOf Subscription                                                                                            // 1090
   */                                                                                                                  // 1091
  stop: function () {                                                                                                  // 1092
    var self = this;                                                                                                   // 1093
    if (self._isDeactivated())                                                                                         // 1094
      return;                                                                                                          // 1095
    self._session._stopSubscription(self._subscriptionId);                                                             // 1096
  },                                                                                                                   // 1097
                                                                                                                       // 1098
  /**                                                                                                                  // 1099
   * @summary Call inside the publish function.  Registers a callback function to run when the subscription is stopped.
   * @locus Server                                                                                                     // 1101
   * @memberOf Subscription                                                                                            // 1102
   * @instance                                                                                                         // 1103
   * @param {Function} func The callback function                                                                      // 1104
   */                                                                                                                  // 1105
  onStop: function (callback) {                                                                                        // 1106
    var self = this;                                                                                                   // 1107
    if (self._isDeactivated())                                                                                         // 1108
      callback();                                                                                                      // 1109
    else                                                                                                               // 1110
      self._stopCallbacks.push(callback);                                                                              // 1111
  },                                                                                                                   // 1112
                                                                                                                       // 1113
  // This returns true if the sub has been deactivated, *OR* if the session was                                        // 1114
  // destroyed but the deferred call to _deactivateAllSubscriptions hasn't                                             // 1115
  // happened yet.                                                                                                     // 1116
  _isDeactivated: function () {                                                                                        // 1117
    var self = this;                                                                                                   // 1118
    return self._deactivated || self._session.inQueue === null;                                                        // 1119
  },                                                                                                                   // 1120
                                                                                                                       // 1121
  /**                                                                                                                  // 1122
   * @summary Call inside the publish function.  Informs the subscriber that a document has been added to the record set.
   * @locus Server                                                                                                     // 1124
   * @memberOf Subscription                                                                                            // 1125
   * @instance                                                                                                         // 1126
   * @param {String} collection The name of the collection that contains the new document.                             // 1127
   * @param {String} id The new document's ID.                                                                         // 1128
   * @param {Object} fields The fields in the new document.  If `_id` is present it is ignored.                        // 1129
   */                                                                                                                  // 1130
  added: function (collectionName, id, fields) {                                                                       // 1131
    var self = this;                                                                                                   // 1132
    if (self._isDeactivated())                                                                                         // 1133
      return;                                                                                                          // 1134
    id = self._idFilter.idStringify(id);                                                                               // 1135
    Meteor._ensure(self._documents, collectionName)[id] = true;                                                        // 1136
    self._session.added(self._subscriptionHandle, collectionName, id, fields);                                         // 1137
  },                                                                                                                   // 1138
                                                                                                                       // 1139
  /**                                                                                                                  // 1140
   * @summary Call inside the publish function.  Informs the subscriber that a document in the record set has been modified.
   * @locus Server                                                                                                     // 1142
   * @memberOf Subscription                                                                                            // 1143
   * @instance                                                                                                         // 1144
   * @param {String} collection The name of the collection that contains the changed document.                         // 1145
   * @param {String} id The changed document's ID.                                                                     // 1146
   * @param {Object} fields The fields in the document that have changed, together with their new values.  If a field is not present in `fields` it was left unchanged; if it is present in `fields` and has a value of `undefined` it was removed from the document.  If `_id` is present it is ignored.
   */                                                                                                                  // 1148
  changed: function (collectionName, id, fields) {                                                                     // 1149
    var self = this;                                                                                                   // 1150
    if (self._isDeactivated())                                                                                         // 1151
      return;                                                                                                          // 1152
    id = self._idFilter.idStringify(id);                                                                               // 1153
    self._session.changed(self._subscriptionHandle, collectionName, id, fields);                                       // 1154
  },                                                                                                                   // 1155
                                                                                                                       // 1156
  /**                                                                                                                  // 1157
   * @summary Call inside the publish function.  Informs the subscriber that a document has been removed from the record set.
   * @locus Server                                                                                                     // 1159
   * @memberOf Subscription                                                                                            // 1160
   * @instance                                                                                                         // 1161
   * @param {String} collection The name of the collection that the document has been removed from.                    // 1162
   * @param {String} id The ID of the document that has been removed.                                                  // 1163
   */                                                                                                                  // 1164
  removed: function (collectionName, id) {                                                                             // 1165
    var self = this;                                                                                                   // 1166
    if (self._isDeactivated())                                                                                         // 1167
      return;                                                                                                          // 1168
    id = self._idFilter.idStringify(id);                                                                               // 1169
    // We don't bother to delete sets of things in a collection if the                                                 // 1170
    // collection is empty.  It could break _removeAllDocuments.                                                       // 1171
    delete self._documents[collectionName][id];                                                                        // 1172
    self._session.removed(self._subscriptionHandle, collectionName, id);                                               // 1173
  },                                                                                                                   // 1174
                                                                                                                       // 1175
  /**                                                                                                                  // 1176
   * @summary Call inside the publish function.  Informs the subscriber that an initial, complete snapshot of the record set has been sent.  This will trigger a call on the client to the `onReady` callback passed to  [`Meteor.subscribe`](#meteor_subscribe), if any.
   * @locus Server                                                                                                     // 1178
   * @memberOf Subscription                                                                                            // 1179
   * @instance                                                                                                         // 1180
   */                                                                                                                  // 1181
  ready: function () {                                                                                                 // 1182
    var self = this;                                                                                                   // 1183
    if (self._isDeactivated())                                                                                         // 1184
      return;                                                                                                          // 1185
    if (!self._subscriptionId)                                                                                         // 1186
      return;  // unnecessary but ignored for universal sub                                                            // 1187
    if (!self._ready) {                                                                                                // 1188
      self._session.sendReady([self._subscriptionId]);                                                                 // 1189
      self._ready = true;                                                                                              // 1190
    }                                                                                                                  // 1191
  }                                                                                                                    // 1192
});                                                                                                                    // 1193
                                                                                                                       // 1194
/******************************************************************************/                                       // 1195
/* Server                                                                     */                                       // 1196
/******************************************************************************/                                       // 1197
                                                                                                                       // 1198
Server = function (options) {                                                                                          // 1199
  var self = this;                                                                                                     // 1200
                                                                                                                       // 1201
  // The default heartbeat interval is 30 seconds on the server and 35                                                 // 1202
  // seconds on the client.  Since the client doesn't need to send a                                                   // 1203
  // ping as long as it is receiving pings, this means that pings                                                      // 1204
  // normally go from the server to the client.                                                                        // 1205
  self.options = _.defaults(options || {}, {                                                                           // 1206
    heartbeatInterval: 30000,                                                                                          // 1207
    heartbeatTimeout: 15000,                                                                                           // 1208
    // For testing, allow responding to pings to be disabled.                                                          // 1209
    respondToPings: true                                                                                               // 1210
  });                                                                                                                  // 1211
                                                                                                                       // 1212
  // Map of callbacks to call when a new connection comes in to the                                                    // 1213
  // server and completes DDP version negotiation. Use an object instead                                               // 1214
  // of an array so we can safely remove one from the list while                                                       // 1215
  // iterating over it.                                                                                                // 1216
  self.onConnectionHook = new Hook({                                                                                   // 1217
    debugPrintExceptions: "onConnection callback"                                                                      // 1218
  });                                                                                                                  // 1219
                                                                                                                       // 1220
  self.publish_handlers = {};                                                                                          // 1221
  self.universal_publish_handlers = [];                                                                                // 1222
                                                                                                                       // 1223
  self.method_handlers = {};                                                                                           // 1224
                                                                                                                       // 1225
  self.sessions = {}; // map from id to session                                                                        // 1226
                                                                                                                       // 1227
  self.stream_server = new StreamServer;                                                                               // 1228
                                                                                                                       // 1229
  self.stream_server.register(function (socket) {                                                                      // 1230
    // socket implements the SockJSConnection interface                                                                // 1231
    socket._meteorSession = null;                                                                                      // 1232
                                                                                                                       // 1233
    var sendError = function (reason, offendingMessage) {                                                              // 1234
      var msg = {msg: 'error', reason: reason};                                                                        // 1235
      if (offendingMessage)                                                                                            // 1236
        msg.offendingMessage = offendingMessage;                                                                       // 1237
      socket.send(stringifyDDP(msg));                                                                                  // 1238
    };                                                                                                                 // 1239
                                                                                                                       // 1240
    socket.on('data', function (raw_msg) {                                                                             // 1241
      if (Meteor._printReceivedDDP) {                                                                                  // 1242
        Meteor._debug("Received DDP", raw_msg);                                                                        // 1243
      }                                                                                                                // 1244
      try {                                                                                                            // 1245
        try {                                                                                                          // 1246
          var msg = parseDDP(raw_msg);                                                                                 // 1247
        } catch (err) {                                                                                                // 1248
          sendError('Parse error');                                                                                    // 1249
          return;                                                                                                      // 1250
        }                                                                                                              // 1251
        if (msg === null || !msg.msg) {                                                                                // 1252
          sendError('Bad request', msg);                                                                               // 1253
          return;                                                                                                      // 1254
        }                                                                                                              // 1255
                                                                                                                       // 1256
        if (msg.msg === 'connect') {                                                                                   // 1257
          if (socket._meteorSession) {                                                                                 // 1258
            sendError("Already connected", msg);                                                                       // 1259
            return;                                                                                                    // 1260
          }                                                                                                            // 1261
          Fiber(function () {                                                                                          // 1262
            self._handleConnect(socket, msg);                                                                          // 1263
          }).run();                                                                                                    // 1264
          return;                                                                                                      // 1265
        }                                                                                                              // 1266
                                                                                                                       // 1267
        if (!socket._meteorSession) {                                                                                  // 1268
          sendError('Must connect first', msg);                                                                        // 1269
          return;                                                                                                      // 1270
        }                                                                                                              // 1271
        socket._meteorSession.processMessage(msg);                                                                     // 1272
      } catch (e) {                                                                                                    // 1273
        // XXX print stack nicely                                                                                      // 1274
        Meteor._debug("Internal exception while processing message", msg,                                              // 1275
                      e.message, e.stack);                                                                             // 1276
      }                                                                                                                // 1277
    });                                                                                                                // 1278
                                                                                                                       // 1279
    socket.on('close', function () {                                                                                   // 1280
      if (socket._meteorSession) {                                                                                     // 1281
        Fiber(function () {                                                                                            // 1282
          socket._meteorSession.close();                                                                               // 1283
        }).run();                                                                                                      // 1284
      }                                                                                                                // 1285
    });                                                                                                                // 1286
  });                                                                                                                  // 1287
};                                                                                                                     // 1288
                                                                                                                       // 1289
_.extend(Server.prototype, {                                                                                           // 1290
                                                                                                                       // 1291
  /**                                                                                                                  // 1292
   * @summary Register a callback to be called when a new DDP connection is made to the server.                        // 1293
   * @locus Server                                                                                                     // 1294
   * @param {function} callback The function to call when a new DDP connection is established.                         // 1295
   * @memberOf Meteor                                                                                                  // 1296
   */                                                                                                                  // 1297
  onConnection: function (fn) {                                                                                        // 1298
    var self = this;                                                                                                   // 1299
    return self.onConnectionHook.register(fn);                                                                         // 1300
  },                                                                                                                   // 1301
                                                                                                                       // 1302
  _handleConnect: function (socket, msg) {                                                                             // 1303
    var self = this;                                                                                                   // 1304
                                                                                                                       // 1305
    // The connect message must specify a version and an array of supported                                            // 1306
    // versions, and it must claim to support what it is proposing.                                                    // 1307
    if (!(typeof (msg.version) === 'string' &&                                                                         // 1308
          _.isArray(msg.support) &&                                                                                    // 1309
          _.all(msg.support, _.isString) &&                                                                            // 1310
          _.contains(msg.support, msg.version))) {                                                                     // 1311
      socket.send(stringifyDDP({msg: 'failed',                                                                         // 1312
                                version: SUPPORTED_DDP_VERSIONS[0]}));                                                 // 1313
      socket.close();                                                                                                  // 1314
      return;                                                                                                          // 1315
    }                                                                                                                  // 1316
                                                                                                                       // 1317
    // In the future, handle session resumption: something like:                                                       // 1318
    //  socket._meteorSession = self.sessions[msg.session]                                                             // 1319
    var version = calculateVersion(msg.support, SUPPORTED_DDP_VERSIONS);                                               // 1320
                                                                                                                       // 1321
    if (msg.version !== version) {                                                                                     // 1322
      // The best version to use (according to the client's stated preferences)                                        // 1323
      // is not the one the client is trying to use. Inform them about the best                                        // 1324
      // version to use.                                                                                               // 1325
      socket.send(stringifyDDP({msg: 'failed', version: version}));                                                    // 1326
      socket.close();                                                                                                  // 1327
      return;                                                                                                          // 1328
    }                                                                                                                  // 1329
                                                                                                                       // 1330
    // Yay, version matches! Create a new session.                                                                     // 1331
    socket._meteorSession = new Session(self, version, socket, self.options);                                          // 1332
    self.sessions[socket._meteorSession.id] = socket._meteorSession;                                                   // 1333
    self.onConnectionHook.each(function (callback) {                                                                   // 1334
      if (socket._meteorSession)                                                                                       // 1335
        callback(socket._meteorSession.connectionHandle);                                                              // 1336
      return true;                                                                                                     // 1337
    });                                                                                                                // 1338
  },                                                                                                                   // 1339
  /**                                                                                                                  // 1340
   * Register a publish handler function.                                                                              // 1341
   *                                                                                                                   // 1342
   * @param name {String} identifier for query                                                                         // 1343
   * @param handler {Function} publish handler                                                                         // 1344
   * @param options {Object}                                                                                           // 1345
   *                                                                                                                   // 1346
   * Server will call handler function on each new subscription,                                                       // 1347
   * either when receiving DDP sub message for a named subscription, or on                                             // 1348
   * DDP connect for a universal subscription.                                                                         // 1349
   *                                                                                                                   // 1350
   * If name is null, this will be a subscription that is                                                              // 1351
   * automatically established and permanently on for all connected                                                    // 1352
   * client, instead of a subscription that can be turned on and off                                                   // 1353
   * with subscribe().                                                                                                 // 1354
   *                                                                                                                   // 1355
   * options to contain:                                                                                               // 1356
   *  - (mostly internal) is_auto: true if generated automatically                                                     // 1357
   *    from an autopublish hook. this is for cosmetic purposes only                                                   // 1358
   *    (it lets us determine whether to print a warning suggesting                                                    // 1359
   *    that you turn off autopublish.)                                                                                // 1360
   */                                                                                                                  // 1361
                                                                                                                       // 1362
  /**                                                                                                                  // 1363
   * @summary Publish a record set.                                                                                    // 1364
   * @memberOf Meteor                                                                                                  // 1365
   * @locus Server                                                                                                     // 1366
   * @param {String} name Name of the record set.  If `null`, the set has no name, and the record set is automatically sent to all connected clients.
   * @param {Function} func Function called on the server each time a client subscribes.  Inside the function, `this` is the publish handler object, described below.  If the client passed arguments to `subscribe`, the function is called with the same arguments.
   */                                                                                                                  // 1369
  publish: function (name, handler, options) {                                                                         // 1370
    var self = this;                                                                                                   // 1371
                                                                                                                       // 1372
    options = options || {};                                                                                           // 1373
                                                                                                                       // 1374
    if (name && name in self.publish_handlers) {                                                                       // 1375
      Meteor._debug("Ignoring duplicate publish named '" + name + "'");                                                // 1376
      return;                                                                                                          // 1377
    }                                                                                                                  // 1378
                                                                                                                       // 1379
    if (Package.autopublish && !options.is_auto) {                                                                     // 1380
      // They have autopublish on, yet they're trying to manually                                                      // 1381
      // picking stuff to publish. They probably should turn off                                                       // 1382
      // autopublish. (This check isn't perfect -- if you create a                                                     // 1383
      // publish before you turn on autopublish, it won't catch                                                        // 1384
      // it. But this will definitely handle the simple case where                                                     // 1385
      // you've added the autopublish package to your app, and are                                                     // 1386
      // calling publish from your app code.)                                                                          // 1387
      if (!self.warned_about_autopublish) {                                                                            // 1388
        self.warned_about_autopublish = true;                                                                          // 1389
        Meteor._debug(                                                                                                 // 1390
"** You've set up some data subscriptions with Meteor.publish(), but\n" +                                              // 1391
"** you still have autopublish turned on. Because autopublish is still\n" +                                            // 1392
"** on, your Meteor.publish() calls won't have much effect. All data\n" +                                              // 1393
"** will still be sent to all clients.\n" +                                                                            // 1394
"**\n" +                                                                                                               // 1395
"** Turn off autopublish by removing the autopublish package:\n" +                                                     // 1396
"**\n" +                                                                                                               // 1397
"**   $ meteor remove autopublish\n" +                                                                                 // 1398
"**\n" +                                                                                                               // 1399
"** .. and make sure you have Meteor.publish() and Meteor.subscribe() calls\n" +                                       // 1400
"** for each collection that you want clients to see.\n");                                                             // 1401
      }                                                                                                                // 1402
    }                                                                                                                  // 1403
                                                                                                                       // 1404
    if (name)                                                                                                          // 1405
      self.publish_handlers[name] = handler;                                                                           // 1406
    else {                                                                                                             // 1407
      self.universal_publish_handlers.push(handler);                                                                   // 1408
      // Spin up the new publisher on any existing session too. Run each                                               // 1409
      // session's subscription in a new Fiber, so that there's no change for                                          // 1410
      // self.sessions to change while we're running this loop.                                                        // 1411
      _.each(self.sessions, function (session) {                                                                       // 1412
        if (!session._dontStartNewUniversalSubs) {                                                                     // 1413
          Fiber(function() {                                                                                           // 1414
            session._startSubscription(handler);                                                                       // 1415
          }).run();                                                                                                    // 1416
        }                                                                                                              // 1417
      });                                                                                                              // 1418
    }                                                                                                                  // 1419
  },                                                                                                                   // 1420
                                                                                                                       // 1421
  _removeSession: function (session) {                                                                                 // 1422
    var self = this;                                                                                                   // 1423
    if (self.sessions[session.id]) {                                                                                   // 1424
      delete self.sessions[session.id];                                                                                // 1425
    }                                                                                                                  // 1426
  },                                                                                                                   // 1427
                                                                                                                       // 1428
  /**                                                                                                                  // 1429
   * @summary Defines functions that can be invoked over the network by clients.                                       // 1430
   * @locus Anywhere                                                                                                   // 1431
   * @param {Object} methods Dictionary whose keys are method names and values are functions.                          // 1432
   * @memberOf Meteor                                                                                                  // 1433
   */                                                                                                                  // 1434
  methods: function (methods) {                                                                                        // 1435
    var self = this;                                                                                                   // 1436
    _.each(methods, function (func, name) {                                                                            // 1437
      if (self.method_handlers[name])                                                                                  // 1438
        throw new Error("A method named '" + name + "' is already defined");                                           // 1439
      self.method_handlers[name] = func;                                                                               // 1440
    });                                                                                                                // 1441
  },                                                                                                                   // 1442
                                                                                                                       // 1443
  call: function (name /*, arguments */) {                                                                             // 1444
    // if it's a function, the last argument is the result callback,                                                   // 1445
    // not a parameter to the remote method.                                                                           // 1446
    var args = Array.prototype.slice.call(arguments, 1);                                                               // 1447
    if (args.length && typeof args[args.length - 1] === "function")                                                    // 1448
      var callback = args.pop();                                                                                       // 1449
    return this.apply(name, args, callback);                                                                           // 1450
  },                                                                                                                   // 1451
                                                                                                                       // 1452
  // @param options {Optional Object}                                                                                  // 1453
  // @param callback {Optional Function}                                                                               // 1454
  apply: function (name, args, options, callback) {                                                                    // 1455
    var self = this;                                                                                                   // 1456
                                                                                                                       // 1457
    // We were passed 3 arguments. They may be either (name, args, options)                                            // 1458
    // or (name, args, callback)                                                                                       // 1459
    if (!callback && typeof options === 'function') {                                                                  // 1460
      callback = options;                                                                                              // 1461
      options = {};                                                                                                    // 1462
    }                                                                                                                  // 1463
    options = options || {};                                                                                           // 1464
                                                                                                                       // 1465
    if (callback)                                                                                                      // 1466
      // It's not really necessary to do this, since we immediately                                                    // 1467
      // run the callback in this fiber before returning, but we do it                                                 // 1468
      // anyway for regularity.                                                                                        // 1469
      // XXX improve error message (and how we report it)                                                              // 1470
      callback = Meteor.bindEnvironment(                                                                               // 1471
        callback,                                                                                                      // 1472
        "delivering result of invoking '" + name + "'"                                                                 // 1473
      );                                                                                                               // 1474
                                                                                                                       // 1475
    // Run the handler                                                                                                 // 1476
    var handler = self.method_handlers[name];                                                                          // 1477
    var exception;                                                                                                     // 1478
    if (!handler) {                                                                                                    // 1479
      exception = new Meteor.Error(404, "Method not found");                                                           // 1480
    } else {                                                                                                           // 1481
      // If this is a method call from within another method, get the                                                  // 1482
      // user state from the outer method, otherwise don't allow                                                       // 1483
      // setUserId to be called                                                                                        // 1484
      var userId = null;                                                                                               // 1485
      var setUserId = function() {                                                                                     // 1486
        throw new Error("Can't call setUserId on a server initiated method call");                                     // 1487
      };                                                                                                               // 1488
      var connection = null;                                                                                           // 1489
      var currentInvocation = DDP._CurrentInvocation.get();                                                            // 1490
      if (currentInvocation) {                                                                                         // 1491
        userId = currentInvocation.userId;                                                                             // 1492
        setUserId = function(userId) {                                                                                 // 1493
          currentInvocation.setUserId(userId);                                                                         // 1494
        };                                                                                                             // 1495
        connection = currentInvocation.connection;                                                                     // 1496
      }                                                                                                                // 1497
                                                                                                                       // 1498
      var invocation = new MethodInvocation({                                                                          // 1499
        isSimulation: false,                                                                                           // 1500
        userId: userId,                                                                                                // 1501
        setUserId: setUserId,                                                                                          // 1502
        connection: connection,                                                                                        // 1503
        randomSeed: makeRpcSeed(currentInvocation, name)                                                               // 1504
      });                                                                                                              // 1505
      try {                                                                                                            // 1506
        var result = DDP._CurrentInvocation.withValue(invocation, function () {                                        // 1507
          return maybeAuditArgumentChecks(                                                                             // 1508
            handler, invocation, EJSON.clone(args), "internal call to '" +                                             // 1509
              name + "'");                                                                                             // 1510
        });                                                                                                            // 1511
      } catch (e) {                                                                                                    // 1512
        exception = e;                                                                                                 // 1513
      }                                                                                                                // 1514
    }                                                                                                                  // 1515
                                                                                                                       // 1516
    // Return the result in whichever way the caller asked for it. Note that we                                        // 1517
    // do NOT block on the write fence in an analogous way to how the client                                           // 1518
    // blocks on the relevant data being visible, so you are NOT guaranteed that                                       // 1519
    // cursor observe callbacks have fired when your callback is invoked. (We                                          // 1520
    // can change this if there's a real use case.)                                                                    // 1521
    if (callback) {                                                                                                    // 1522
      callback(exception, result);                                                                                     // 1523
      return undefined;                                                                                                // 1524
    }                                                                                                                  // 1525
    if (exception)                                                                                                     // 1526
      throw exception;                                                                                                 // 1527
    return result;                                                                                                     // 1528
  },                                                                                                                   // 1529
                                                                                                                       // 1530
  _urlForSession: function (sessionId) {                                                                               // 1531
    var self = this;                                                                                                   // 1532
    var session = self.sessions[sessionId];                                                                            // 1533
    if (session)                                                                                                       // 1534
      return session._socketUrl;                                                                                       // 1535
    else                                                                                                               // 1536
      return null;                                                                                                     // 1537
  }                                                                                                                    // 1538
});                                                                                                                    // 1539
                                                                                                                       // 1540
var calculateVersion = function (clientSupportedVersions,                                                              // 1541
                                 serverSupportedVersions) {                                                            // 1542
  var correctVersion = _.find(clientSupportedVersions, function (version) {                                            // 1543
    return _.contains(serverSupportedVersions, version);                                                               // 1544
  });                                                                                                                  // 1545
  if (!correctVersion) {                                                                                               // 1546
    correctVersion = serverSupportedVersions[0];                                                                       // 1547
  }                                                                                                                    // 1548
  return correctVersion;                                                                                               // 1549
};                                                                                                                     // 1550
                                                                                                                       // 1551
LivedataTest.calculateVersion = calculateVersion;                                                                      // 1552
                                                                                                                       // 1553
                                                                                                                       // 1554
// "blind" exceptions other than those that were deliberately thrown to signal                                         // 1555
// errors to the client                                                                                                // 1556
var wrapInternalException = function (exception, context) {                                                            // 1557
  if (!exception || exception instanceof Meteor.Error)                                                                 // 1558
    return exception;                                                                                                  // 1559
                                                                                                                       // 1560
  // tests can set the 'expected' flag on an exception so it won't go to the                                           // 1561
  // server log                                                                                                        // 1562
  if (!exception.expected) {                                                                                           // 1563
    Meteor._debug("Exception " + context, exception.stack);                                                            // 1564
    if (exception.sanitizedError) {                                                                                    // 1565
      Meteor._debug("Sanitized and reported to the client as:", exception.sanitizedError.message);                     // 1566
      Meteor._debug();                                                                                                 // 1567
    }                                                                                                                  // 1568
  }                                                                                                                    // 1569
                                                                                                                       // 1570
  // Did the error contain more details that could have been useful if caught in                                       // 1571
  // server code (or if thrown from non-client-originated code), but also                                              // 1572
  // provided a "sanitized" version with more context than 500 Internal server                                         // 1573
  // error? Use that.                                                                                                  // 1574
  if (exception.sanitizedError) {                                                                                      // 1575
    if (exception.sanitizedError instanceof Meteor.Error)                                                              // 1576
      return exception.sanitizedError;                                                                                 // 1577
    Meteor._debug("Exception " + context + " provides a sanitizedError that " +                                        // 1578
                  "is not a Meteor.Error; ignoring");                                                                  // 1579
  }                                                                                                                    // 1580
                                                                                                                       // 1581
  return new Meteor.Error(500, "Internal server error");                                                               // 1582
};                                                                                                                     // 1583
                                                                                                                       // 1584
                                                                                                                       // 1585
// Audit argument checks, if the audit-argument-checks package exists (it is a                                         // 1586
// weak dependency of this package).                                                                                   // 1587
var maybeAuditArgumentChecks = function (f, context, args, description) {                                              // 1588
  args = args || [];                                                                                                   // 1589
  if (Package['audit-argument-checks']) {                                                                              // 1590
    return Match._failIfArgumentsAreNotAllChecked(                                                                     // 1591
      f, context, args, description);                                                                                  // 1592
  }                                                                                                                    // 1593
  return f.apply(context, args);                                                                                       // 1594
};                                                                                                                     // 1595
                                                                                                                       // 1596
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp/writefence.js                                                                                          //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
var path = Npm.require('path');                                                                                        // 1
var Future = Npm.require(path.join('fibers', 'future'));                                                               // 2
                                                                                                                       // 3
// A write fence collects a group of writes, and provides a callback                                                   // 4
// when all of the writes are fully committed and propagated (all                                                      // 5
// observers have been notified of the write and acknowledged it.)                                                     // 6
//                                                                                                                     // 7
DDPServer._WriteFence = function () {                                                                                  // 8
  var self = this;                                                                                                     // 9
                                                                                                                       // 10
  self.armed = false;                                                                                                  // 11
  self.fired = false;                                                                                                  // 12
  self.retired = false;                                                                                                // 13
  self.outstanding_writes = 0;                                                                                         // 14
  self.completion_callbacks = [];                                                                                      // 15
};                                                                                                                     // 16
                                                                                                                       // 17
// The current write fence. When there is a current write fence, code                                                  // 18
// that writes to databases should register their writes with it using                                                 // 19
// beginWrite().                                                                                                       // 20
//                                                                                                                     // 21
DDPServer._CurrentWriteFence = new Meteor.EnvironmentVariable;                                                         // 22
                                                                                                                       // 23
_.extend(DDPServer._WriteFence.prototype, {                                                                            // 24
  // Start tracking a write, and return an object to represent it. The                                                 // 25
  // object has a single method, committed(). This method should be                                                    // 26
  // called when the write is fully committed and propagated. You can                                                  // 27
  // continue to add writes to the WriteFence up until it is triggered                                                 // 28
  // (calls its callbacks because all writes have committed.)                                                          // 29
  beginWrite: function () {                                                                                            // 30
    var self = this;                                                                                                   // 31
                                                                                                                       // 32
    if (self.retired)                                                                                                  // 33
      return { committed: function () {} };                                                                            // 34
                                                                                                                       // 35
    if (self.fired)                                                                                                    // 36
      throw new Error("fence has already activated -- too late to add writes");                                        // 37
                                                                                                                       // 38
    self.outstanding_writes++;                                                                                         // 39
    var committed = false;                                                                                             // 40
    return {                                                                                                           // 41
      committed: function () {                                                                                         // 42
        if (committed)                                                                                                 // 43
          throw new Error("committed called twice on the same write");                                                 // 44
        committed = true;                                                                                              // 45
        self.outstanding_writes--;                                                                                     // 46
        self._maybeFire();                                                                                             // 47
      }                                                                                                                // 48
    };                                                                                                                 // 49
  },                                                                                                                   // 50
                                                                                                                       // 51
  // Arm the fence. Once the fence is armed, and there are no more                                                     // 52
  // uncommitted writes, it will activate.                                                                             // 53
  arm: function () {                                                                                                   // 54
    var self = this;                                                                                                   // 55
    if (self === DDPServer._CurrentWriteFence.get())                                                                   // 56
      throw Error("Can't arm the current fence");                                                                      // 57
    self.armed = true;                                                                                                 // 58
    self._maybeFire();                                                                                                 // 59
  },                                                                                                                   // 60
                                                                                                                       // 61
  // Register a function to be called when the fence fires.                                                            // 62
  onAllCommitted: function (func) {                                                                                    // 63
    var self = this;                                                                                                   // 64
    if (self.fired)                                                                                                    // 65
      throw new Error("fence has already activated -- too late to " +                                                  // 66
                      "add a callback");                                                                               // 67
    self.completion_callbacks.push(func);                                                                              // 68
  },                                                                                                                   // 69
                                                                                                                       // 70
  // Convenience function. Arms the fence, then blocks until it fires.                                                 // 71
  armAndWait: function () {                                                                                            // 72
    var self = this;                                                                                                   // 73
    var future = new Future;                                                                                           // 74
    self.onAllCommitted(function () {                                                                                  // 75
      future['return']();                                                                                              // 76
    });                                                                                                                // 77
    self.arm();                                                                                                        // 78
    future.wait();                                                                                                     // 79
  },                                                                                                                   // 80
                                                                                                                       // 81
  _maybeFire: function () {                                                                                            // 82
    var self = this;                                                                                                   // 83
    if (self.fired)                                                                                                    // 84
      throw new Error("write fence already activated?");                                                               // 85
    if (self.armed && !self.outstanding_writes) {                                                                      // 86
      self.fired = true;                                                                                               // 87
      _.each(self.completion_callbacks, function (f) {f(self);});                                                      // 88
      self.completion_callbacks = [];                                                                                  // 89
    }                                                                                                                  // 90
  },                                                                                                                   // 91
                                                                                                                       // 92
  // Deactivate this fence so that adding more writes has no effect.                                                   // 93
  // The fence must have already fired.                                                                                // 94
  retire: function () {                                                                                                // 95
    var self = this;                                                                                                   // 96
    if (! self.fired)                                                                                                  // 97
      throw new Error("Can't retire a fence that hasn't fired.");                                                      // 98
    self.retired = true;                                                                                               // 99
  }                                                                                                                    // 100
});                                                                                                                    // 101
                                                                                                                       // 102
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp/crossbar.js                                                                                            //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
// A "crossbar" is a class that provides structured notification registration.                                         // 1
                                                                                                                       // 2
DDPServer._Crossbar = function (options) {                                                                             // 3
  var self = this;                                                                                                     // 4
  options = options || {};                                                                                             // 5
                                                                                                                       // 6
  self.nextId = 1;                                                                                                     // 7
  // map from listener id to object. each object has keys 'trigger',                                                   // 8
  // 'callback'.                                                                                                       // 9
  self.listeners = {};                                                                                                 // 10
  self.factPackage = options.factPackage || "livedata";                                                                // 11
  self.factName = options.factName || null;                                                                            // 12
};                                                                                                                     // 13
                                                                                                                       // 14
_.extend(DDPServer._Crossbar.prototype, {                                                                              // 15
  // Listen for notification that match 'trigger'. A notification                                                      // 16
  // matches if it has the key-value pairs in trigger as a                                                             // 17
  // subset. When a notification matches, call 'callback', passing                                                     // 18
  // the actual notification.                                                                                          // 19
  //                                                                                                                   // 20
  // Returns a listen handle, which is an object with a method                                                         // 21
  // stop(). Call stop() to stop listening.                                                                            // 22
  //                                                                                                                   // 23
  // XXX It should be legal to call fire() from inside a listen()                                                      // 24
  // callback?                                                                                                         // 25
  listen: function (trigger, callback) {                                                                               // 26
    var self = this;                                                                                                   // 27
    var id = self.nextId++;                                                                                            // 28
    self.listeners[id] = {trigger: EJSON.clone(trigger), callback: callback};                                          // 29
    if (self.factName && Package.facts) {                                                                              // 30
      Package.facts.Facts.incrementServerFact(                                                                         // 31
        self.factPackage, self.factName, 1);                                                                           // 32
    }                                                                                                                  // 33
    return {                                                                                                           // 34
      stop: function () {                                                                                              // 35
        if (self.factName && Package.facts) {                                                                          // 36
          Package.facts.Facts.incrementServerFact(                                                                     // 37
            self.factPackage, self.factName, -1);                                                                      // 38
        }                                                                                                              // 39
        delete self.listeners[id];                                                                                     // 40
      }                                                                                                                // 41
    };                                                                                                                 // 42
  },                                                                                                                   // 43
                                                                                                                       // 44
  // Fire the provided 'notification' (an object whose attribute                                                       // 45
  // values are all JSON-compatibile) -- inform all matching listeners                                                 // 46
  // (registered with listen()).                                                                                       // 47
  //                                                                                                                   // 48
  // If fire() is called inside a write fence, then each of the                                                        // 49
  // listener callbacks will be called inside the write fence as well.                                                 // 50
  //                                                                                                                   // 51
  // The listeners may be invoked in parallel, rather than serially.                                                   // 52
  fire: function (notification) {                                                                                      // 53
    var self = this;                                                                                                   // 54
    // Listener callbacks can yield, so we need to first find all the ones that                                        // 55
    // match in a single iteration over self.listeners (which can't be mutated                                         // 56
    // during this iteration), and then invoke the matching callbacks, checking                                        // 57
    // before each call to ensure they are still in self.listeners.                                                    // 58
    var matchingCallbacks = {};                                                                                        // 59
    // XXX consider refactoring to "index" on "collection"                                                             // 60
    _.each(self.listeners, function (l, id) {                                                                          // 61
      if (self._matches(notification, l.trigger))                                                                      // 62
        matchingCallbacks[id] = l.callback;                                                                            // 63
    });                                                                                                                // 64
                                                                                                                       // 65
    _.each(matchingCallbacks, function (c, id) {                                                                       // 66
      if (_.has(self.listeners, id))                                                                                   // 67
        c(notification);                                                                                               // 68
    });                                                                                                                // 69
  },                                                                                                                   // 70
                                                                                                                       // 71
  // A notification matches a trigger if all keys that exist in both are equal.                                        // 72
  //                                                                                                                   // 73
  // Examples:                                                                                                         // 74
  //  N:{collection: "C"} matches T:{collection: "C"}                                                                  // 75
  //    (a non-targeted write to a collection matches a                                                                // 76
  //     non-targeted query)                                                                                           // 77
  //  N:{collection: "C", id: "X"} matches T:{collection: "C"}                                                         // 78
  //    (a targeted write to a collection matches a non-targeted query)                                                // 79
  //  N:{collection: "C"} matches T:{collection: "C", id: "X"}                                                         // 80
  //    (a non-targeted write to a collection matches a                                                                // 81
  //     targeted query)                                                                                               // 82
  //  N:{collection: "C", id: "X"} matches T:{collection: "C", id: "X"}                                                // 83
  //    (a targeted write to a collection matches a targeted query targeted                                            // 84
  //     at the same document)                                                                                         // 85
  //  N:{collection: "C", id: "X"} does not match T:{collection: "C", id: "Y"}                                         // 86
  //    (a targeted write to a collection does not match a targeted query                                              // 87
  //     targeted at a different document)                                                                             // 88
  _matches: function (notification, trigger) {                                                                         // 89
    return _.all(trigger, function (triggerValue, key) {                                                               // 90
      return !_.has(notification, key) ||                                                                              // 91
        EJSON.equals(triggerValue, notification[key]);                                                                 // 92
    });                                                                                                                // 93
  }                                                                                                                    // 94
});                                                                                                                    // 95
                                                                                                                       // 96
// The "invalidation crossbar" is a specific instance used by the DDP server to                                        // 97
// implement write fence notifications. Listener callbacks on this crossbar                                            // 98
// should call beginWrite on the current write fence before they return, if they                                       // 99
// want to delay the write fence from firing (ie, the DDP method-data-updated                                          // 100
// message from being sent).                                                                                           // 101
DDPServer._InvalidationCrossbar = new DDPServer._Crossbar({                                                            // 102
  factName: "invalidation-crossbar-listeners"                                                                          // 103
});                                                                                                                    // 104
                                                                                                                       // 105
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp/livedata_common.js                                                                                     //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
// All the supported versions (for both the client and server)                                                         // 1
// These must be in order of preference; most favored-first                                                            // 2
SUPPORTED_DDP_VERSIONS = [ '1', 'pre2', 'pre1' ];                                                                      // 3
                                                                                                                       // 4
LivedataTest.SUPPORTED_DDP_VERSIONS = SUPPORTED_DDP_VERSIONS;                                                          // 5
                                                                                                                       // 6
// Instance name is this because it is usually referred to as this inside a                                            // 7
// method definition                                                                                                   // 8
/**                                                                                                                    // 9
 * @summary The state for a single invocation of a method, referenced by this                                          // 10
 * inside a method definition.                                                                                         // 11
 * @param {Object} options                                                                                             // 12
 * @instanceName this                                                                                                  // 13
 */                                                                                                                    // 14
MethodInvocation = function (options) {                                                                                // 15
  var self = this;                                                                                                     // 16
                                                                                                                       // 17
  // true if we're running not the actual method, but a stub (that is,                                                 // 18
  // if we're on a client (which may be a browser, or in the future a                                                  // 19
  // server connecting to another server) and presently running a                                                      // 20
  // simulation of a server-side method for latency compensation                                                       // 21
  // purposes). not currently true except in a client such as a browser,                                               // 22
  // since there's usually no point in running stubs unless you have a                                                 // 23
  // zero-latency connection to the user.                                                                              // 24
                                                                                                                       // 25
  /**                                                                                                                  // 26
   * @summary Access inside a method invocation.  Boolean value, true if this invocation is a stub.                    // 27
   * @locus Anywhere                                                                                                   // 28
   * @name  isSimulation                                                                                               // 29
   * @memberOf MethodInvocation                                                                                        // 30
   * @instance                                                                                                         // 31
   */                                                                                                                  // 32
  this.isSimulation = options.isSimulation;                                                                            // 33
                                                                                                                       // 34
  // call this function to allow other method invocations (from the                                                    // 35
  // same client) to continue running without waiting for this one to                                                  // 36
  // complete.                                                                                                         // 37
  this._unblock = options.unblock || function () {};                                                                   // 38
  this._calledUnblock = false;                                                                                         // 39
                                                                                                                       // 40
  // current user id                                                                                                   // 41
                                                                                                                       // 42
  /**                                                                                                                  // 43
   * @summary The id of the user that made this method call, or `null` if no user was logged in.                       // 44
   * @locus Anywhere                                                                                                   // 45
   * @name  userId                                                                                                     // 46
   * @memberOf MethodInvocation                                                                                        // 47
   * @instance                                                                                                         // 48
   */                                                                                                                  // 49
  this.userId = options.userId;                                                                                        // 50
                                                                                                                       // 51
  // sets current user id in all appropriate server contexts and                                                       // 52
  // reruns subscriptions                                                                                              // 53
  this._setUserId = options.setUserId || function () {};                                                               // 54
                                                                                                                       // 55
  // On the server, the connection this method call came in on.                                                        // 56
                                                                                                                       // 57
  /**                                                                                                                  // 58
   * @summary Access inside a method invocation. The [connection](#meteor_onconnection) that this method was received on. `null` if the method is not associated with a connection, eg. a server initiated method call.
   * @locus Server                                                                                                     // 60
   * @name  connection                                                                                                 // 61
   * @memberOf MethodInvocation                                                                                        // 62
   * @instance                                                                                                         // 63
   */                                                                                                                  // 64
  this.connection = options.connection;                                                                                // 65
                                                                                                                       // 66
  // The seed for randomStream value generation                                                                        // 67
  this.randomSeed = options.randomSeed;                                                                                // 68
                                                                                                                       // 69
  // This is set by RandomStream.get; and holds the random stream state                                                // 70
  this.randomStream = null;                                                                                            // 71
};                                                                                                                     // 72
                                                                                                                       // 73
_.extend(MethodInvocation.prototype, {                                                                                 // 74
  /**                                                                                                                  // 75
   * @summary Call inside a method invocation.  Allow subsequent method from this client to begin running in a new fiber.
   * @locus Server                                                                                                     // 77
   * @memberOf MethodInvocation                                                                                        // 78
   * @instance                                                                                                         // 79
   */                                                                                                                  // 80
  unblock: function () {                                                                                               // 81
    var self = this;                                                                                                   // 82
    self._calledUnblock = true;                                                                                        // 83
    self._unblock();                                                                                                   // 84
  },                                                                                                                   // 85
                                                                                                                       // 86
  /**                                                                                                                  // 87
   * @summary Set the logged in user.                                                                                  // 88
   * @locus Server                                                                                                     // 89
   * @memberOf MethodInvocation                                                                                        // 90
   * @instance                                                                                                         // 91
   * @param {String | null} userId The value that should be returned by `userId` on this connection.                   // 92
   */                                                                                                                  // 93
  setUserId: function(userId) {                                                                                        // 94
    var self = this;                                                                                                   // 95
    if (self._calledUnblock)                                                                                           // 96
      throw new Error("Can't call setUserId in a method after calling unblock");                                       // 97
    self.userId = userId;                                                                                              // 98
    self._setUserId(userId);                                                                                           // 99
  }                                                                                                                    // 100
});                                                                                                                    // 101
                                                                                                                       // 102
parseDDP = function (stringMessage) {                                                                                  // 103
  try {                                                                                                                // 104
    var msg = JSON.parse(stringMessage);                                                                               // 105
  } catch (e) {                                                                                                        // 106
    Meteor._debug("Discarding message with invalid JSON", stringMessage);                                              // 107
    return null;                                                                                                       // 108
  }                                                                                                                    // 109
  // DDP messages must be objects.                                                                                     // 110
  if (msg === null || typeof msg !== 'object') {                                                                       // 111
    Meteor._debug("Discarding non-object DDP message", stringMessage);                                                 // 112
    return null;                                                                                                       // 113
  }                                                                                                                    // 114
                                                                                                                       // 115
  // massage msg to get it into "abstract ddp" rather than "wire ddp" format.                                          // 116
                                                                                                                       // 117
  // switch between "cleared" rep of unsetting fields and "undefined"                                                  // 118
  // rep of same                                                                                                       // 119
  if (_.has(msg, 'cleared')) {                                                                                         // 120
    if (!_.has(msg, 'fields'))                                                                                         // 121
      msg.fields = {};                                                                                                 // 122
    _.each(msg.cleared, function (clearKey) {                                                                          // 123
      msg.fields[clearKey] = undefined;                                                                                // 124
    });                                                                                                                // 125
    delete msg.cleared;                                                                                                // 126
  }                                                                                                                    // 127
                                                                                                                       // 128
  _.each(['fields', 'params', 'result'], function (field) {                                                            // 129
    if (_.has(msg, field))                                                                                             // 130
      msg[field] = EJSON._adjustTypesFromJSONValue(msg[field]);                                                        // 131
  });                                                                                                                  // 132
                                                                                                                       // 133
  return msg;                                                                                                          // 134
};                                                                                                                     // 135
                                                                                                                       // 136
stringifyDDP = function (msg) {                                                                                        // 137
  var copy = EJSON.clone(msg);                                                                                         // 138
  // swizzle 'changed' messages from 'fields undefined' rep to 'fields                                                 // 139
  // and cleared' rep                                                                                                  // 140
  if (_.has(msg, 'fields')) {                                                                                          // 141
    var cleared = [];                                                                                                  // 142
    _.each(msg.fields, function (value, key) {                                                                         // 143
      if (value === undefined) {                                                                                       // 144
        cleared.push(key);                                                                                             // 145
        delete copy.fields[key];                                                                                       // 146
      }                                                                                                                // 147
    });                                                                                                                // 148
    if (!_.isEmpty(cleared))                                                                                           // 149
      copy.cleared = cleared;                                                                                          // 150
    if (_.isEmpty(copy.fields))                                                                                        // 151
      delete copy.fields;                                                                                              // 152
  }                                                                                                                    // 153
  // adjust types to basic                                                                                             // 154
  _.each(['fields', 'params', 'result'], function (field) {                                                            // 155
    if (_.has(copy, field))                                                                                            // 156
      copy[field] = EJSON._adjustTypesToJSONValue(copy[field]);                                                        // 157
  });                                                                                                                  // 158
  if (msg.id && typeof msg.id !== 'string') {                                                                          // 159
    throw new Error("Message id is not a string");                                                                     // 160
  }                                                                                                                    // 161
  return JSON.stringify(copy);                                                                                         // 162
};                                                                                                                     // 163
                                                                                                                       // 164
// This is private but it's used in a few places. accounts-base uses                                                   // 165
// it to get the current user. accounts-password uses it to stash SRP                                                  // 166
// state in the DDP session. Meteor.setTimeout and friends clear                                                       // 167
// it. We can probably find a better way to factor this.                                                               // 168
DDP._CurrentInvocation = new Meteor.EnvironmentVariable;                                                               // 169
                                                                                                                       // 170
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp/random_stream.js                                                                                       //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
// RandomStream allows for generation of pseudo-random values, from a seed.                                            // 1
//                                                                                                                     // 2
// We use this for consistent 'random' numbers across the client and server.                                           // 3
// We want to generate probably-unique IDs on the client, and we ideally want                                          // 4
// the server to generate the same IDs when it executes the method.                                                    // 5
//                                                                                                                     // 6
// For generated values to be the same, we must seed ourselves the same way,                                           // 7
// and we must keep track of the current state of our pseudo-random generators.                                        // 8
// We call this state the scope. By default, we use the current DDP method                                             // 9
// invocation as our scope.  DDP now allows the client to specify a randomSeed.                                        // 10
// If a randomSeed is provided it will be used to seed our random sequences.                                           // 11
// In this way, client and server method calls will generate the same values.                                          // 12
//                                                                                                                     // 13
// We expose multiple named streams; each stream is independent                                                        // 14
// and is seeded differently (but predictably from the name).                                                          // 15
// By using multiple streams, we support reordering of requests,                                                       // 16
// as long as they occur on different streams.                                                                         // 17
//                                                                                                                     // 18
// @param options {Optional Object}                                                                                    // 19
//   seed: Array or value - Seed value(s) for the generator.                                                           // 20
//                          If an array, will be used as-is                                                            // 21
//                          If a value, will be converted to a single-value array                                      // 22
//                          If omitted, a random array will be used as the seed.                                       // 23
RandomStream = function (options) {                                                                                    // 24
  var self = this;                                                                                                     // 25
                                                                                                                       // 26
  this.seed = [].concat(options.seed || randomToken());                                                                // 27
                                                                                                                       // 28
  this.sequences = {};                                                                                                 // 29
};                                                                                                                     // 30
                                                                                                                       // 31
// Returns a random string of sufficient length for a random seed.                                                     // 32
// This is a placeholder function; a similar function is planned                                                       // 33
// for Random itself; when that is added we should remove this function,                                               // 34
// and call Random's randomToken instead.                                                                              // 35
function randomToken() {                                                                                               // 36
  return Random.hexString(20);                                                                                         // 37
};                                                                                                                     // 38
                                                                                                                       // 39
// Returns the random stream with the specified name, in the specified scope.                                          // 40
// If scope is null (or otherwise falsey) then we will use Random, which will                                          // 41
// give us as random numbers as possible, but won't produce the same                                                   // 42
// values across client and server.                                                                                    // 43
// However, scope will normally be the current DDP method invocation, so                                               // 44
// we'll use the stream with the specified name, and we should get consistent                                          // 45
// values on the client and server sides of a method call.                                                             // 46
RandomStream.get = function (scope, name) {                                                                            // 47
  if (!name) {                                                                                                         // 48
    name = "default";                                                                                                  // 49
  }                                                                                                                    // 50
  if (!scope) {                                                                                                        // 51
    // There was no scope passed in;                                                                                   // 52
    // the sequence won't actually be reproducible.                                                                    // 53
    return Random;                                                                                                     // 54
  }                                                                                                                    // 55
  var randomStream = scope.randomStream;                                                                               // 56
  if (!randomStream) {                                                                                                 // 57
    scope.randomStream = randomStream = new RandomStream({                                                             // 58
      seed: scope.randomSeed                                                                                           // 59
    });                                                                                                                // 60
  }                                                                                                                    // 61
  return randomStream._sequence(name);                                                                                 // 62
};                                                                                                                     // 63
                                                                                                                       // 64
// Returns the named sequence of pseudo-random values.                                                                 // 65
// The scope will be DDP._CurrentInvocation.get(), so the stream will produce                                          // 66
// consistent values for method calls on the client and server.                                                        // 67
DDP.randomStream = function (name) {                                                                                   // 68
  var scope = DDP._CurrentInvocation.get();                                                                            // 69
  return RandomStream.get(scope, name);                                                                                // 70
};                                                                                                                     // 71
                                                                                                                       // 72
// Creates a randomSeed for passing to a method call.                                                                  // 73
// Note that we take enclosing as an argument,                                                                         // 74
// though we expect it to be DDP._CurrentInvocation.get()                                                              // 75
// However, we often evaluate makeRpcSeed lazily, and thus the relevant                                                // 76
// invocation may not be the one currently in scope.                                                                   // 77
// If enclosing is null, we'll use Random and values won't be repeatable.                                              // 78
makeRpcSeed = function (enclosing, methodName) {                                                                       // 79
  var stream = RandomStream.get(enclosing, '/rpc/' + methodName);                                                      // 80
  return stream.hexString(20);                                                                                         // 81
};                                                                                                                     // 82
                                                                                                                       // 83
_.extend(RandomStream.prototype, {                                                                                     // 84
  // Get a random sequence with the specified name, creating it if does not exist.                                     // 85
  // New sequences are seeded with the seed concatenated with the name.                                                // 86
  // By passing a seed into Random.create, we use the Alea generator.                                                  // 87
  _sequence: function (name) {                                                                                         // 88
    var self = this;                                                                                                   // 89
                                                                                                                       // 90
    var sequence = self.sequences[name] || null;                                                                       // 91
    if (sequence === null) {                                                                                           // 92
      var sequenceSeed = self.seed.concat(name);                                                                       // 93
      for (var i = 0; i < sequenceSeed.length; i++) {                                                                  // 94
        if (_.isFunction(sequenceSeed[i])) {                                                                           // 95
          sequenceSeed[i] = sequenceSeed[i]();                                                                         // 96
        }                                                                                                              // 97
      }                                                                                                                // 98
      self.sequences[name] = sequence = Random.createWithSeeds.apply(null, sequenceSeed);                              // 99
    }                                                                                                                  // 100
    return sequence;                                                                                                   // 101
  }                                                                                                                    // 102
});                                                                                                                    // 103
                                                                                                                       // 104
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp/livedata_connection.js                                                                                 //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
if (Meteor.isServer) {                                                                                                 // 1
  var path = Npm.require('path');                                                                                      // 2
  var Fiber = Npm.require('fibers');                                                                                   // 3
  var Future = Npm.require(path.join('fibers', 'future'));                                                             // 4
}                                                                                                                      // 5
                                                                                                                       // 6
// @param url {String|Object} URL to Meteor app,                                                                       // 7
//   or an object as a test hook (see code)                                                                            // 8
// Options:                                                                                                            // 9
//   reloadWithOutstanding: is it OK to reload if there are outstanding methods?                                       // 10
//   headers: extra headers to send on the websockets connection, for                                                  // 11
//     server-to-server DDP only                                                                                       // 12
//   _sockjsOptions: Specifies options to pass through to the sockjs client                                            // 13
//   onDDPNegotiationVersionFailure: callback when version negotiation fails.                                          // 14
//                                                                                                                     // 15
// XXX There should be a way to destroy a DDP connection, causing all                                                  // 16
// outstanding method calls to fail.                                                                                   // 17
//                                                                                                                     // 18
// XXX Our current way of handling failure and reconnection is great                                                   // 19
// for an app (where we want to tolerate being disconnected as an                                                      // 20
// expect state, and keep trying forever to reconnect) but cumbersome                                                  // 21
// for something like a command line tool that wants to make a                                                         // 22
// connection, call a method, and print an error if connection                                                         // 23
// fails. We should have better usability in the latter case (while                                                    // 24
// still transparently reconnecting if it's just a transient failure                                                   // 25
// or the server migrating us).                                                                                        // 26
var Connection = function (url, options) {                                                                             // 27
  var self = this;                                                                                                     // 28
  options = _.extend({                                                                                                 // 29
    onConnected: function () {},                                                                                       // 30
    onDDPVersionNegotiationFailure: function (description) {                                                           // 31
      Meteor._debug(description);                                                                                      // 32
    },                                                                                                                 // 33
    heartbeatInterval: 35000,                                                                                          // 34
    heartbeatTimeout: 15000,                                                                                           // 35
    // These options are only for testing.                                                                             // 36
    reloadWithOutstanding: false,                                                                                      // 37
    supportedDDPVersions: SUPPORTED_DDP_VERSIONS,                                                                      // 38
    retry: true,                                                                                                       // 39
    respondToPings: true                                                                                               // 40
  }, options);                                                                                                         // 41
                                                                                                                       // 42
  // If set, called when we reconnect, queuing method calls _before_ the                                               // 43
  // existing outstanding ones. This is the only data member that is part of the                                       // 44
  // public API!                                                                                                       // 45
  self.onReconnect = null;                                                                                             // 46
                                                                                                                       // 47
  // as a test hook, allow passing a stream instead of a url.                                                          // 48
  if (typeof url === "object") {                                                                                       // 49
    self._stream = url;                                                                                                // 50
  } else {                                                                                                             // 51
    self._stream = new LivedataTest.ClientStream(url, {                                                                // 52
      retry: options.retry,                                                                                            // 53
      headers: options.headers,                                                                                        // 54
      _sockjsOptions: options._sockjsOptions,                                                                          // 55
      // Used to keep some tests quiet, or for other cases in which                                                    // 56
      // the right thing to do with connection errors is to silently                                                   // 57
      // fail (e.g. sending package usage stats). At some point we                                                     // 58
      // should have a real API for handling client-stream-level                                                       // 59
      // errors.                                                                                                       // 60
      _dontPrintErrors: options._dontPrintErrors,                                                                      // 61
      connectTimeoutMs: options.connectTimeoutMs                                                                       // 62
    });                                                                                                                // 63
  }                                                                                                                    // 64
                                                                                                                       // 65
  self._lastSessionId = null;                                                                                          // 66
  self._versionSuggestion = null;  // The last proposed DDP version.                                                   // 67
  self._version = null;   // The DDP version agreed on by client and server.                                           // 68
  self._stores = {}; // name -> object with methods                                                                    // 69
  self._methodHandlers = {}; // name -> func                                                                           // 70
  self._nextMethodId = 1;                                                                                              // 71
  self._supportedDDPVersions = options.supportedDDPVersions;                                                           // 72
                                                                                                                       // 73
  self._heartbeatInterval = options.heartbeatInterval;                                                                 // 74
  self._heartbeatTimeout = options.heartbeatTimeout;                                                                   // 75
                                                                                                                       // 76
  // Tracks methods which the user has tried to call but which have not yet                                            // 77
  // called their user callback (ie, they are waiting on their result or for all                                       // 78
  // of their writes to be written to the local cache). Map from method ID to                                          // 79
  // MethodInvoker object.                                                                                             // 80
  self._methodInvokers = {};                                                                                           // 81
                                                                                                                       // 82
  // Tracks methods which the user has called but whose result messages have not                                       // 83
  // arrived yet.                                                                                                      // 84
  //                                                                                                                   // 85
  // _outstandingMethodBlocks is an array of blocks of methods. Each block                                             // 86
  // represents a set of methods that can run at the same time. The first block                                        // 87
  // represents the methods which are currently in flight; subsequent blocks                                           // 88
  // must wait for previous blocks to be fully finished before they can be sent                                        // 89
  // to the server.                                                                                                    // 90
  //                                                                                                                   // 91
  // Each block is an object with the following fields:                                                                // 92
  // - methods: a list of MethodInvoker objects                                                                        // 93
  // - wait: a boolean; if true, this block had a single method invoked with                                           // 94
  //         the "wait" option                                                                                         // 95
  //                                                                                                                   // 96
  // There will never be adjacent blocks with wait=false, because the only thing                                       // 97
  // that makes methods need to be serialized is a wait method.                                                        // 98
  //                                                                                                                   // 99
  // Methods are removed from the first block when their "result" is                                                   // 100
  // received. The entire first block is only removed when all of the in-flight                                        // 101
  // methods have received their results (so the "methods" list is empty) *AND*                                        // 102
  // all of the data written by those methods are visible in the local cache. So                                       // 103
  // it is possible for the first block's methods list to be empty, if we are                                          // 104
  // still waiting for some objects to quiesce.                                                                        // 105
  //                                                                                                                   // 106
  // Example:                                                                                                          // 107
  //  _outstandingMethodBlocks = [                                                                                     // 108
  //    {wait: false, methods: []},                                                                                    // 109
  //    {wait: true, methods: [<MethodInvoker for 'login'>]},                                                          // 110
  //    {wait: false, methods: [<MethodInvoker for 'foo'>,                                                             // 111
  //                            <MethodInvoker for 'bar'>]}]                                                           // 112
  // This means that there were some methods which were sent to the server and                                         // 113
  // which have returned their results, but some of the data written by                                                // 114
  // the methods may not be visible in the local cache. Once all that data is                                          // 115
  // visible, we will send a 'login' method. Once the login method has returned                                        // 116
  // and all the data is visible (including re-running subs if userId changes),                                        // 117
  // we will send the 'foo' and 'bar' methods in parallel.                                                             // 118
  self._outstandingMethodBlocks = [];                                                                                  // 119
                                                                                                                       // 120
  // method ID -> array of objects with keys 'collection' and 'id', listing                                            // 121
  // documents written by a given method's stub. keys are associated with                                              // 122
  // methods whose stub wrote at least one document, and whose data-done message                                       // 123
  // has not yet been received.                                                                                        // 124
  self._documentsWrittenByStub = {};                                                                                   // 125
  // collection -> IdMap of "server document" object. A "server document" has:                                         // 126
  // - "document": the version of the document according the                                                           // 127
  //   server (ie, the snapshot before a stub wrote it, amended by any changes                                         // 128
  //   received from the server)                                                                                       // 129
  //   It is undefined if we think the document does not exist                                                         // 130
  // - "writtenByStubs": a set of method IDs whose stubs wrote to the document                                         // 131
  //   whose "data done" messages have not yet been processed                                                          // 132
  self._serverDocuments = {};                                                                                          // 133
                                                                                                                       // 134
  // Array of callbacks to be called after the next update of the local                                                // 135
  // cache. Used for:                                                                                                  // 136
  //  - Calling methodInvoker.dataVisible and sub ready callbacks after                                                // 137
  //    the relevant data is flushed.                                                                                  // 138
  //  - Invoking the callbacks of "half-finished" methods after reconnect                                              // 139
  //    quiescence. Specifically, methods whose result was received over the old                                       // 140
  //    connection (so we don't re-send it) but whose data had not been made                                           // 141
  //    visible.                                                                                                       // 142
  self._afterUpdateCallbacks = [];                                                                                     // 143
                                                                                                                       // 144
  // In two contexts, we buffer all incoming data messages and then process them                                       // 145
  // all at once in a single update:                                                                                   // 146
  //   - During reconnect, we buffer all data messages until all subs that had                                         // 147
  //     been ready before reconnect are ready again, and all methods that are                                         // 148
  //     active have returned their "data done message"; then                                                          // 149
  //   - During the execution of a "wait" method, we buffer all data messages                                          // 150
  //     until the wait method gets its "data done" message. (If the wait method                                       // 151
  //     occurs during reconnect, it doesn't get any special handling.)                                                // 152
  // all data messages are processed in one update.                                                                    // 153
  //                                                                                                                   // 154
  // The following fields are used for this "quiescence" process.                                                      // 155
                                                                                                                       // 156
  // This buffers the messages that aren't being processed yet.                                                        // 157
  self._messagesBufferedUntilQuiescence = [];                                                                          // 158
  // Map from method ID -> true. Methods are removed from this when their                                              // 159
  // "data done" message is received, and we will not quiesce until it is                                              // 160
  // empty.                                                                                                            // 161
  self._methodsBlockingQuiescence = {};                                                                                // 162
  // map from sub ID -> true for subs that were ready (ie, called the sub                                              // 163
  // ready callback) before reconnect but haven't become ready again yet                                               // 164
  self._subsBeingRevived = {}; // map from sub._id -> true                                                             // 165
  // if true, the next data update should reset all stores. (set during                                                // 166
  // reconnect.)                                                                                                       // 167
  self._resetStores = false;                                                                                           // 168
                                                                                                                       // 169
  // name -> array of updates for (yet to be created) collections                                                      // 170
  self._updatesForUnknownStores = {};                                                                                  // 171
  // if we're blocking a migration, the retry func                                                                     // 172
  self._retryMigrate = null;                                                                                           // 173
                                                                                                                       // 174
  // metadata for subscriptions.  Map from sub ID to object with keys:                                                 // 175
  //   - id                                                                                                            // 176
  //   - name                                                                                                          // 177
  //   - params                                                                                                        // 178
  //   - inactive (if true, will be cleaned up if not reused in re-run)                                                // 179
  //   - ready (has the 'ready' message been received?)                                                                // 180
  //   - readyCallback (an optional callback to call when ready)                                                       // 181
  //   - errorCallback (an optional callback to call if the sub terminates with                                        // 182
  //                    an error)                                                                                      // 183
  self._subscriptions = {};                                                                                            // 184
                                                                                                                       // 185
  // Reactive userId.                                                                                                  // 186
  self._userId = null;                                                                                                 // 187
  self._userIdDeps = new Tracker.Dependency;                                                                           // 188
                                                                                                                       // 189
  // Block auto-reload while we're waiting for method responses.                                                       // 190
  if (Meteor.isClient && Package.reload && !options.reloadWithOutstanding) {                                           // 191
    Package.reload.Reload._onMigrate(function (retry) {                                                                // 192
      if (!self._readyToMigrate()) {                                                                                   // 193
        if (self._retryMigrate)                                                                                        // 194
          throw new Error("Two migrations in progress?");                                                              // 195
        self._retryMigrate = retry;                                                                                    // 196
        return false;                                                                                                  // 197
      } else {                                                                                                         // 198
        return [true];                                                                                                 // 199
      }                                                                                                                // 200
    });                                                                                                                // 201
  }                                                                                                                    // 202
                                                                                                                       // 203
  var onMessage = function (raw_msg) {                                                                                 // 204
    try {                                                                                                              // 205
      var msg = parseDDP(raw_msg);                                                                                     // 206
    } catch (e) {                                                                                                      // 207
      Meteor._debug("Exception while parsing DDP", e);                                                                 // 208
      return;                                                                                                          // 209
    }                                                                                                                  // 210
                                                                                                                       // 211
    if (msg === null || !msg.msg) {                                                                                    // 212
      // XXX COMPAT WITH 0.6.6. ignore the old welcome message for back                                                // 213
      // compat.  Remove this 'if' once the server stops sending welcome                                               // 214
      // messages (stream_server.js).                                                                                  // 215
      if (! (msg && msg.server_id))                                                                                    // 216
        Meteor._debug("discarding invalid livedata message", msg);                                                     // 217
      return;                                                                                                          // 218
    }                                                                                                                  // 219
                                                                                                                       // 220
    if (msg.msg === 'connected') {                                                                                     // 221
      self._version = self._versionSuggestion;                                                                         // 222
      self._livedata_connected(msg);                                                                                   // 223
      options.onConnected();                                                                                           // 224
    }                                                                                                                  // 225
    else if (msg.msg == 'failed') {                                                                                    // 226
      if (_.contains(self._supportedDDPVersions, msg.version)) {                                                       // 227
        self._versionSuggestion = msg.version;                                                                         // 228
        self._stream.reconnect({_force: true});                                                                        // 229
      } else {                                                                                                         // 230
        var description =                                                                                              // 231
              "DDP version negotiation failed; server requested version " + msg.version;                               // 232
        self._stream.disconnect({_permanent: true, _error: description});                                              // 233
        options.onDDPVersionNegotiationFailure(description);                                                           // 234
      }                                                                                                                // 235
    }                                                                                                                  // 236
    else if (msg.msg === 'ping') {                                                                                     // 237
      if (options.respondToPings)                                                                                      // 238
        self._send({msg: "pong", id: msg.id});                                                                         // 239
      if (self._heartbeat)                                                                                             // 240
        self._heartbeat.pingReceived();                                                                                // 241
    }                                                                                                                  // 242
    else if (msg.msg === 'pong') {                                                                                     // 243
      if (self._heartbeat) {                                                                                           // 244
        self._heartbeat.pongReceived();                                                                                // 245
      }                                                                                                                // 246
    }                                                                                                                  // 247
    else if (_.include(['added', 'changed', 'removed', 'ready', 'updated'], msg.msg))                                  // 248
      self._livedata_data(msg);                                                                                        // 249
    else if (msg.msg === 'nosub')                                                                                      // 250
      self._livedata_nosub(msg);                                                                                       // 251
    else if (msg.msg === 'result')                                                                                     // 252
      self._livedata_result(msg);                                                                                      // 253
    else if (msg.msg === 'error')                                                                                      // 254
      self._livedata_error(msg);                                                                                       // 255
    else                                                                                                               // 256
      Meteor._debug("discarding unknown livedata message type", msg);                                                  // 257
  };                                                                                                                   // 258
                                                                                                                       // 259
  var onReset = function () {                                                                                          // 260
    // Send a connect message at the beginning of the stream.                                                          // 261
    // NOTE: reset is called even on the first connection, so this is                                                  // 262
    // the only place we send this message.                                                                            // 263
    var msg = {msg: 'connect'};                                                                                        // 264
    if (self._lastSessionId)                                                                                           // 265
      msg.session = self._lastSessionId;                                                                               // 266
    msg.version = self._versionSuggestion || self._supportedDDPVersions[0];                                            // 267
    self._versionSuggestion = msg.version;                                                                             // 268
    msg.support = self._supportedDDPVersions;                                                                          // 269
    self._send(msg);                                                                                                   // 270
                                                                                                                       // 271
    // Now, to minimize setup latency, go ahead and blast out all of                                                   // 272
    // our pending methods ands subscriptions before we've even taken                                                  // 273
    // the necessary RTT to know if we successfully reconnected. (1)                                                   // 274
    // They're supposed to be idempotent; (2) even if we did                                                           // 275
    // reconnect, we're not sure what messages might have gotten lost                                                  // 276
    // (in either direction) since we were disconnected (TCP being                                                     // 277
    // sloppy about that.)                                                                                             // 278
                                                                                                                       // 279
    // If the current block of methods all got their results (but didn't all get                                       // 280
    // their data visible), discard the empty block now.                                                               // 281
    if (! _.isEmpty(self._outstandingMethodBlocks) &&                                                                  // 282
        _.isEmpty(self._outstandingMethodBlocks[0].methods)) {                                                         // 283
      self._outstandingMethodBlocks.shift();                                                                           // 284
    }                                                                                                                  // 285
                                                                                                                       // 286
    // Mark all messages as unsent, they have not yet been sent on this                                                // 287
    // connection.                                                                                                     // 288
    _.each(self._methodInvokers, function (m) {                                                                        // 289
      m.sentMessage = false;                                                                                           // 290
    });                                                                                                                // 291
                                                                                                                       // 292
    // If an `onReconnect` handler is set, call it first. Go through                                                   // 293
    // some hoops to ensure that methods that are called from within                                                   // 294
    // `onReconnect` get executed _before_ ones that were originally                                                   // 295
    // outstanding (since `onReconnect` is used to re-establish auth                                                   // 296
    // certificates)                                                                                                   // 297
    if (self.onReconnect)                                                                                              // 298
      self._callOnReconnectAndSendAppropriateOutstandingMethods();                                                     // 299
    else                                                                                                               // 300
      self._sendOutstandingMethods();                                                                                  // 301
                                                                                                                       // 302
    // add new subscriptions at the end. this way they take effect after                                               // 303
    // the handlers and we don't see flicker.                                                                          // 304
    _.each(self._subscriptions, function (sub, id) {                                                                   // 305
      self._send({                                                                                                     // 306
        msg: 'sub',                                                                                                    // 307
        id: id,                                                                                                        // 308
        name: sub.name,                                                                                                // 309
        params: sub.params                                                                                             // 310
      });                                                                                                              // 311
    });                                                                                                                // 312
  };                                                                                                                   // 313
                                                                                                                       // 314
  var onDisconnect = function () {                                                                                     // 315
    if (self._heartbeat) {                                                                                             // 316
      self._heartbeat.stop();                                                                                          // 317
      self._heartbeat = null;                                                                                          // 318
    }                                                                                                                  // 319
  };                                                                                                                   // 320
                                                                                                                       // 321
  if (Meteor.isServer) {                                                                                               // 322
    self._stream.on('message', Meteor.bindEnvironment(onMessage, Meteor._debug));                                      // 323
    self._stream.on('reset', Meteor.bindEnvironment(onReset, Meteor._debug));                                          // 324
    self._stream.on('disconnect', Meteor.bindEnvironment(onDisconnect, Meteor._debug));                                // 325
  } else {                                                                                                             // 326
    self._stream.on('message', onMessage);                                                                             // 327
    self._stream.on('reset', onReset);                                                                                 // 328
    self._stream.on('disconnect', onDisconnect);                                                                       // 329
  }                                                                                                                    // 330
};                                                                                                                     // 331
                                                                                                                       // 332
// A MethodInvoker manages sending a method to the server and calling the user's                                       // 333
// callbacks. On construction, it registers itself in the connection's                                                 // 334
// _methodInvokers map; it removes itself once the method is fully finished and                                        // 335
// the callback is invoked. This occurs when it has both received a result,                                            // 336
// and the data written by it is fully visible.                                                                        // 337
var MethodInvoker = function (options) {                                                                               // 338
  var self = this;                                                                                                     // 339
                                                                                                                       // 340
  // Public (within this file) fields.                                                                                 // 341
  self.methodId = options.methodId;                                                                                    // 342
  self.sentMessage = false;                                                                                            // 343
                                                                                                                       // 344
  self._callback = options.callback;                                                                                   // 345
  self._connection = options.connection;                                                                               // 346
  self._message = options.message;                                                                                     // 347
  self._onResultReceived = options.onResultReceived || function () {};                                                 // 348
  self._wait = options.wait;                                                                                           // 349
  self._methodResult = null;                                                                                           // 350
  self._dataVisible = false;                                                                                           // 351
                                                                                                                       // 352
  // Register with the connection.                                                                                     // 353
  self._connection._methodInvokers[self.methodId] = self;                                                              // 354
};                                                                                                                     // 355
_.extend(MethodInvoker.prototype, {                                                                                    // 356
  // Sends the method message to the server. May be called additional times if                                         // 357
  // we lose the connection and reconnect before receiving a result.                                                   // 358
  sendMessage: function () {                                                                                           // 359
    var self = this;                                                                                                   // 360
    // This function is called before sending a method (including resending on                                         // 361
    // reconnect). We should only (re)send methods where we don't already have a                                       // 362
    // result!                                                                                                         // 363
    if (self.gotResult())                                                                                              // 364
      throw new Error("sendingMethod is called on method with result");                                                // 365
                                                                                                                       // 366
    // If we're re-sending it, it doesn't matter if data was written the first                                         // 367
    // time.                                                                                                           // 368
    self._dataVisible = false;                                                                                         // 369
                                                                                                                       // 370
    self.sentMessage = true;                                                                                           // 371
                                                                                                                       // 372
    // If this is a wait method, make all data messages be buffered until it is                                        // 373
    // done.                                                                                                           // 374
    if (self._wait)                                                                                                    // 375
      self._connection._methodsBlockingQuiescence[self.methodId] = true;                                               // 376
                                                                                                                       // 377
    // Actually send the message.                                                                                      // 378
    self._connection._send(self._message);                                                                             // 379
  },                                                                                                                   // 380
  // Invoke the callback, if we have both a result and know that all data has                                          // 381
  // been written to the local cache.                                                                                  // 382
  _maybeInvokeCallback: function () {                                                                                  // 383
    var self = this;                                                                                                   // 384
    if (self._methodResult && self._dataVisible) {                                                                     // 385
      // Call the callback. (This won't throw: the callback was wrapped with                                           // 386
      // bindEnvironment.)                                                                                             // 387
      self._callback(self._methodResult[0], self._methodResult[1]);                                                    // 388
                                                                                                                       // 389
      // Forget about this method.                                                                                     // 390
      delete self._connection._methodInvokers[self.methodId];                                                          // 391
                                                                                                                       // 392
      // Let the connection know that this method is finished, so it can try to                                        // 393
      // move on to the next block of methods.                                                                         // 394
      self._connection._outstandingMethodFinished();                                                                   // 395
    }                                                                                                                  // 396
  },                                                                                                                   // 397
  // Call with the result of the method from the server. Only may be called                                            // 398
  // once; once it is called, you should not call sendMessage again.                                                   // 399
  // If the user provided an onResultReceived callback, call it immediately.                                           // 400
  // Then invoke the main callback if data is also visible.                                                            // 401
  receiveResult: function (err, result) {                                                                              // 402
    var self = this;                                                                                                   // 403
    if (self.gotResult())                                                                                              // 404
      throw new Error("Methods should only receive results once");                                                     // 405
    self._methodResult = [err, result];                                                                                // 406
    self._onResultReceived(err, result);                                                                               // 407
    self._maybeInvokeCallback();                                                                                       // 408
  },                                                                                                                   // 409
  // Call this when all data written by the method is visible. This means that                                         // 410
  // the method has returns its "data is done" message *AND* all server                                                // 411
  // documents that are buffered at that time have been written to the local                                           // 412
  // cache. Invokes the main callback if the result has been received.                                                 // 413
  dataVisible: function () {                                                                                           // 414
    var self = this;                                                                                                   // 415
    self._dataVisible = true;                                                                                          // 416
    self._maybeInvokeCallback();                                                                                       // 417
  },                                                                                                                   // 418
  // True if receiveResult has been called.                                                                            // 419
  gotResult: function () {                                                                                             // 420
    var self = this;                                                                                                   // 421
    return !!self._methodResult;                                                                                       // 422
  }                                                                                                                    // 423
});                                                                                                                    // 424
                                                                                                                       // 425
_.extend(Connection.prototype, {                                                                                       // 426
  // 'name' is the name of the data on the wire that should go in the                                                  // 427
  // store. 'wrappedStore' should be an object with methods beginUpdate, update,                                       // 428
  // endUpdate, saveOriginals, retrieveOriginals. see Collection for an example.                                       // 429
  registerStore: function (name, wrappedStore) {                                                                       // 430
    var self = this;                                                                                                   // 431
                                                                                                                       // 432
    if (name in self._stores)                                                                                          // 433
      return false;                                                                                                    // 434
                                                                                                                       // 435
    // Wrap the input object in an object which makes any store method not                                             // 436
    // implemented by 'store' into a no-op.                                                                            // 437
    var store = {};                                                                                                    // 438
    _.each(['update', 'beginUpdate', 'endUpdate', 'saveOriginals',                                                     // 439
            'retrieveOriginals'], function (method) {                                                                  // 440
              store[method] = function () {                                                                            // 441
                return (wrappedStore[method]                                                                           // 442
                        ? wrappedStore[method].apply(wrappedStore, arguments)                                          // 443
                        : undefined);                                                                                  // 444
              };                                                                                                       // 445
            });                                                                                                        // 446
                                                                                                                       // 447
    self._stores[name] = store;                                                                                        // 448
                                                                                                                       // 449
    var queued = self._updatesForUnknownStores[name];                                                                  // 450
    if (queued) {                                                                                                      // 451
      store.beginUpdate(queued.length, false);                                                                         // 452
      _.each(queued, function (msg) {                                                                                  // 453
        store.update(msg);                                                                                             // 454
      });                                                                                                              // 455
      store.endUpdate();                                                                                               // 456
      delete self._updatesForUnknownStores[name];                                                                      // 457
    }                                                                                                                  // 458
                                                                                                                       // 459
    return true;                                                                                                       // 460
  },                                                                                                                   // 461
                                                                                                                       // 462
  /**                                                                                                                  // 463
   * @memberOf Meteor                                                                                                  // 464
   * @summary Subscribe to a record set.  Returns a handle that provides `stop()` and `ready()` methods.               // 465
   * @locus Client                                                                                                     // 466
   * @param {String} name Name of the subscription.  Matches the name of the server's `publish()` call.                // 467
   * @param {Any} [arg1,arg2...] Optional arguments passed to publisher function on server.                            // 468
   * @param {Function|Object} [callbacks] Optional. May include `onError` and `onReady` callbacks. If a function is passed instead of an object, it is interpreted as an `onReady` callback.
   */                                                                                                                  // 470
  subscribe: function (name /* .. [arguments] .. (callback|callbacks) */) {                                            // 471
    var self = this;                                                                                                   // 472
                                                                                                                       // 473
    var params = Array.prototype.slice.call(arguments, 1);                                                             // 474
    var callbacks = {};                                                                                                // 475
    if (params.length) {                                                                                               // 476
      var lastParam = params[params.length - 1];                                                                       // 477
      if (typeof lastParam === "function") {                                                                           // 478
        callbacks.onReady = params.pop();                                                                              // 479
      } else if (lastParam && (typeof lastParam.onReady === "function" ||                                              // 480
                               typeof lastParam.onError === "function")) {                                             // 481
        callbacks = params.pop();                                                                                      // 482
      }                                                                                                                // 483
    }                                                                                                                  // 484
                                                                                                                       // 485
    // Is there an existing sub with the same name and param, run in an                                                // 486
    // invalidated Computation? This will happen if we are rerunning an                                                // 487
    // existing computation.                                                                                           // 488
    //                                                                                                                 // 489
    // For example, consider a rerun of:                                                                               // 490
    //                                                                                                                 // 491
    //     Tracker.autorun(function () {                                                                               // 492
    //       Meteor.subscribe("foo", Session.get("foo"));                                                              // 493
    //       Meteor.subscribe("bar", Session.get("bar"));                                                              // 494
    //     });                                                                                                         // 495
    //                                                                                                                 // 496
    // If "foo" has changed but "bar" has not, we will match the "bar"                                                 // 497
    // subcribe to an existing inactive subscription in order to not                                                   // 498
    // unsub and resub the subscription unnecessarily.                                                                 // 499
    //                                                                                                                 // 500
    // We only look for one such sub; if there are N apparently-identical subs                                         // 501
    // being invalidated, we will require N matching subscribe calls to keep                                           // 502
    // them all active.                                                                                                // 503
    var existing = _.find(self._subscriptions, function (sub) {                                                        // 504
      return sub.inactive && sub.name === name &&                                                                      // 505
        EJSON.equals(sub.params, params);                                                                              // 506
    });                                                                                                                // 507
                                                                                                                       // 508
    var id;                                                                                                            // 509
    if (existing) {                                                                                                    // 510
      id = existing.id;                                                                                                // 511
      existing.inactive = false; // reactivate                                                                         // 512
                                                                                                                       // 513
      if (callbacks.onReady) {                                                                                         // 514
        // If the sub is not already ready, replace any ready callback with the                                        // 515
        // one provided now. (It's not really clear what users would expect for                                        // 516
        // an onReady callback inside an autorun; the semantics we provide is                                          // 517
        // that at the time the sub first becomes ready, we call the last                                              // 518
        // onReady callback provided, if any.)                                                                         // 519
        if (!existing.ready)                                                                                           // 520
          existing.readyCallback = callbacks.onReady;                                                                  // 521
      }                                                                                                                // 522
      if (callbacks.onError) {                                                                                         // 523
        // Replace existing callback if any, so that errors aren't                                                     // 524
        // double-reported.                                                                                            // 525
        existing.errorCallback = callbacks.onError;                                                                    // 526
      }                                                                                                                // 527
    } else {                                                                                                           // 528
      // New sub! Generate an id, save it locally, and send message.                                                   // 529
      id = Random.id();                                                                                                // 530
      self._subscriptions[id] = {                                                                                      // 531
        id: id,                                                                                                        // 532
        name: name,                                                                                                    // 533
        params: EJSON.clone(params),                                                                                   // 534
        inactive: false,                                                                                               // 535
        ready: false,                                                                                                  // 536
        readyDeps: new Tracker.Dependency,                                                                             // 537
        readyCallback: callbacks.onReady,                                                                              // 538
        errorCallback: callbacks.onError,                                                                              // 539
        connection: self,                                                                                              // 540
        remove: function() {                                                                                           // 541
          delete this.connection._subscriptions[this.id];                                                              // 542
          this.ready && this.readyDeps.changed();                                                                      // 543
        },                                                                                                             // 544
        stop: function() {                                                                                             // 545
          this.connection._send({msg: 'unsub', id: id});                                                               // 546
          this.remove();                                                                                               // 547
        }                                                                                                              // 548
      };                                                                                                               // 549
      self._send({msg: 'sub', id: id, name: name, params: params});                                                    // 550
    }                                                                                                                  // 551
                                                                                                                       // 552
    // return a handle to the application.                                                                             // 553
    var handle = {                                                                                                     // 554
      stop: function () {                                                                                              // 555
        if (!_.has(self._subscriptions, id))                                                                           // 556
          return;                                                                                                      // 557
                                                                                                                       // 558
        self._subscriptions[id].stop();                                                                                // 559
      },                                                                                                               // 560
      ready: function () {                                                                                             // 561
        // return false if we've unsubscribed.                                                                         // 562
        if (!_.has(self._subscriptions, id))                                                                           // 563
          return false;                                                                                                // 564
        var record = self._subscriptions[id];                                                                          // 565
        record.readyDeps.depend();                                                                                     // 566
        return record.ready;                                                                                           // 567
      }                                                                                                                // 568
    };                                                                                                                 // 569
                                                                                                                       // 570
    if (Tracker.active) {                                                                                              // 571
      // We're in a reactive computation, so we'd like to unsubscribe when the                                         // 572
      // computation is invalidated... but not if the rerun just re-subscribes                                         // 573
      // to the same subscription!  When a rerun happens, we use onInvalidate                                          // 574
      // as a change to mark the subscription "inactive" so that it can                                                // 575
      // be reused from the rerun.  If it isn't reused, it's killed from                                               // 576
      // an afterFlush.                                                                                                // 577
      Tracker.onInvalidate(function (c) {                                                                              // 578
        if (_.has(self._subscriptions, id))                                                                            // 579
          self._subscriptions[id].inactive = true;                                                                     // 580
                                                                                                                       // 581
        Tracker.afterFlush(function () {                                                                               // 582
          if (_.has(self._subscriptions, id) &&                                                                        // 583
              self._subscriptions[id].inactive)                                                                        // 584
            handle.stop();                                                                                             // 585
        });                                                                                                            // 586
      });                                                                                                              // 587
    }                                                                                                                  // 588
                                                                                                                       // 589
    return handle;                                                                                                     // 590
  },                                                                                                                   // 591
                                                                                                                       // 592
  // options:                                                                                                          // 593
  // - onLateError {Function(error)} called if an error was received after the ready event.                            // 594
  //     (errors received before ready cause an error to be thrown)                                                    // 595
  _subscribeAndWait: function (name, args, options) {                                                                  // 596
    var self = this;                                                                                                   // 597
    var f = new Future();                                                                                              // 598
    var ready = false;                                                                                                 // 599
    var handle;                                                                                                        // 600
    args = args || [];                                                                                                 // 601
    args.push({                                                                                                        // 602
      onReady: function () {                                                                                           // 603
        ready = true;                                                                                                  // 604
        f['return']();                                                                                                 // 605
      },                                                                                                               // 606
      onError: function (e) {                                                                                          // 607
        if (!ready)                                                                                                    // 608
          f['throw'](e);                                                                                               // 609
        else                                                                                                           // 610
          options && options.onLateError && options.onLateError(e);                                                    // 611
      }                                                                                                                // 612
    });                                                                                                                // 613
                                                                                                                       // 614
    handle = self.subscribe.apply(self, [name].concat(args));                                                          // 615
    f.wait();                                                                                                          // 616
    return handle;                                                                                                     // 617
  },                                                                                                                   // 618
                                                                                                                       // 619
  methods: function (methods) {                                                                                        // 620
    var self = this;                                                                                                   // 621
    _.each(methods, function (func, name) {                                                                            // 622
      if (self._methodHandlers[name])                                                                                  // 623
        throw new Error("A method named '" + name + "' is already defined");                                           // 624
      self._methodHandlers[name] = func;                                                                               // 625
    });                                                                                                                // 626
  },                                                                                                                   // 627
                                                                                                                       // 628
  /**                                                                                                                  // 629
   * @memberOf Meteor                                                                                                  // 630
   * @summary Invokes a method passing any number of arguments.                                                        // 631
   * @locus Anywhere                                                                                                   // 632
   * @param {String} name Name of method to invoke                                                                     // 633
   * @param {EJSONable} [arg1,arg2...] Optional method arguments                                                       // 634
   * @param {Function} [asyncCallback] Optional callback, which is called asynchronously with the error or result after the method is complete. If not provided, the method runs synchronously if possible (see below).
   */                                                                                                                  // 636
  call: function (name /* .. [arguments] .. callback */) {                                                             // 637
    // if it's a function, the last argument is the result callback,                                                   // 638
    // not a parameter to the remote method.                                                                           // 639
    var args = Array.prototype.slice.call(arguments, 1);                                                               // 640
    if (args.length && typeof args[args.length - 1] === "function")                                                    // 641
      var callback = args.pop();                                                                                       // 642
    return this.apply(name, args, callback);                                                                           // 643
  },                                                                                                                   // 644
                                                                                                                       // 645
  // @param options {Optional Object}                                                                                  // 646
  //   wait: Boolean - Should we wait to call this until all current methods                                           // 647
  //                   are fully finished, and block subsequent method calls                                           // 648
  //                   until this method is fully finished?                                                            // 649
  //                   (does not affect methods called from within this method)                                        // 650
  //   onResultReceived: Function - a callback to call as soon as the method                                           // 651
  //                                result is received. the data written by                                            // 652
  //                                the method may not yet be in the cache!                                            // 653
  //   returnStubValue: Boolean - If true then in cases where we would have                                            // 654
  //                              otherwise discarded the stub's return value                                          // 655
  //                              and returned undefined, instead we go ahead                                          // 656
  //                              and return it.  Specifically, this is any                                            // 657
  //                              time other than when (a) we are already                                              // 658
  //                              inside a stub or (b) we are in Node and no                                           // 659
  //                              callback was provided.  Currently we require                                         // 660
  //                              this flag to be explicitly passed to reduce                                          // 661
  //                              the likelihood that stub return values will                                          // 662
  //                              be confused with server return values; we                                            // 663
  //                              may improve this in future.                                                          // 664
  // @param callback {Optional Function}                                                                               // 665
                                                                                                                       // 666
  /**                                                                                                                  // 667
   * @memberOf Meteor                                                                                                  // 668
   * @summary Invoke a method passing an array of arguments.                                                           // 669
   * @locus Anywhere                                                                                                   // 670
   * @param {String} name Name of method to invoke                                                                     // 671
   * @param {EJSONable[]} args Method arguments                                                                        // 672
   * @param {Object} [options]                                                                                         // 673
   * @param {Boolean} options.wait (Client only) If true, don't send this method until all previous method calls have completed, and don't send any subsequent method calls until this one is completed.
   * @param {Function} options.onResultReceived (Client only) This callback is invoked with the error or result of the method (just like `asyncCallback`) as soon as the error or result is available. The local cache may not yet reflect the writes performed by the method.
   * @param {Function} [asyncCallback] Optional callback; same semantics as in [`Meteor.call`](#meteor_call).          // 676
   */                                                                                                                  // 677
  apply: function (name, args, options, callback) {                                                                    // 678
    var self = this;                                                                                                   // 679
                                                                                                                       // 680
    // We were passed 3 arguments. They may be either (name, args, options)                                            // 681
    // or (name, args, callback)                                                                                       // 682
    if (!callback && typeof options === 'function') {                                                                  // 683
      callback = options;                                                                                              // 684
      options = {};                                                                                                    // 685
    }                                                                                                                  // 686
    options = options || {};                                                                                           // 687
                                                                                                                       // 688
    if (callback) {                                                                                                    // 689
      // XXX would it be better form to do the binding in stream.on,                                                   // 690
      // or caller, instead of here?                                                                                   // 691
      // XXX improve error message (and how we report it)                                                              // 692
      callback = Meteor.bindEnvironment(                                                                               // 693
        callback,                                                                                                      // 694
        "delivering result of invoking '" + name + "'"                                                                 // 695
      );                                                                                                               // 696
    }                                                                                                                  // 697
                                                                                                                       // 698
    // Keep our args safe from mutation (eg if we don't send the message for a                                         // 699
    // while because of a wait method).                                                                                // 700
    args = EJSON.clone(args);                                                                                          // 701
                                                                                                                       // 702
    // Lazily allocate method ID once we know that it'll be needed.                                                    // 703
    var methodId = (function () {                                                                                      // 704
      var id;                                                                                                          // 705
      return function () {                                                                                             // 706
        if (id === undefined)                                                                                          // 707
          id = '' + (self._nextMethodId++);                                                                            // 708
        return id;                                                                                                     // 709
      };                                                                                                               // 710
    })();                                                                                                              // 711
                                                                                                                       // 712
    var enclosing = DDP._CurrentInvocation.get();                                                                      // 713
    var alreadyInSimulation = enclosing && enclosing.isSimulation;                                                     // 714
                                                                                                                       // 715
    // Lazily generate a randomSeed, only if it is requested by the stub.                                              // 716
    // The random streams only have utility if they're used on both the client                                         // 717
    // and the server; if the client doesn't generate any 'random' values                                              // 718
    // then we don't expect the server to generate any either.                                                         // 719
    // Less commonly, the server may perform different actions from the client,                                        // 720
    // and may in fact generate values where the client did not, but we don't                                          // 721
    // have any client-side values to match, so even here we may as well just                                          // 722
    // use a random seed on the server.  In that case, we don't pass the                                               // 723
    // randomSeed to save bandwidth, and we don't even generate it to save a                                           // 724
    // bit of CPU and to avoid consuming entropy.                                                                      // 725
    var randomSeed = null;                                                                                             // 726
    var randomSeedGenerator = function () {                                                                            // 727
      if (randomSeed === null) {                                                                                       // 728
        randomSeed = makeRpcSeed(enclosing, name);                                                                     // 729
      }                                                                                                                // 730
      return randomSeed;                                                                                               // 731
    };                                                                                                                 // 732
                                                                                                                       // 733
    // Run the stub, if we have one. The stub is supposed to make some                                                 // 734
    // temporary writes to the database to give the user a smooth experience                                           // 735
    // until the actual result of executing the method comes back from the                                             // 736
    // server (whereupon the temporary writes to the database will be reversed                                         // 737
    // during the beginUpdate/endUpdate process.)                                                                      // 738
    //                                                                                                                 // 739
    // Normally, we ignore the return value of the stub (even if it is an                                              // 740
    // exception), in favor of the real return value from the server. The                                              // 741
    // exception is if the *caller* is a stub. In that case, we're not going                                           // 742
    // to do a RPC, so we use the return value of the stub as our return                                               // 743
    // value.                                                                                                          // 744
                                                                                                                       // 745
    var stub = self._methodHandlers[name];                                                                             // 746
    if (stub) {                                                                                                        // 747
      var setUserId = function(userId) {                                                                               // 748
        self.setUserId(userId);                                                                                        // 749
      };                                                                                                               // 750
                                                                                                                       // 751
      var invocation = new MethodInvocation({                                                                          // 752
        isSimulation: true,                                                                                            // 753
        userId: self.userId(),                                                                                         // 754
        setUserId: setUserId,                                                                                          // 755
        randomSeed: function () { return randomSeedGenerator(); }                                                      // 756
      });                                                                                                              // 757
                                                                                                                       // 758
      if (!alreadyInSimulation)                                                                                        // 759
        self._saveOriginals();                                                                                         // 760
                                                                                                                       // 761
      try {                                                                                                            // 762
        // Note that unlike in the corresponding server code, we never audit                                           // 763
        // that stubs check() their arguments.                                                                         // 764
        var stubReturnValue = DDP._CurrentInvocation.withValue(invocation, function () {                               // 765
          if (Meteor.isServer) {                                                                                       // 766
            // Because saveOriginals and retrieveOriginals aren't reentrant,                                           // 767
            // don't allow stubs to yield.                                                                             // 768
            return Meteor._noYieldsAllowed(function () {                                                               // 769
              // re-clone, so that the stub can't affect our caller's values                                           // 770
              return stub.apply(invocation, EJSON.clone(args));                                                        // 771
            });                                                                                                        // 772
          } else {                                                                                                     // 773
            return stub.apply(invocation, EJSON.clone(args));                                                          // 774
          }                                                                                                            // 775
        });                                                                                                            // 776
      }                                                                                                                // 777
      catch (e) {                                                                                                      // 778
        var exception = e;                                                                                             // 779
      }                                                                                                                // 780
                                                                                                                       // 781
      if (!alreadyInSimulation)                                                                                        // 782
        self._retrieveAndStoreOriginals(methodId());                                                                   // 783
    }                                                                                                                  // 784
                                                                                                                       // 785
    // If we're in a simulation, stop and return the result we have,                                                   // 786
    // rather than going on to do an RPC. If there was no stub,                                                        // 787
    // we'll end up returning undefined.                                                                               // 788
    if (alreadyInSimulation) {                                                                                         // 789
      if (callback) {                                                                                                  // 790
        callback(exception, stubReturnValue);                                                                          // 791
        return undefined;                                                                                              // 792
      }                                                                                                                // 793
      if (exception)                                                                                                   // 794
        throw exception;                                                                                               // 795
      return stubReturnValue;                                                                                          // 796
    }                                                                                                                  // 797
                                                                                                                       // 798
    // If an exception occurred in a stub, and we're ignoring it                                                       // 799
    // because we're doing an RPC and want to use what the server                                                      // 800
    // returns instead, log it so the developer knows.                                                                 // 801
    //                                                                                                                 // 802
    // Tests can set the 'expected' flag on an exception so it won't                                                   // 803
    // go to log.                                                                                                      // 804
    if (exception && !exception.expected) {                                                                            // 805
      Meteor._debug("Exception while simulating the effect of invoking '" +                                            // 806
                    name + "'", exception, exception.stack);                                                           // 807
    }                                                                                                                  // 808
                                                                                                                       // 809
                                                                                                                       // 810
    // At this point we're definitely doing an RPC, and we're going to                                                 // 811
    // return the value of the RPC to the caller.                                                                      // 812
                                                                                                                       // 813
    // If the caller didn't give a callback, decide what to do.                                                        // 814
    if (!callback) {                                                                                                   // 815
      if (Meteor.isClient) {                                                                                           // 816
        // On the client, we don't have fibers, so we can't block. The                                                 // 817
        // only thing we can do is to return undefined and discard the                                                 // 818
        // result of the RPC. If an error occurred then print the error                                                // 819
        // to the console.                                                                                             // 820
        callback = function (err) {                                                                                    // 821
          err && Meteor._debug("Error invoking Method '" + name + "':",                                                // 822
                               err.message);                                                                           // 823
        };                                                                                                             // 824
      } else {                                                                                                         // 825
        // On the server, make the function synchronous. Throw on                                                      // 826
        // errors, return on success.                                                                                  // 827
        var future = new Future;                                                                                       // 828
        callback = future.resolver();                                                                                  // 829
      }                                                                                                                // 830
    }                                                                                                                  // 831
    // Send the RPC. Note that on the client, it is important that the                                                 // 832
    // stub have finished before we send the RPC, so that we know we have                                              // 833
    // a complete list of which local documents the stub wrote.                                                        // 834
    var message = {                                                                                                    // 835
      msg: 'method',                                                                                                   // 836
      method: name,                                                                                                    // 837
      params: args,                                                                                                    // 838
      id: methodId()                                                                                                   // 839
    };                                                                                                                 // 840
                                                                                                                       // 841
    // Send the randomSeed only if we used it                                                                          // 842
    if (randomSeed !== null) {                                                                                         // 843
      message.randomSeed = randomSeed;                                                                                 // 844
    }                                                                                                                  // 845
                                                                                                                       // 846
    var methodInvoker = new MethodInvoker({                                                                            // 847
      methodId: methodId(),                                                                                            // 848
      callback: callback,                                                                                              // 849
      connection: self,                                                                                                // 850
      onResultReceived: options.onResultReceived,                                                                      // 851
      wait: !!options.wait,                                                                                            // 852
      message: message                                                                                                 // 853
    });                                                                                                                // 854
                                                                                                                       // 855
    if (options.wait) {                                                                                                // 856
      // It's a wait method! Wait methods go in their own block.                                                       // 857
      self._outstandingMethodBlocks.push(                                                                              // 858
        {wait: true, methods: [methodInvoker]});                                                                       // 859
    } else {                                                                                                           // 860
      // Not a wait method. Start a new block if the previous block was a wait                                         // 861
      // block, and add it to the last block of methods.                                                               // 862
      if (_.isEmpty(self._outstandingMethodBlocks) ||                                                                  // 863
          _.last(self._outstandingMethodBlocks).wait)                                                                  // 864
        self._outstandingMethodBlocks.push({wait: false, methods: []});                                                // 865
      _.last(self._outstandingMethodBlocks).methods.push(methodInvoker);                                               // 866
    }                                                                                                                  // 867
                                                                                                                       // 868
    // If we added it to the first block, send it out now.                                                             // 869
    if (self._outstandingMethodBlocks.length === 1)                                                                    // 870
      methodInvoker.sendMessage();                                                                                     // 871
                                                                                                                       // 872
    // If we're using the default callback on the server,                                                              // 873
    // block waiting for the result.                                                                                   // 874
    if (future) {                                                                                                      // 875
      return future.wait();                                                                                            // 876
    }                                                                                                                  // 877
    return options.returnStubValue ? stubReturnValue : undefined;                                                      // 878
  },                                                                                                                   // 879
                                                                                                                       // 880
  // Before calling a method stub, prepare all stores to track changes and allow                                       // 881
  // _retrieveAndStoreOriginals to get the original versions of changed                                                // 882
  // documents.                                                                                                        // 883
  _saveOriginals: function () {                                                                                        // 884
    var self = this;                                                                                                   // 885
    _.each(self._stores, function (s) {                                                                                // 886
      s.saveOriginals();                                                                                               // 887
    });                                                                                                                // 888
  },                                                                                                                   // 889
  // Retrieves the original versions of all documents modified by the stub for                                         // 890
  // method 'methodId' from all stores and saves them to _serverDocuments (keyed                                       // 891
  // by document) and _documentsWrittenByStub (keyed by method ID).                                                    // 892
  _retrieveAndStoreOriginals: function (methodId) {                                                                    // 893
    var self = this;                                                                                                   // 894
    if (self._documentsWrittenByStub[methodId])                                                                        // 895
      throw new Error("Duplicate methodId in _retrieveAndStoreOriginals");                                             // 896
                                                                                                                       // 897
    var docsWritten = [];                                                                                              // 898
    _.each(self._stores, function (s, collection) {                                                                    // 899
      var originals = s.retrieveOriginals();                                                                           // 900
      // not all stores define retrieveOriginals                                                                       // 901
      if (!originals)                                                                                                  // 902
        return;                                                                                                        // 903
      originals.forEach(function (doc, id) {                                                                           // 904
        docsWritten.push({collection: collection, id: id});                                                            // 905
        if (!_.has(self._serverDocuments, collection))                                                                 // 906
          self._serverDocuments[collection] = new LocalCollection._IdMap;                                              // 907
        var serverDoc = self._serverDocuments[collection].setDefault(id, {});                                          // 908
        if (serverDoc.writtenByStubs) {                                                                                // 909
          // We're not the first stub to write this doc. Just add our method ID                                        // 910
          // to the record.                                                                                            // 911
          serverDoc.writtenByStubs[methodId] = true;                                                                   // 912
        } else {                                                                                                       // 913
          // First stub! Save the original value and our method ID.                                                    // 914
          serverDoc.document = doc;                                                                                    // 915
          serverDoc.flushCallbacks = [];                                                                               // 916
          serverDoc.writtenByStubs = {};                                                                               // 917
          serverDoc.writtenByStubs[methodId] = true;                                                                   // 918
        }                                                                                                              // 919
      });                                                                                                              // 920
    });                                                                                                                // 921
    if (!_.isEmpty(docsWritten)) {                                                                                     // 922
      self._documentsWrittenByStub[methodId] = docsWritten;                                                            // 923
    }                                                                                                                  // 924
  },                                                                                                                   // 925
                                                                                                                       // 926
  // This is very much a private function we use to make the tests                                                     // 927
  // take up fewer server resources after they complete.                                                               // 928
  _unsubscribeAll: function () {                                                                                       // 929
    var self = this;                                                                                                   // 930
    _.each(_.clone(self._subscriptions), function (sub, id) {                                                          // 931
      // Avoid killing the autoupdate subscription so that developers                                                  // 932
      // still get hot code pushes when writing tests.                                                                 // 933
      //                                                                                                               // 934
      // XXX it's a hack to encode knowledge about autoupdate here,                                                    // 935
      // but it doesn't seem worth it yet to have a special API for                                                    // 936
      // subscriptions to preserve after unit tests.                                                                   // 937
      if (sub.name !== 'meteor_autoupdate_clientVersions') {                                                           // 938
        self._subscriptions[id].stop();                                                                                // 939
      }                                                                                                                // 940
    });                                                                                                                // 941
  },                                                                                                                   // 942
                                                                                                                       // 943
  // Sends the DDP stringification of the given message object                                                         // 944
  _send: function (obj) {                                                                                              // 945
    var self = this;                                                                                                   // 946
    self._stream.send(stringifyDDP(obj));                                                                              // 947
  },                                                                                                                   // 948
                                                                                                                       // 949
  // We detected via DDP-level heartbeats that we've lost the                                                          // 950
  // connection.  Unlike `disconnect` or `close`, a lost connection                                                    // 951
  // will be automatically retried.                                                                                    // 952
  _lostConnection: function () {                                                                                       // 953
    var self = this;                                                                                                   // 954
    self._stream._lostConnection();                                                                                    // 955
  },                                                                                                                   // 956
                                                                                                                       // 957
  /**                                                                                                                  // 958
   * @summary Get the current connection status. A reactive data source.                                               // 959
   * @locus Client                                                                                                     // 960
   * @memberOf Meteor                                                                                                  // 961
   */                                                                                                                  // 962
  status: function (/*passthrough args*/) {                                                                            // 963
    var self = this;                                                                                                   // 964
    return self._stream.status.apply(self._stream, arguments);                                                         // 965
  },                                                                                                                   // 966
                                                                                                                       // 967
  /**                                                                                                                  // 968
   * @summary Force an immediate reconnection attempt if the client is not connected to the server.                    // 969
                                                                                                                       // 970
  This method does nothing if the client is already connected.                                                         // 971
   * @locus Client                                                                                                     // 972
   * @memberOf Meteor                                                                                                  // 973
   */                                                                                                                  // 974
  reconnect: function (/*passthrough args*/) {                                                                         // 975
    var self = this;                                                                                                   // 976
    return self._stream.reconnect.apply(self._stream, arguments);                                                      // 977
  },                                                                                                                   // 978
                                                                                                                       // 979
  /**                                                                                                                  // 980
   * @summary Disconnect the client from the server.                                                                   // 981
   * @locus Client                                                                                                     // 982
   * @memberOf Meteor                                                                                                  // 983
   */                                                                                                                  // 984
  disconnect: function (/*passthrough args*/) {                                                                        // 985
    var self = this;                                                                                                   // 986
    return self._stream.disconnect.apply(self._stream, arguments);                                                     // 987
  },                                                                                                                   // 988
                                                                                                                       // 989
  close: function () {                                                                                                 // 990
    var self = this;                                                                                                   // 991
    return self._stream.disconnect({_permanent: true});                                                                // 992
  },                                                                                                                   // 993
                                                                                                                       // 994
  ///                                                                                                                  // 995
  /// Reactive user system                                                                                             // 996
  ///                                                                                                                  // 997
  userId: function () {                                                                                                // 998
    var self = this;                                                                                                   // 999
    if (self._userIdDeps)                                                                                              // 1000
      self._userIdDeps.depend();                                                                                       // 1001
    return self._userId;                                                                                               // 1002
  },                                                                                                                   // 1003
                                                                                                                       // 1004
  setUserId: function (userId) {                                                                                       // 1005
    var self = this;                                                                                                   // 1006
    // Avoid invalidating dependents if setUserId is called with current value.                                        // 1007
    if (self._userId === userId)                                                                                       // 1008
      return;                                                                                                          // 1009
    self._userId = userId;                                                                                             // 1010
    if (self._userIdDeps)                                                                                              // 1011
      self._userIdDeps.changed();                                                                                      // 1012
  },                                                                                                                   // 1013
                                                                                                                       // 1014
  // Returns true if we are in a state after reconnect of waiting for subs to be                                       // 1015
  // revived or early methods to finish their data, or we are waiting for a                                            // 1016
  // "wait" method to finish.                                                                                          // 1017
  _waitingForQuiescence: function () {                                                                                 // 1018
    var self = this;                                                                                                   // 1019
    return (! _.isEmpty(self._subsBeingRevived) ||                                                                     // 1020
            ! _.isEmpty(self._methodsBlockingQuiescence));                                                             // 1021
  },                                                                                                                   // 1022
                                                                                                                       // 1023
  // Returns true if any method whose message has been sent to the server has                                          // 1024
  // not yet invoked its user callback.                                                                                // 1025
  _anyMethodsAreOutstanding: function () {                                                                             // 1026
    var self = this;                                                                                                   // 1027
    return _.any(_.pluck(self._methodInvokers, 'sentMessage'));                                                        // 1028
  },                                                                                                                   // 1029
                                                                                                                       // 1030
  _livedata_connected: function (msg) {                                                                                // 1031
    var self = this;                                                                                                   // 1032
                                                                                                                       // 1033
    if (self._version !== 'pre1' && self._heartbeatInterval !== 0) {                                                   // 1034
      self._heartbeat = new Heartbeat({                                                                                // 1035
        heartbeatInterval: self._heartbeatInterval,                                                                    // 1036
        heartbeatTimeout: self._heartbeatTimeout,                                                                      // 1037
        onTimeout: function () {                                                                                       // 1038
          if (Meteor.isClient && ! self._stream._isStub) {                                                             // 1039
            // only print on the client. this message is useful on the                                                 // 1040
            // browser console to see that we've lost connection. on the                                               // 1041
            // server (eg when doing server-to-server DDP), it gets                                                    // 1042
            // kinda annoying. also this matches the behavior with                                                     // 1043
            // sockjs timeouts.                                                                                        // 1044
            Meteor._debug("Connection timeout. No DDP heartbeat received.");                                           // 1045
          }                                                                                                            // 1046
          self._lostConnection();                                                                                      // 1047
        },                                                                                                             // 1048
        sendPing: function () {                                                                                        // 1049
          self._send({msg: 'ping'});                                                                                   // 1050
        }                                                                                                              // 1051
      });                                                                                                              // 1052
      self._heartbeat.start();                                                                                         // 1053
    }                                                                                                                  // 1054
                                                                                                                       // 1055
    // If this is a reconnect, we'll have to reset all stores.                                                         // 1056
    if (self._lastSessionId)                                                                                           // 1057
      self._resetStores = true;                                                                                        // 1058
                                                                                                                       // 1059
    if (typeof (msg.session) === "string") {                                                                           // 1060
      var reconnectedToPreviousSession = (self._lastSessionId === msg.session);                                        // 1061
      self._lastSessionId = msg.session;                                                                               // 1062
    }                                                                                                                  // 1063
                                                                                                                       // 1064
    if (reconnectedToPreviousSession) {                                                                                // 1065
      // Successful reconnection -- pick up where we left off.  Note that right                                        // 1066
      // now, this never happens: the server never connects us to a previous                                           // 1067
      // session, because DDP doesn't provide enough data for the server to know                                       // 1068
      // what messages the client has processed. We need to improve DDP to make                                        // 1069
      // this possible, at which point we'll probably need more code here.                                             // 1070
      return;                                                                                                          // 1071
    }                                                                                                                  // 1072
                                                                                                                       // 1073
    // Server doesn't have our data any more. Re-sync a new session.                                                   // 1074
                                                                                                                       // 1075
    // Forget about messages we were buffering for unknown collections. They'll                                        // 1076
    // be resent if still relevant.                                                                                    // 1077
    self._updatesForUnknownStores = {};                                                                                // 1078
                                                                                                                       // 1079
    if (self._resetStores) {                                                                                           // 1080
      // Forget about the effects of stubs. We'll be resetting all collections                                         // 1081
      // anyway.                                                                                                       // 1082
      self._documentsWrittenByStub = {};                                                                               // 1083
      self._serverDocuments = {};                                                                                      // 1084
    }                                                                                                                  // 1085
                                                                                                                       // 1086
    // Clear _afterUpdateCallbacks.                                                                                    // 1087
    self._afterUpdateCallbacks = [];                                                                                   // 1088
                                                                                                                       // 1089
    // Mark all named subscriptions which are ready (ie, we already called the                                         // 1090
    // ready callback) as needing to be revived.                                                                       // 1091
    // XXX We should also block reconnect quiescence until unnamed subscriptions                                       // 1092
    //     (eg, autopublish) are done re-publishing to avoid flicker!                                                  // 1093
    self._subsBeingRevived = {};                                                                                       // 1094
    _.each(self._subscriptions, function (sub, id) {                                                                   // 1095
      if (sub.ready)                                                                                                   // 1096
        self._subsBeingRevived[id] = true;                                                                             // 1097
    });                                                                                                                // 1098
                                                                                                                       // 1099
    // Arrange for "half-finished" methods to have their callbacks run, and                                            // 1100
    // track methods that were sent on this connection so that we don't                                                // 1101
    // quiesce until they are all done.                                                                                // 1102
    //                                                                                                                 // 1103
    // Start by clearing _methodsBlockingQuiescence: methods sent before                                               // 1104
    // reconnect don't matter, and any "wait" methods sent on the new connection                                       // 1105
    // that we drop here will be restored by the loop below.                                                           // 1106
    self._methodsBlockingQuiescence = {};                                                                              // 1107
    if (self._resetStores) {                                                                                           // 1108
      _.each(self._methodInvokers, function (invoker) {                                                                // 1109
        if (invoker.gotResult()) {                                                                                     // 1110
          // This method already got its result, but it didn't call its callback                                       // 1111
          // because its data didn't become visible. We did not resend the                                             // 1112
          // method RPC. We'll call its callback when we get a full quiesce,                                           // 1113
          // since that's as close as we'll get to "data must be visible".                                             // 1114
          self._afterUpdateCallbacks.push(_.bind(invoker.dataVisible, invoker));                                       // 1115
        } else if (invoker.sentMessage) {                                                                              // 1116
          // This method has been sent on this connection (maybe as a resend                                           // 1117
          // from the last connection, maybe from onReconnect, maybe just very                                         // 1118
          // quickly before processing the connected message).                                                         // 1119
          //                                                                                                           // 1120
          // We don't need to do anything special to ensure its callbacks get                                          // 1121
          // called, but we'll count it as a method which is preventing                                                // 1122
          // reconnect quiescence. (eg, it might be a login method that was run                                        // 1123
          // from onReconnect, and we don't want to see flicker by seeing a                                            // 1124
          // logged-out state.)                                                                                        // 1125
          self._methodsBlockingQuiescence[invoker.methodId] = true;                                                    // 1126
        }                                                                                                              // 1127
      });                                                                                                              // 1128
    }                                                                                                                  // 1129
                                                                                                                       // 1130
    self._messagesBufferedUntilQuiescence = [];                                                                        // 1131
                                                                                                                       // 1132
    // If we're not waiting on any methods or subs, we can reset the stores and                                        // 1133
    // call the callbacks immediately.                                                                                 // 1134
    if (!self._waitingForQuiescence()) {                                                                               // 1135
      if (self._resetStores) {                                                                                         // 1136
        _.each(self._stores, function (s) {                                                                            // 1137
          s.beginUpdate(0, true);                                                                                      // 1138
          s.endUpdate();                                                                                               // 1139
        });                                                                                                            // 1140
        self._resetStores = false;                                                                                     // 1141
      }                                                                                                                // 1142
      self._runAfterUpdateCallbacks();                                                                                 // 1143
    }                                                                                                                  // 1144
  },                                                                                                                   // 1145
                                                                                                                       // 1146
                                                                                                                       // 1147
  _processOneDataMessage: function (msg, updates) {                                                                    // 1148
    var self = this;                                                                                                   // 1149
    // Using underscore here so as not to need to capitalize.                                                          // 1150
    self['_process_' + msg.msg](msg, updates);                                                                         // 1151
  },                                                                                                                   // 1152
                                                                                                                       // 1153
                                                                                                                       // 1154
  _livedata_data: function (msg) {                                                                                     // 1155
    var self = this;                                                                                                   // 1156
                                                                                                                       // 1157
    // collection name -> array of messages                                                                            // 1158
    var updates = {};                                                                                                  // 1159
                                                                                                                       // 1160
    if (self._waitingForQuiescence()) {                                                                                // 1161
      self._messagesBufferedUntilQuiescence.push(msg);                                                                 // 1162
                                                                                                                       // 1163
      if (msg.msg === "nosub")                                                                                         // 1164
        delete self._subsBeingRevived[msg.id];                                                                         // 1165
                                                                                                                       // 1166
      _.each(msg.subs || [], function (subId) {                                                                        // 1167
        delete self._subsBeingRevived[subId];                                                                          // 1168
      });                                                                                                              // 1169
      _.each(msg.methods || [], function (methodId) {                                                                  // 1170
        delete self._methodsBlockingQuiescence[methodId];                                                              // 1171
      });                                                                                                              // 1172
                                                                                                                       // 1173
      if (self._waitingForQuiescence())                                                                                // 1174
        return;                                                                                                        // 1175
                                                                                                                       // 1176
      // No methods or subs are blocking quiescence!                                                                   // 1177
      // We'll now process and all of our buffered messages, reset all stores,                                         // 1178
      // and apply them all at once.                                                                                   // 1179
      _.each(self._messagesBufferedUntilQuiescence, function (bufferedMsg) {                                           // 1180
        self._processOneDataMessage(bufferedMsg, updates);                                                             // 1181
      });                                                                                                              // 1182
      self._messagesBufferedUntilQuiescence = [];                                                                      // 1183
    } else {                                                                                                           // 1184
      self._processOneDataMessage(msg, updates);                                                                       // 1185
    }                                                                                                                  // 1186
                                                                                                                       // 1187
    if (self._resetStores || !_.isEmpty(updates)) {                                                                    // 1188
      // Begin a transactional update of each store.                                                                   // 1189
      _.each(self._stores, function (s, storeName) {                                                                   // 1190
        s.beginUpdate(_.has(updates, storeName) ? updates[storeName].length : 0,                                       // 1191
                      self._resetStores);                                                                              // 1192
      });                                                                                                              // 1193
      self._resetStores = false;                                                                                       // 1194
                                                                                                                       // 1195
      _.each(updates, function (updateMessages, storeName) {                                                           // 1196
        var store = self._stores[storeName];                                                                           // 1197
        if (store) {                                                                                                   // 1198
          _.each(updateMessages, function (updateMessage) {                                                            // 1199
            store.update(updateMessage);                                                                               // 1200
          });                                                                                                          // 1201
        } else {                                                                                                       // 1202
          // Nobody's listening for this data. Queue it up until                                                       // 1203
          // someone wants it.                                                                                         // 1204
          // XXX memory use will grow without bound if you forget to                                                   // 1205
          // create a collection or just don't care about it... going                                                  // 1206
          // to have to do something about that.                                                                       // 1207
          if (!_.has(self._updatesForUnknownStores, storeName))                                                        // 1208
            self._updatesForUnknownStores[storeName] = [];                                                             // 1209
          Array.prototype.push.apply(self._updatesForUnknownStores[storeName],                                         // 1210
                                     updateMessages);                                                                  // 1211
        }                                                                                                              // 1212
      });                                                                                                              // 1213
                                                                                                                       // 1214
      // End update transaction.                                                                                       // 1215
      _.each(self._stores, function (s) { s.endUpdate(); });                                                           // 1216
    }                                                                                                                  // 1217
                                                                                                                       // 1218
    self._runAfterUpdateCallbacks();                                                                                   // 1219
  },                                                                                                                   // 1220
                                                                                                                       // 1221
  // Call any callbacks deferred with _runWhenAllServerDocsAreFlushed whose                                            // 1222
  // relevant docs have been flushed, as well as dataVisible callbacks at                                              // 1223
  // reconnect-quiescence time.                                                                                        // 1224
  _runAfterUpdateCallbacks: function () {                                                                              // 1225
    var self = this;                                                                                                   // 1226
    var callbacks = self._afterUpdateCallbacks;                                                                        // 1227
    self._afterUpdateCallbacks = [];                                                                                   // 1228
    _.each(callbacks, function (c) {                                                                                   // 1229
      c();                                                                                                             // 1230
    });                                                                                                                // 1231
  },                                                                                                                   // 1232
                                                                                                                       // 1233
  _pushUpdate: function (updates, collection, msg) {                                                                   // 1234
    var self = this;                                                                                                   // 1235
    if (!_.has(updates, collection)) {                                                                                 // 1236
      updates[collection] = [];                                                                                        // 1237
    }                                                                                                                  // 1238
    updates[collection].push(msg);                                                                                     // 1239
  },                                                                                                                   // 1240
                                                                                                                       // 1241
  _getServerDoc: function (collection, id) {                                                                           // 1242
    var self = this;                                                                                                   // 1243
    if (!_.has(self._serverDocuments, collection))                                                                     // 1244
      return null;                                                                                                     // 1245
    var serverDocsForCollection = self._serverDocuments[collection];                                                   // 1246
    return serverDocsForCollection.get(id) || null;                                                                    // 1247
  },                                                                                                                   // 1248
                                                                                                                       // 1249
  _process_added: function (msg, updates) {                                                                            // 1250
    var self = this;                                                                                                   // 1251
    var id = LocalCollection._idParse(msg.id);                                                                         // 1252
    var serverDoc = self._getServerDoc(msg.collection, id);                                                            // 1253
    if (serverDoc) {                                                                                                   // 1254
      // Some outstanding stub wrote here.                                                                             // 1255
      if (serverDoc.document !== undefined)                                                                            // 1256
        throw new Error("Server sent add for existing id: " + msg.id);                                                 // 1257
      serverDoc.document = msg.fields || {};                                                                           // 1258
      serverDoc.document._id = id;                                                                                     // 1259
    } else {                                                                                                           // 1260
      self._pushUpdate(updates, msg.collection, msg);                                                                  // 1261
    }                                                                                                                  // 1262
  },                                                                                                                   // 1263
                                                                                                                       // 1264
  _process_changed: function (msg, updates) {                                                                          // 1265
    var self = this;                                                                                                   // 1266
    var serverDoc = self._getServerDoc(                                                                                // 1267
      msg.collection, LocalCollection._idParse(msg.id));                                                               // 1268
    if (serverDoc) {                                                                                                   // 1269
      if (serverDoc.document === undefined)                                                                            // 1270
        throw new Error("Server sent changed for nonexisting id: " + msg.id);                                          // 1271
      LocalCollection._applyChanges(serverDoc.document, msg.fields);                                                   // 1272
    } else {                                                                                                           // 1273
      self._pushUpdate(updates, msg.collection, msg);                                                                  // 1274
    }                                                                                                                  // 1275
  },                                                                                                                   // 1276
                                                                                                                       // 1277
  _process_removed: function (msg, updates) {                                                                          // 1278
    var self = this;                                                                                                   // 1279
    var serverDoc = self._getServerDoc(                                                                                // 1280
      msg.collection, LocalCollection._idParse(msg.id));                                                               // 1281
    if (serverDoc) {                                                                                                   // 1282
      // Some outstanding stub wrote here.                                                                             // 1283
      if (serverDoc.document === undefined)                                                                            // 1284
        throw new Error("Server sent removed for nonexisting id:" + msg.id);                                           // 1285
      serverDoc.document = undefined;                                                                                  // 1286
    } else {                                                                                                           // 1287
      self._pushUpdate(updates, msg.collection, {                                                                      // 1288
        msg: 'removed',                                                                                                // 1289
        collection: msg.collection,                                                                                    // 1290
        id: msg.id                                                                                                     // 1291
      });                                                                                                              // 1292
    }                                                                                                                  // 1293
  },                                                                                                                   // 1294
                                                                                                                       // 1295
  _process_updated: function (msg, updates) {                                                                          // 1296
    var self = this;                                                                                                   // 1297
    // Process "method done" messages.                                                                                 // 1298
    _.each(msg.methods, function (methodId) {                                                                          // 1299
      _.each(self._documentsWrittenByStub[methodId], function (written) {                                              // 1300
        var serverDoc = self._getServerDoc(written.collection, written.id);                                            // 1301
        if (!serverDoc)                                                                                                // 1302
          throw new Error("Lost serverDoc for " + JSON.stringify(written));                                            // 1303
        if (!serverDoc.writtenByStubs[methodId])                                                                       // 1304
          throw new Error("Doc " + JSON.stringify(written) +                                                           // 1305
                          " not written by  method " + methodId);                                                      // 1306
        delete serverDoc.writtenByStubs[methodId];                                                                     // 1307
        if (_.isEmpty(serverDoc.writtenByStubs)) {                                                                     // 1308
          // All methods whose stubs wrote this method have completed! We can                                          // 1309
          // now copy the saved document to the database (reverting the stub's                                         // 1310
          // change if the server did not write to this object, or applying the                                        // 1311
          // server's writes if it did).                                                                               // 1312
                                                                                                                       // 1313
          // This is a fake ddp 'replace' message.  It's just for talking                                              // 1314
          // between livedata connections and minimongo.  (We have to stringify                                        // 1315
          // the ID because it's supposed to look like a wire message.)                                                // 1316
          self._pushUpdate(updates, written.collection, {                                                              // 1317
            msg: 'replace',                                                                                            // 1318
            id: LocalCollection._idStringify(written.id),                                                              // 1319
            replace: serverDoc.document                                                                                // 1320
          });                                                                                                          // 1321
          // Call all flush callbacks.                                                                                 // 1322
          _.each(serverDoc.flushCallbacks, function (c) {                                                              // 1323
            c();                                                                                                       // 1324
          });                                                                                                          // 1325
                                                                                                                       // 1326
          // Delete this completed serverDocument. Don't bother to GC empty                                            // 1327
          // IdMaps inside self._serverDocuments, since there probably aren't                                          // 1328
          // many collections and they'll be written repeatedly.                                                       // 1329
          self._serverDocuments[written.collection].remove(written.id);                                                // 1330
        }                                                                                                              // 1331
      });                                                                                                              // 1332
      delete self._documentsWrittenByStub[methodId];                                                                   // 1333
                                                                                                                       // 1334
      // We want to call the data-written callback, but we can't do so until all                                       // 1335
      // currently buffered messages are flushed.                                                                      // 1336
      var callbackInvoker = self._methodInvokers[methodId];                                                            // 1337
      if (!callbackInvoker)                                                                                            // 1338
        throw new Error("No callback invoker for method " + methodId);                                                 // 1339
      self._runWhenAllServerDocsAreFlushed(                                                                            // 1340
        _.bind(callbackInvoker.dataVisible, callbackInvoker));                                                         // 1341
    });                                                                                                                // 1342
  },                                                                                                                   // 1343
                                                                                                                       // 1344
  _process_ready: function (msg, updates) {                                                                            // 1345
    var self = this;                                                                                                   // 1346
    // Process "sub ready" messages. "sub ready" messages don't take effect                                            // 1347
    // until all current server documents have been flushed to the local                                               // 1348
    // database. We can use a write fence to implement this.                                                           // 1349
    _.each(msg.subs, function (subId) {                                                                                // 1350
      self._runWhenAllServerDocsAreFlushed(function () {                                                               // 1351
        var subRecord = self._subscriptions[subId];                                                                    // 1352
        // Did we already unsubscribe?                                                                                 // 1353
        if (!subRecord)                                                                                                // 1354
          return;                                                                                                      // 1355
        // Did we already receive a ready message? (Oops!)                                                             // 1356
        if (subRecord.ready)                                                                                           // 1357
          return;                                                                                                      // 1358
        subRecord.readyCallback && subRecord.readyCallback();                                                          // 1359
        subRecord.ready = true;                                                                                        // 1360
        subRecord.readyDeps.changed();                                                                                 // 1361
      });                                                                                                              // 1362
    });                                                                                                                // 1363
  },                                                                                                                   // 1364
                                                                                                                       // 1365
  // Ensures that "f" will be called after all documents currently in                                                  // 1366
  // _serverDocuments have been written to the local cache. f will not be called                                       // 1367
  // if the connection is lost before then!                                                                            // 1368
  _runWhenAllServerDocsAreFlushed: function (f) {                                                                      // 1369
    var self = this;                                                                                                   // 1370
    var runFAfterUpdates = function () {                                                                               // 1371
      self._afterUpdateCallbacks.push(f);                                                                              // 1372
    };                                                                                                                 // 1373
    var unflushedServerDocCount = 0;                                                                                   // 1374
    var onServerDocFlush = function () {                                                                               // 1375
      --unflushedServerDocCount;                                                                                       // 1376
      if (unflushedServerDocCount === 0) {                                                                             // 1377
        // This was the last doc to flush! Arrange to run f after the updates                                          // 1378
        // have been applied.                                                                                          // 1379
        runFAfterUpdates();                                                                                            // 1380
      }                                                                                                                // 1381
    };                                                                                                                 // 1382
    _.each(self._serverDocuments, function (collectionDocs) {                                                          // 1383
      collectionDocs.forEach(function (serverDoc) {                                                                    // 1384
        var writtenByStubForAMethodWithSentMessage = _.any(                                                            // 1385
          serverDoc.writtenByStubs, function (dummy, methodId) {                                                       // 1386
            var invoker = self._methodInvokers[methodId];                                                              // 1387
            return invoker && invoker.sentMessage;                                                                     // 1388
          });                                                                                                          // 1389
        if (writtenByStubForAMethodWithSentMessage) {                                                                  // 1390
          ++unflushedServerDocCount;                                                                                   // 1391
          serverDoc.flushCallbacks.push(onServerDocFlush);                                                             // 1392
        }                                                                                                              // 1393
      });                                                                                                              // 1394
    });                                                                                                                // 1395
    if (unflushedServerDocCount === 0) {                                                                               // 1396
      // There aren't any buffered docs --- we can call f as soon as the current                                       // 1397
      // round of updates is applied!                                                                                  // 1398
      runFAfterUpdates();                                                                                              // 1399
    }                                                                                                                  // 1400
  },                                                                                                                   // 1401
                                                                                                                       // 1402
  _livedata_nosub: function (msg) {                                                                                    // 1403
    var self = this;                                                                                                   // 1404
                                                                                                                       // 1405
    // First pass it through _livedata_data, which only uses it to help get                                            // 1406
    // towards quiescence.                                                                                             // 1407
    self._livedata_data(msg);                                                                                          // 1408
                                                                                                                       // 1409
    // Do the rest of our processing immediately, with no                                                              // 1410
    // buffering-until-quiescence.                                                                                     // 1411
                                                                                                                       // 1412
    // we weren't subbed anyway, or we initiated the unsub.                                                            // 1413
    if (!_.has(self._subscriptions, msg.id))                                                                           // 1414
      return;                                                                                                          // 1415
    var errorCallback = self._subscriptions[msg.id].errorCallback;                                                     // 1416
    self._subscriptions[msg.id].remove();                                                                              // 1417
    if (errorCallback && msg.error) {                                                                                  // 1418
      errorCallback(new Meteor.Error(                                                                                  // 1419
        msg.error.error, msg.error.reason, msg.error.details));                                                        // 1420
    }                                                                                                                  // 1421
  },                                                                                                                   // 1422
                                                                                                                       // 1423
  _process_nosub: function () {                                                                                        // 1424
    // This is called as part of the "buffer until quiescence" process, but                                            // 1425
    // nosub's effect is always immediate. It only goes in the buffer at all                                           // 1426
    // because it's possible for a nosub to be the thing that triggers                                                 // 1427
    // quiescence, if we were waiting for a sub to be revived and it dies                                              // 1428
    // instead.                                                                                                        // 1429
  },                                                                                                                   // 1430
                                                                                                                       // 1431
  _livedata_result: function (msg) {                                                                                   // 1432
    // id, result or error. error has error (code), reason, details                                                    // 1433
                                                                                                                       // 1434
    var self = this;                                                                                                   // 1435
                                                                                                                       // 1436
    // find the outstanding request                                                                                    // 1437
    // should be O(1) in nearly all realistic use cases                                                                // 1438
    if (_.isEmpty(self._outstandingMethodBlocks)) {                                                                    // 1439
      Meteor._debug("Received method result but no methods outstanding");                                              // 1440
      return;                                                                                                          // 1441
    }                                                                                                                  // 1442
    var currentMethodBlock = self._outstandingMethodBlocks[0].methods;                                                 // 1443
    var m;                                                                                                             // 1444
    for (var i = 0; i < currentMethodBlock.length; i++) {                                                              // 1445
      m = currentMethodBlock[i];                                                                                       // 1446
      if (m.methodId === msg.id)                                                                                       // 1447
        break;                                                                                                         // 1448
    }                                                                                                                  // 1449
                                                                                                                       // 1450
    if (!m) {                                                                                                          // 1451
      Meteor._debug("Can't match method response to original method call", msg);                                       // 1452
      return;                                                                                                          // 1453
    }                                                                                                                  // 1454
                                                                                                                       // 1455
    // Remove from current method block. This may leave the block empty, but we                                        // 1456
    // don't move on to the next block until the callback has been delivered, in                                       // 1457
    // _outstandingMethodFinished.                                                                                     // 1458
    currentMethodBlock.splice(i, 1);                                                                                   // 1459
                                                                                                                       // 1460
    if (_.has(msg, 'error')) {                                                                                         // 1461
      m.receiveResult(new Meteor.Error(                                                                                // 1462
        msg.error.error, msg.error.reason,                                                                             // 1463
        msg.error.details));                                                                                           // 1464
    } else {                                                                                                           // 1465
      // msg.result may be undefined if the method didn't return a                                                     // 1466
      // value                                                                                                         // 1467
      m.receiveResult(undefined, msg.result);                                                                          // 1468
    }                                                                                                                  // 1469
  },                                                                                                                   // 1470
                                                                                                                       // 1471
  // Called by MethodInvoker after a method's callback is invoked.  If this was                                        // 1472
  // the last outstanding method in the current block, runs the next block. If                                         // 1473
  // there are no more methods, consider accepting a hot code push.                                                    // 1474
  _outstandingMethodFinished: function () {                                                                            // 1475
    var self = this;                                                                                                   // 1476
    if (self._anyMethodsAreOutstanding())                                                                              // 1477
      return;                                                                                                          // 1478
                                                                                                                       // 1479
    // No methods are outstanding. This should mean that the first block of                                            // 1480
    // methods is empty. (Or it might not exist, if this was a method that                                             // 1481
    // half-finished before disconnect/reconnect.)                                                                     // 1482
    if (! _.isEmpty(self._outstandingMethodBlocks)) {                                                                  // 1483
      var firstBlock = self._outstandingMethodBlocks.shift();                                                          // 1484
      if (! _.isEmpty(firstBlock.methods))                                                                             // 1485
        throw new Error("No methods outstanding but nonempty block: " +                                                // 1486
                        JSON.stringify(firstBlock));                                                                   // 1487
                                                                                                                       // 1488
      // Send the outstanding methods now in the first block.                                                          // 1489
      if (!_.isEmpty(self._outstandingMethodBlocks))                                                                   // 1490
        self._sendOutstandingMethods();                                                                                // 1491
    }                                                                                                                  // 1492
                                                                                                                       // 1493
    // Maybe accept a hot code push.                                                                                   // 1494
    self._maybeMigrate();                                                                                              // 1495
  },                                                                                                                   // 1496
                                                                                                                       // 1497
  // Sends messages for all the methods in the first block in                                                          // 1498
  // _outstandingMethodBlocks.                                                                                         // 1499
  _sendOutstandingMethods: function() {                                                                                // 1500
    var self = this;                                                                                                   // 1501
    if (_.isEmpty(self._outstandingMethodBlocks))                                                                      // 1502
      return;                                                                                                          // 1503
    _.each(self._outstandingMethodBlocks[0].methods, function (m) {                                                    // 1504
      m.sendMessage();                                                                                                 // 1505
    });                                                                                                                // 1506
  },                                                                                                                   // 1507
                                                                                                                       // 1508
  _livedata_error: function (msg) {                                                                                    // 1509
    Meteor._debug("Received error from server: ", msg.reason);                                                         // 1510
    if (msg.offendingMessage)                                                                                          // 1511
      Meteor._debug("For: ", msg.offendingMessage);                                                                    // 1512
  },                                                                                                                   // 1513
                                                                                                                       // 1514
  _callOnReconnectAndSendAppropriateOutstandingMethods: function() {                                                   // 1515
    var self = this;                                                                                                   // 1516
    var oldOutstandingMethodBlocks = self._outstandingMethodBlocks;                                                    // 1517
    self._outstandingMethodBlocks = [];                                                                                // 1518
                                                                                                                       // 1519
    self.onReconnect();                                                                                                // 1520
                                                                                                                       // 1521
    if (_.isEmpty(oldOutstandingMethodBlocks))                                                                         // 1522
      return;                                                                                                          // 1523
                                                                                                                       // 1524
    // We have at least one block worth of old outstanding methods to try                                              // 1525
    // again. First: did onReconnect actually send anything? If not, we just                                           // 1526
    // restore all outstanding methods and run the first block.                                                        // 1527
    if (_.isEmpty(self._outstandingMethodBlocks)) {                                                                    // 1528
      self._outstandingMethodBlocks = oldOutstandingMethodBlocks;                                                      // 1529
      self._sendOutstandingMethods();                                                                                  // 1530
      return;                                                                                                          // 1531
    }                                                                                                                  // 1532
                                                                                                                       // 1533
    // OK, there are blocks on both sides. Special case: merge the last block of                                       // 1534
    // the reconnect methods with the first block of the original methods, if                                          // 1535
    // neither of them are "wait" blocks.                                                                              // 1536
    if (!_.last(self._outstandingMethodBlocks).wait &&                                                                 // 1537
        !oldOutstandingMethodBlocks[0].wait) {                                                                         // 1538
      _.each(oldOutstandingMethodBlocks[0].methods, function (m) {                                                     // 1539
        _.last(self._outstandingMethodBlocks).methods.push(m);                                                         // 1540
                                                                                                                       // 1541
        // If this "last block" is also the first block, send the message.                                             // 1542
        if (self._outstandingMethodBlocks.length === 1)                                                                // 1543
          m.sendMessage();                                                                                             // 1544
      });                                                                                                              // 1545
                                                                                                                       // 1546
      oldOutstandingMethodBlocks.shift();                                                                              // 1547
    }                                                                                                                  // 1548
                                                                                                                       // 1549
    // Now add the rest of the original blocks on.                                                                     // 1550
    _.each(oldOutstandingMethodBlocks, function (block) {                                                              // 1551
      self._outstandingMethodBlocks.push(block);                                                                       // 1552
    });                                                                                                                // 1553
  },                                                                                                                   // 1554
                                                                                                                       // 1555
  // We can accept a hot code push if there are no methods in flight.                                                  // 1556
  _readyToMigrate: function() {                                                                                        // 1557
    var self = this;                                                                                                   // 1558
    return _.isEmpty(self._methodInvokers);                                                                            // 1559
  },                                                                                                                   // 1560
                                                                                                                       // 1561
  // If we were blocking a migration, see if it's now possible to continue.                                            // 1562
  // Call whenever the set of outstanding/blocked methods shrinks.                                                     // 1563
  _maybeMigrate: function () {                                                                                         // 1564
    var self = this;                                                                                                   // 1565
    if (self._retryMigrate && self._readyToMigrate()) {                                                                // 1566
      self._retryMigrate();                                                                                            // 1567
      self._retryMigrate = null;                                                                                       // 1568
    }                                                                                                                  // 1569
  }                                                                                                                    // 1570
});                                                                                                                    // 1571
                                                                                                                       // 1572
LivedataTest.Connection = Connection;                                                                                  // 1573
                                                                                                                       // 1574
// @param url {String} URL to Meteor app,                                                                              // 1575
//     e.g.:                                                                                                           // 1576
//     "subdomain.meteor.com",                                                                                         // 1577
//     "http://subdomain.meteor.com",                                                                                  // 1578
//     "/",                                                                                                            // 1579
//     "ddp+sockjs://ddp--****-foo.meteor.com/sockjs"                                                                  // 1580
                                                                                                                       // 1581
/**                                                                                                                    // 1582
 * @summary Connect to the server of a different Meteor application to subscribe to its document sets and invoke its remote methods.
 * @locus Anywhere                                                                                                     // 1584
 * @param {String} url The URL of another Meteor application.                                                          // 1585
 */                                                                                                                    // 1586
DDP.connect = function (url, options) {                                                                                // 1587
  var ret = new Connection(url, options);                                                                              // 1588
  allConnections.push(ret); // hack. see below.                                                                        // 1589
  return ret;                                                                                                          // 1590
};                                                                                                                     // 1591
                                                                                                                       // 1592
// Hack for `spiderable` package: a way to see if the page is done                                                     // 1593
// loading all the data it needs.                                                                                      // 1594
//                                                                                                                     // 1595
allConnections = [];                                                                                                   // 1596
DDP._allSubscriptionsReady = function () {                                                                             // 1597
  return _.all(allConnections, function (conn) {                                                                       // 1598
    return _.all(conn._subscriptions, function (sub) {                                                                 // 1599
      return sub.ready;                                                                                                // 1600
    });                                                                                                                // 1601
  });                                                                                                                  // 1602
};                                                                                                                     // 1603
                                                                                                                       // 1604
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp/server_convenience.js                                                                                  //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
// Only create a server if we are in an environment with a HTTP server                                                 // 1
// (as opposed to, eg, a command-line tool).                                                                           // 2
//                                                                                                                     // 3
if (Package.webapp) {                                                                                                  // 4
  if (process.env.DDP_DEFAULT_CONNECTION_URL) {                                                                        // 5
    __meteor_runtime_config__.DDP_DEFAULT_CONNECTION_URL =                                                             // 6
      process.env.DDP_DEFAULT_CONNECTION_URL;                                                                          // 7
  }                                                                                                                    // 8
                                                                                                                       // 9
  Meteor.server = new Server;                                                                                          // 10
                                                                                                                       // 11
  Meteor.refresh = function (notification) {                                                                           // 12
    DDPServer._InvalidationCrossbar.fire(notification);                                                                // 13
  };                                                                                                                   // 14
                                                                                                                       // 15
  // Proxy the public methods of Meteor.server so they can                                                             // 16
  // be called directly on Meteor.                                                                                     // 17
  _.each(['publish', 'methods', 'call', 'apply', 'onConnection'],                                                      // 18
         function (name) {                                                                                             // 19
           Meteor[name] = _.bind(Meteor.server[name], Meteor.server);                                                  // 20
         });                                                                                                           // 21
} else {                                                                                                               // 22
  // No server? Make these empty/no-ops.                                                                               // 23
  Meteor.server = null;                                                                                                // 24
  Meteor.refresh = function (notification) {                                                                           // 25
  };                                                                                                                   // 26
}                                                                                                                      // 27
                                                                                                                       // 28
// Meteor.server used to be called Meteor.default_server. Provide                                                      // 29
// backcompat as a courtesy even though it was never documented.                                                       // 30
// XXX COMPAT WITH 0.6.4                                                                                               // 31
Meteor.default_server = Meteor.server;                                                                                 // 32
                                                                                                                       // 33
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package.ddp = {
  DDP: DDP,
  DDPServer: DDPServer,
  LivedataTest: LivedataTest
};

})();

//# sourceMappingURL=ddp.js.map
