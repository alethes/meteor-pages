(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var Blaze = Package.blaze.Blaze;
var UI = Package.blaze.UI;
var Handlebars = Package.blaze.Handlebars;
var _ = Package.underscore._;
var Iron = Package['iron:core'].Iron;
var HTML = Package.htmljs.HTML;

/* Package-scope variables */
var findFirstLayout, Layout, DEFAULT_REGION;

(function () {

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                            //
// packages/iron:layout/version_conflict_errors.js                                                            //
//                                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                              //
var errors = [];                                                                                              // 1
                                                                                                              // 2
if (Package['cmather:iron-layout']) {                                                                         // 3
  errors.push("\n\n\
    The cmather:iron-{x} packages were migrated to the new package system with the wrong name, and you have duplicate copies.\n\
    You can see which cmather:iron-{x} packages have been installed by using this command:\n\n\
    > meteor list\n\n\
    Can you remove any installed cmather:iron-{x} packages like this:\
    \n\n\
    > meteor remove cmather:iron-core\n\
    > meteor remove cmather:iron-router\n\
    > meteor remove cmather:iron-dynamic-template\n\
    > meteor remove cmather:iron-dynamic-layout\n\
    \n\
    The new packages are named iron:{x}. For example:\n\n\
    > meteor add iron:router\n\n\
    Sorry for the hassle, but thank you!\
    \n\n\
  ");                                                                                                         // 19
}                                                                                                             // 20
                                                                                                              // 21
// If the user still has blaze-layout throw  an error. Let's get rid of that                                  // 22
// package so it's not lingering around with all its nastiness.                                               // 23
if (Package['cmather:blaze-layout']) {                                                                        // 24
  errors.push(                                                                                                // 25
    "The blaze-layout package has been replaced by iron-layout. Please remove the package like this:\n> meteor remove cmather:blaze-layout\n"
  );                                                                                                          // 27
}                                                                                                             // 28
                                                                                                              // 29
if (errors.length > 0) {                                                                                      // 30
  throw new Error("Sorry! Looks like there's a few errors related to iron:layout\n\n" + errors.join("\n\n")); // 31
}                                                                                                             // 32
                                                                                                              // 33
////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                            //
// packages/iron:layout/layout.js                                                                             //
//                                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                              //
/*****************************************************************************/                               // 1
/* Imports */                                                                                                 // 2
/*****************************************************************************/                               // 3
var DynamicTemplate = Iron.DynamicTemplate;                                                                   // 4
var inherits = Iron.utils.inherits;                                                                           // 5
                                                                                                              // 6
/*****************************************************************************/                               // 7
/* Helpers */                                                                                                 // 8
/*****************************************************************************/                               // 9
/**                                                                                                           // 10
 * Find the first Layout in the rendered parent hierarchy.                                                    // 11
 */                                                                                                           // 12
findFirstLayout = function (view) {                                                                           // 13
  while (view) {                                                                                              // 14
    if (view.name === 'Iron.Layout')                                                                          // 15
      return view.__dynamicTemplate__;                                                                        // 16
    else                                                                                                      // 17
      view = view.parentView;                                                                                 // 18
  }                                                                                                           // 19
                                                                                                              // 20
  return null;                                                                                                // 21
};                                                                                                            // 22
                                                                                                              // 23
/*****************************************************************************/                               // 24
/* Layout */                                                                                                  // 25
/*****************************************************************************/                               // 26
                                                                                                              // 27
/**                                                                                                           // 28
 * Dynamically render templates into regions.                                                                 // 29
 *                                                                                                            // 30
 * Layout inherits from Iron.DynamicTemplate and provides the ability to create                               // 31
 * regions that a user can render templates or content blocks into. The layout                                // 32
 * and each region is an instance of DynamicTemplate so the template and data                                 // 33
 * contexts are completely dynamic and programmable in javascript.                                            // 34
 */                                                                                                           // 35
Layout = function (options) {                                                                                 // 36
  var self = this;                                                                                            // 37
                                                                                                              // 38
  Layout.__super__.constructor.apply(this, arguments);                                                        // 39
                                                                                                              // 40
  options = options || {};                                                                                    // 41
  this.name = 'Iron.Layout';                                                                                  // 42
  this._regions = {};                                                                                         // 43
  this._regionHooks = {};                                                                                     // 44
  this.defaultTemplate('__IronDefaultLayout__');                                                              // 45
                                                                                                              // 46
  // if there's block content then render that                                                                // 47
  // to the main region                                                                                       // 48
  if (options.content)                                                                                        // 49
    this.render(options.content);                                                                             // 50
};                                                                                                            // 51
                                                                                                              // 52
/**                                                                                                           // 53
 * The default region for a layout where the main content will go.                                            // 54
 */                                                                                                           // 55
DEFAULT_REGION = Layout.DEFAULT_REGION = 'main';                                                              // 56
                                                                                                              // 57
/**                                                                                                           // 58
 * Inherits from Iron.DynamicTemplate which gives us the ability to set the                                   // 59
 * template and data context dynamically.                                                                     // 60
 */                                                                                                           // 61
inherits(Layout, Iron.DynamicTemplate);                                                                       // 62
                                                                                                              // 63
/**                                                                                                           // 64
 * Return the DynamicTemplate instance for a given region. If the region doesn't                              // 65
 * exist it is created.                                                                                       // 66
 *                                                                                                            // 67
 * The regions object looks like this:                                                                        // 68
 *                                                                                                            // 69
 *  {                                                                                                         // 70
 *    "main": DynamicTemplate,                                                                                // 71
 *    "footer": DynamicTemplate,                                                                              // 72
 *    .                                                                                                       // 73
 *    .                                                                                                       // 74
 *    .                                                                                                       // 75
 *  }                                                                                                         // 76
 */                                                                                                           // 77
Layout.prototype.region = function (name, options) {                                                          // 78
  return this._ensureRegion(name, options);                                                                   // 79
};                                                                                                            // 80
                                                                                                              // 81
/**                                                                                                           // 82
 * Destroy all child regions and reset the regions map.                                                       // 83
 */                                                                                                           // 84
Layout.prototype.destroyRegions = function () {                                                               // 85
  _.each(this._regions, function (dynamicTemplate) {                                                          // 86
    dynamicTemplate.destroy();                                                                                // 87
  });                                                                                                         // 88
                                                                                                              // 89
  this._regions = {};                                                                                         // 90
};                                                                                                            // 91
                                                                                                              // 92
/**                                                                                                           // 93
 * Set the template for a region.                                                                             // 94
 */                                                                                                           // 95
Layout.prototype.render = function (template, options) {                                                      // 96
  // having options is usually good                                                                           // 97
  options = options || {};                                                                                    // 98
                                                                                                              // 99
  // let the user specify the region to render the template into                                              // 100
  var region = options.to || options.region || DEFAULT_REGION;                                                // 101
                                                                                                              // 102
  // get the DynamicTemplate for this region                                                                  // 103
  var dynamicTemplate = this.region(region);                                                                  // 104
                                                                                                              // 105
  // if we're in a rendering transaction, track that we've rendered this                                      // 106
  // particular region                                                                                        // 107
  this._trackRenderedRegion(region);                                                                          // 108
                                                                                                              // 109
  // set the template value for the dynamic template                                                          // 110
  dynamicTemplate.template(template);                                                                         // 111
                                                                                                              // 112
  // set the data for the region. If options.data is not defined, this will                                   // 113
  // clear the data, which is what we want                                                                    // 114
  dynamicTemplate.data(options.data);                                                                         // 115
};                                                                                                            // 116
                                                                                                              // 117
/**                                                                                                           // 118
 * Returns true if the given region is defined and false otherwise.                                           // 119
 */                                                                                                           // 120
Layout.prototype.has = function (region) {                                                                    // 121
  region = region || Layout.DEFAULT_REGION;                                                                   // 122
  return !!this._regions[region];                                                                             // 123
};                                                                                                            // 124
                                                                                                              // 125
/**                                                                                                           // 126
 * Returns an array of region keys.                                                                           // 127
 */                                                                                                           // 128
Layout.prototype.regionKeys = function () {                                                                   // 129
  return _.keys(this._regions);                                                                               // 130
};                                                                                                            // 131
                                                                                                              // 132
/**                                                                                                           // 133
 * Clear a given region or the "main" region by default.                                                      // 134
 */                                                                                                           // 135
Layout.prototype.clear = function (region) {                                                                  // 136
  region = region || Layout.DEFAULT_REGION;                                                                   // 137
                                                                                                              // 138
  // we don't want to create a region if it didn't exist before                                               // 139
  if (this.has(region))                                                                                       // 140
    this.region(region).template(null);                                                                       // 141
                                                                                                              // 142
  // chain it up                                                                                              // 143
  return this;                                                                                                // 144
};                                                                                                            // 145
                                                                                                              // 146
/**                                                                                                           // 147
 * Clear all regions.                                                                                         // 148
 */                                                                                                           // 149
Layout.prototype.clearAll = function () {                                                                     // 150
  _.each(this._regions, function (dynamicTemplate) {                                                          // 151
    dynamicTemplate.template(null);                                                                           // 152
  });                                                                                                         // 153
                                                                                                              // 154
  // chain it up                                                                                              // 155
  return this;                                                                                                // 156
};                                                                                                            // 157
                                                                                                              // 158
/**                                                                                                           // 159
 * Start tracking rendered regions.                                                                           // 160
 */                                                                                                           // 161
Layout.prototype.beginRendering = function (onComplete) {                                                     // 162
  var self = this;                                                                                            // 163
  if (this._finishRenderingTransaction)                                                                       // 164
    this._finishRenderingTransaction();                                                                       // 165
                                                                                                              // 166
  this._finishRenderingTransaction = _.once(function () {                                                     // 167
    var regions = self._endRendering({flush: false});                                                         // 168
    onComplete && onComplete(regions);                                                                        // 169
  });                                                                                                         // 170
                                                                                                              // 171
  Deps.afterFlush(this._finishRenderingTransaction);                                                          // 172
                                                                                                              // 173
  if (this._renderedRegions)                                                                                  // 174
    throw new Error("You called beginRendering again before calling endRendering");                           // 175
  this._renderedRegions = {};                                                                                 // 176
};                                                                                                            // 177
                                                                                                              // 178
/**                                                                                                           // 179
 * Track a rendered region if we're in a transaction.                                                         // 180
 */                                                                                                           // 181
Layout.prototype._trackRenderedRegion = function (region) {                                                   // 182
  if (!this._renderedRegions)                                                                                 // 183
    return;                                                                                                   // 184
  this._renderedRegions[region] = true;                                                                       // 185
};                                                                                                            // 186
                                                                                                              // 187
/**                                                                                                           // 188
 * Stop a rendering transaction and retrieve the rendered regions. This                                       // 189
 * shouldn't be called directly. Instead, pass an onComplete callback to the                                  // 190
 * beginRendering method.                                                                                     // 191
 */                                                                                                           // 192
Layout.prototype._endRendering = function (opts) {                                                            // 193
  // we flush here to ensure all of the {{#contentFor}} inclusions have had a                                 // 194
  // chance to render from our templates, otherwise we'll never know about                                    // 195
  // them.                                                                                                    // 196
  opts = opts || {};                                                                                          // 197
  if (opts.flush !== false)                                                                                   // 198
    Deps.flush();                                                                                             // 199
  var renderedRegions = this._renderedRegions || {};                                                          // 200
  this._renderedRegions = null;                                                                               // 201
  return _.keys(renderedRegions);                                                                             // 202
};                                                                                                            // 203
                                                                                                              // 204
/**                                                                                                           // 205
 * View lifecycle hooks for regions.                                                                          // 206
 */                                                                                                           // 207
_.each(                                                                                                       // 208
  [                                                                                                           // 209
    'onRegionCreated',                                                                                        // 210
    'onRegionRendered',                                                                                       // 211
    'onRegionDestroyed'                                                                                       // 212
  ],                                                                                                          // 213
  function (hook) {                                                                                           // 214
    Layout.prototype[hook] = function (cb) {                                                                  // 215
      var hooks = this._regionHooks[hook] = this._regionHooks[hook] || [];                                    // 216
      hooks.push(cb);                                                                                         // 217
      return this;                                                                                            // 218
    }                                                                                                         // 219
  }                                                                                                           // 220
);                                                                                                            // 221
                                                                                                              // 222
/**                                                                                                           // 223
 * Returns the DynamicTemplate for a given region or creates it if it doesn't                                 // 224
 * exists yet.                                                                                                // 225
 */                                                                                                           // 226
Layout.prototype._ensureRegion = function (name, options) {                                                   // 227
 return this._regions[name] = this._regions[name] || this._createDynamicTemplate(name, options);              // 228
};                                                                                                            // 229
                                                                                                              // 230
/**                                                                                                           // 231
 * Create a new DynamicTemplate instance.                                                                     // 232
 */                                                                                                           // 233
Layout.prototype._createDynamicTemplate = function (name, options) {                                          // 234
  var self = this;                                                                                            // 235
  var tmpl = new Iron.DynamicTemplate(options);                                                               // 236
  var capitalize = Iron.utils.capitalize;                                                                     // 237
  tmpl._region = name;                                                                                        // 238
                                                                                                              // 239
  _.each(['viewCreated', 'viewReady', 'viewDestroyed'], function (hook) {                                     // 240
    hook = capitalize(hook);                                                                                  // 241
    tmpl['on' + hook](function (dynamicTemplate) {                                                            // 242
      // "this" is the view instance                                                                          // 243
      var view = this;                                                                                        // 244
      var regionHook = ({                                                                                     // 245
        viewCreated: "regionCreated",                                                                         // 246
        viewReady: "regionRendered",                                                                          // 247
        viewDestroyed: "regionDestroyed"                                                                      // 248
      })[hook];                                                                                               // 249
      self._runRegionHooks('on' + regionHook, view, dynamicTemplate);                                         // 250
    });                                                                                                       // 251
  });                                                                                                         // 252
                                                                                                              // 253
  return tmpl;                                                                                                // 254
};                                                                                                            // 255
                                                                                                              // 256
Layout.prototype._runRegionHooks = function (name, regionView, regionDynamicTemplate) {                       // 257
  var layout = this;                                                                                          // 258
  var hooks = this._regionHooks[name] || [];                                                                  // 259
  var hook;                                                                                                   // 260
                                                                                                              // 261
  for (var i = 0; i < hooks.length; i++) {                                                                    // 262
    hook = hooks[i];                                                                                          // 263
    // keep the "thisArg" pointing to the view, but make the first parameter to                               // 264
    // the callback teh dynamic template instance.                                                            // 265
    hook.call(regionView, regionDynamicTemplate.region, regionDynamicTemplate, this);                         // 266
  }                                                                                                           // 267
};                                                                                                            // 268
                                                                                                              // 269
/*****************************************************************************/                               // 270
/* UI Helpers */                                                                                              // 271
/*****************************************************************************/                               // 272
if (typeof Template !== 'undefined') {                                                                        // 273
  /**                                                                                                         // 274
   * Create a region in the closest layout ancestor.                                                          // 275
   *                                                                                                          // 276
   * Examples:                                                                                                // 277
   *    <aside>                                                                                               // 278
   *      {{> yield "aside"}}                                                                                 // 279
   *    </aside>                                                                                              // 280
   *                                                                                                          // 281
   *    <article>                                                                                             // 282
   *      {{> yield}}                                                                                         // 283
   *    </article>                                                                                            // 284
   *                                                                                                          // 285
   *    <footer>                                                                                              // 286
   *      {{> yield "footer"}}                                                                                // 287
   *    </footer>                                                                                             // 288
   */                                                                                                         // 289
  UI.registerHelper('yield', new Template('yield', function () {                                              // 290
    var layout = findFirstLayout(this);                                                                       // 291
                                                                                                              // 292
    if (!layout)                                                                                              // 293
      throw new Error("No Iron.Layout found so you can't use yield!");                                        // 294
                                                                                                              // 295
    // Example options: {{> yield region="footer"}} or {{> yield "footer"}}                                   // 296
    var options = DynamicTemplate.getInclusionArguments(this);                                                // 297
    var region;                                                                                               // 298
    var dynamicTemplate;                                                                                      // 299
                                                                                                              // 300
    if (_.isString(options)) {                                                                                // 301
      region = options;                                                                                       // 302
    } else if (_.isObject(options)) {                                                                         // 303
      region = options.region;                                                                                // 304
    }                                                                                                         // 305
                                                                                                              // 306
    // if there's no region specified we'll assume you meant the main region                                  // 307
    region = region || DEFAULT_REGION;                                                                        // 308
                                                                                                              // 309
    // get or create the region                                                                               // 310
    dynamicTemplate = layout.region(region);                                                                  // 311
                                                                                                              // 312
    // if the dynamicTemplate had already been inserted, let's                                                // 313
    // destroy it before creating a new one.                                                                  // 314
    if (dynamicTemplate.isCreated)                                                                            // 315
      dynamicTemplate.destroy();                                                                              // 316
                                                                                                              // 317
    // now return a newly created view                                                                        // 318
    return dynamicTemplate.create();                                                                          // 319
  }));                                                                                                        // 320
                                                                                                              // 321
  /**                                                                                                         // 322
   * Render a template into a region in the closest layout ancestor from within                               // 323
   * your template markup.                                                                                    // 324
   *                                                                                                          // 325
   * Examples:                                                                                                // 326
   *                                                                                                          // 327
   *  {{#contentFor "footer"}}                                                                                // 328
   *    Footer stuff                                                                                          // 329
   *  {{/contentFor}}                                                                                         // 330
   *                                                                                                          // 331
   *  {{> contentFor region="footer" template="SomeTemplate" data=someData}}                                  // 332
   *                                                                                                          // 333
   * Note: The helper is a UI.Component object instead of a function so that                                  // 334
   * Meteor UI does not create a Deps.Dependency.                                                             // 335
   */                                                                                                         // 336
  UI.registerHelper('contentFor', new Template('contentFor', function () {                                    // 337
    var layout = findFirstLayout(this);                                                                       // 338
                                                                                                              // 339
    if (!layout)                                                                                              // 340
      throw new Error("No Iron.Layout found so you can't use contentFor!");                                   // 341
                                                                                                              // 342
    var options = DynamicTemplate.getInclusionArguments(this) || {}                                           // 343
    var content = this.templateContentBlock;                                                                  // 344
    var template = options.template;                                                                          // 345
    var data = options.data;                                                                                  // 346
    var region;                                                                                               // 347
                                                                                                              // 348
    if (_.isString(options))                                                                                  // 349
      region = options;                                                                                       // 350
    else if (_.isObject(options))                                                                             // 351
      region = options.region;                                                                                // 352
    else                                                                                                      // 353
      throw new Error("Which region is this contentFor block supposed to be for?");                           // 354
                                                                                                              // 355
    // set the region to a provided template or the content directly.                                         // 356
    layout.region(region).template(template || content);                                                      // 357
                                                                                                              // 358
    // tell the layout to track this as a rendered region if we're in a                                       // 359
    // rendering transaction.                                                                                 // 360
    layout._trackRenderedRegion(region);                                                                      // 361
                                                                                                              // 362
    // if we have some data then set the data context                                                         // 363
    if (data)                                                                                                 // 364
      layout.region(region).data(data);                                                                       // 365
                                                                                                              // 366
    // just render nothing into this area of the page since the dynamic template                              // 367
    // will do the actual rendering into the right region.                                                    // 368
    return null;                                                                                              // 369
  }));                                                                                                        // 370
                                                                                                              // 371
  /**                                                                                                         // 372
   * Check to see if a given region is currently rendered to.                                                 // 373
   *                                                                                                          // 374
   * Example:                                                                                                 // 375
   *    {{#if hasRegion 'aside'}}                                                                             // 376
   *      <aside>                                                                                             // 377
   *        {{> yield "aside"}}                                                                               // 378
   *      </aside>                                                                                            // 379
   *    {{/if}}                                                                                               // 380
   */                                                                                                         // 381
  UI.registerHelper('hasRegion', function (region) {                                                          // 382
    var layout = findFirstLayout(Blaze.getView());                                                            // 383
                                                                                                              // 384
    if (!layout)                                                                                              // 385
      throw new Error("No Iron.Layout found so you can't use hasRegion!");                                    // 386
                                                                                                              // 387
    if (!_.isString(region))                                                                                  // 388
      throw new Error("You need to provide an region argument to hasRegion");                                 // 389
                                                                                                              // 390
    return !! layout.region(region).template();                                                               // 391
  });                                                                                                         // 392
                                                                                                              // 393
  /**                                                                                                         // 394
   * Let people use Layout directly from their templates!                                                     // 395
   *                                                                                                          // 396
   * Example:                                                                                                 // 397
   *  {{#Layout template="MyTemplate"}}                                                                       // 398
   *    Main content goes here                                                                                // 399
   *                                                                                                          // 400
   *    {{#contentFor "footer"}}                                                                              // 401
   *      footer goes here                                                                                    // 402
   *    {{/contentFor}}                                                                                       // 403
   *  {{/Layout}}                                                                                             // 404
   */                                                                                                         // 405
  UI.registerHelper('Layout', new Template('layout', function () {                                            // 406
    var args = Iron.DynamicTemplate.args(this);                                                               // 407
                                                                                                              // 408
    var layout = new Layout({                                                                                 // 409
      template: function () { return args('template'); },                                                     // 410
      data: function () { return args('data'); },                                                             // 411
      content: this.templateContentBlock                                                                      // 412
    });                                                                                                       // 413
                                                                                                              // 414
    return layout.create();                                                                                   // 415
  }));                                                                                                        // 416
}                                                                                                             // 417
/*****************************************************************************/                               // 418
/* Namespacing */                                                                                             // 419
/*****************************************************************************/                               // 420
Iron.Layout = Layout;                                                                                         // 421
                                                                                                              // 422
////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['iron:layout'] = {};

})();

//# sourceMappingURL=iron_layout.js.map
