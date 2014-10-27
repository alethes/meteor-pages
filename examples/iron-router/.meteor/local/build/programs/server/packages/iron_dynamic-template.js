(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var Blaze = Package.ui.Blaze;
var UI = Package.ui.UI;
var Handlebars = Package.ui.Handlebars;
var _ = Package.underscore._;
var Tracker = Package.tracker.Tracker;
var Deps = Package.tracker.Deps;
var Iron = Package['iron:core'].Iron;
var HTML = Package.htmljs.HTML;

/* Package-scope variables */
var debug, camelCase, typeOf, DynamicTemplate;

(function () {

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/iron:dynamic-template/version_conflict_error.js                                                       //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
if (Package['cmather:iron-dynamic-template']) {                                                                   // 1
  throw new Error("\n\n\
    Sorry! The cmather:iron-{x} packages were migrated to the new package system with the wrong name, and you have duplicate copies.\n\
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
  ");                                                                                                             // 17
                                                                                                                  // 18
}                                                                                                                 // 19
                                                                                                                  // 20
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/iron:dynamic-template/dynamic_template.js                                                             //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
/*****************************************************************************/                                   // 1
/* Imports */                                                                                                     // 2
/*****************************************************************************/                                   // 3
debug = Iron.utils.debug('iron:dynamic-template');                                                                // 4
camelCase = Iron.utils.camelCase;                                                                                 // 5
                                                                                                                  // 6
/*****************************************************************************/                                   // 7
/* Helpers */                                                                                                     // 8
/*****************************************************************************/                                   // 9
typeOf = function (value) {                                                                                       // 10
  return Object.prototype.toString.call(value);                                                                   // 11
};                                                                                                                // 12
                                                                                                                  // 13
/*****************************************************************************/                                   // 14
/* DynamicTemplate */                                                                                             // 15
/*****************************************************************************/                                   // 16
                                                                                                                  // 17
/**                                                                                                               // 18
 * Render a component to the page whose template and data context can change                                      // 19
 * dynamically, either from code or from helpers.                                                                 // 20
 *                                                                                                                // 21
 */                                                                                                               // 22
DynamicTemplate = function (options) {                                                                            // 23
  this.options = options = options || {};                                                                         // 24
  this._template = options.template;                                                                              // 25
  this._defaultTemplate = options.defaultTemplate;                                                                // 26
  this._content = options.content;                                                                                // 27
  this._data = options.data;                                                                                      // 28
  this._templateDep = new Deps.Dependency;                                                                        // 29
  this._dataDep = new Deps.Dependency;                                                                            // 30
  this._hasControllerDep = new Deps.Dependency;                                                                   // 31
  this._hooks = {};                                                                                               // 32
  this._controller = new Blaze.ReactiveVar;                                                                       // 33
  this.name = options.name || 'DynamicTemplate';                                                                  // 34
                                                                                                                  // 35
  // has the Blaze.View been created?                                                                             // 36
  this.isCreated = false;                                                                                         // 37
                                                                                                                  // 38
  // has the Blaze.View been destroyed and not created again?                                                     // 39
  this.isDestroyed = false;                                                                                       // 40
};                                                                                                                // 41
                                                                                                                  // 42
/**                                                                                                               // 43
 * Get or set the template.                                                                                       // 44
 */                                                                                                               // 45
DynamicTemplate.prototype.template = function (value) {                                                           // 46
  if (arguments.length === 1 && value !== this._template) {                                                       // 47
    this._template = value;                                                                                       // 48
    this._templateDep.changed();                                                                                  // 49
    return;                                                                                                       // 50
  }                                                                                                               // 51
                                                                                                                  // 52
  if (arguments.length > 0)                                                                                       // 53
    return;                                                                                                       // 54
                                                                                                                  // 55
  this._templateDep.depend();                                                                                     // 56
                                                                                                                  // 57
  // do we have a template?                                                                                       // 58
  if (this._template)                                                                                             // 59
    return (typeof this._template === 'function') ? this._template() : this._template;                            // 60
                                                                                                                  // 61
  // no template? ok let's see if we have a default one set                                                       // 62
  if (this._defaultTemplate)                                                                                      // 63
    return (typeof this._defaultTemplate === 'function') ? this._defaultTemplate() : this._defaultTemplate;       // 64
};                                                                                                                // 65
                                                                                                                  // 66
/**                                                                                                               // 67
 * Get or set the default template.                                                                               // 68
 *                                                                                                                // 69
 * This function does not change any dependencies.                                                                // 70
 */                                                                                                               // 71
DynamicTemplate.prototype.defaultTemplate = function (value) {                                                    // 72
  if (arguments.length === 1)                                                                                     // 73
    this._defaultTemplate = value;                                                                                // 74
  else                                                                                                            // 75
    return this._defaultTemplate;                                                                                 // 76
};                                                                                                                // 77
                                                                                                                  // 78
/**                                                                                                               // 79
 * Clear the template and data contexts.                                                                          // 80
 */                                                                                                               // 81
DynamicTemplate.prototype.clear = function () {                                                                   // 82
  //XXX do we need to clear dependencies here too?                                                                // 83
  this._template = undefined;                                                                                     // 84
  this._data = undefined;                                                                                         // 85
  this._templateDep.changed();                                                                                    // 86
};                                                                                                                // 87
                                                                                                                  // 88
/**                                                                                                               // 89
 * Get or set the data context.                                                                                   // 90
 */                                                                                                               // 91
DynamicTemplate.prototype.data = function (value) {                                                               // 92
  if (arguments.length === 1 && value !== this._data) {                                                           // 93
    this._data = value;                                                                                           // 94
    this._dataDep.changed();                                                                                      // 95
    return;                                                                                                       // 96
  }                                                                                                               // 97
                                                                                                                  // 98
  this._dataDep.depend();                                                                                         // 99
  return typeof this._data === 'function' ? this._data() : this._data;                                            // 100
};                                                                                                                // 101
                                                                                                                  // 102
/**                                                                                                               // 103
 * Create the view if it hasn't been created yet.                                                                 // 104
 */                                                                                                               // 105
DynamicTemplate.prototype.create = function (options) {                                                           // 106
  var self = this;                                                                                                // 107
                                                                                                                  // 108
  if (this.isCreated) {                                                                                           // 109
    throw new Error("DynamicTemplate view is already created");                                                   // 110
  }                                                                                                               // 111
                                                                                                                  // 112
  this.isCreated = true;                                                                                          // 113
  this.isDestroyed = false;                                                                                       // 114
                                                                                                                  // 115
  var templateVar = Blaze.ReactiveVar(null);                                                                      // 116
                                                                                                                  // 117
  var view = Blaze.View('DynamicTemplate', function () {                                                          // 118
    var thisView = this;                                                                                          // 119
                                                                                                                  // 120
    // create the template dependency here because we need the entire                                             // 121
    // dynamic template to re-render if the template changes, including                                           // 122
    // the Blaze.With view.                                                                                       // 123
    var template = templateVar.get();                                                                             // 124
                                                                                                                  // 125
    return Blaze.With(function () {                                                                               // 126
      // NOTE: This will rerun anytime the data function invalidates this                                         // 127
      // computation OR if created from an inclusion helper (see note below) any                                  // 128
      // time any of the argument functions invlidate the computation. For                                        // 129
      // example, when the template changes this function will rerun also. But                                    // 130
      // it's probably generally ok. The more serious use case is to not                                          // 131
      // re-render the entire template every time the data context changes.                                       // 132
      var result = self.data();                                                                                   // 133
                                                                                                                  // 134
      if (typeof result !== 'undefined')                                                                          // 135
        // looks like data was set directly on this dynamic template                                              // 136
        return result;                                                                                            // 137
      else                                                                                                        // 138
        // return the first parent data context that is not inclusion arguments                                   // 139
        return DynamicTemplate.getParentDataContext(thisView);                                                    // 140
    }, function () {                                                                                              // 141
      // NOTE: When DynamicTemplate is used from a template inclusion helper                                      // 142
      // like this {{> DynamicTemplate template=getTemplate data=getData}} the                                    // 143
      // function below will rerun any time the getData function invalidates the                                  // 144
      // argument data computation.                                                                               // 145
      var tmpl = null;                                                                                            // 146
                                                                                                                  // 147
      // is it a template name like "MyTemplate"?                                                                 // 148
      if (typeof template === 'string') {                                                                         // 149
        tmpl = Template[template];                                                                                // 150
                                                                                                                  // 151
        if (!tmpl)                                                                                                // 152
          // as a fallback double check the user didn't actually define                                           // 153
          // a camelCase version of the template.                                                                 // 154
          tmpl = Template[camelCase(template)];                                                                   // 155
                                                                                                                  // 156
        if (!tmpl)                                                                                                // 157
          throw new Error("Couldn't find a template named " + JSON.stringify(template) + " or " + JSON.stringify(camelCase(template))+ ". Are you sure you defined it?");
      } else if (typeOf(template) === '[object Object]') {                                                        // 159
        // or maybe a view already?                                                                               // 160
        tmpl = template;                                                                                          // 161
      } else if (typeof self._content !== 'undefined') {                                                          // 162
        // or maybe its block content like                                                                        // 163
        // {{#DynamicTemplate}}                                                                                   // 164
        //  Some block                                                                                            // 165
        // {{/DynamicTemplate}}                                                                                   // 166
        tmpl = self._content;                                                                                     // 167
      }                                                                                                           // 168
                                                                                                                  // 169
      return tmpl;                                                                                                // 170
    });                                                                                                           // 171
  });                                                                                                             // 172
                                                                                                                  // 173
  view.onViewCreated(function () {                                                                                // 174
    this.autorun(function () {                                                                                    // 175
      templateVar.set(self.template());                                                                           // 176
    });                                                                                                           // 177
  });                                                                                                             // 178
                                                                                                                  // 179
  // wire up the view lifecycle callbacks                                                                         // 180
  _.each(['onViewCreated', 'onViewReady', '_onViewRendered', 'onViewDestroyed'], function (hook) {                // 181
    view[hook](function () {                                                                                      // 182
      // "this" is the view instance                                                                              // 183
      self._runHooks(hook, this);                                                                                 // 184
    });                                                                                                           // 185
  });                                                                                                             // 186
                                                                                                                  // 187
  view._onViewRendered(function () {                                                                              // 188
    // avoid inserting the view twice by accident.                                                                // 189
    self.isInserted = true;                                                                                       // 190
  });                                                                                                             // 191
                                                                                                                  // 192
  this.view = view;                                                                                               // 193
  view.__dynamicTemplate__ = this;                                                                                // 194
  view.name = this.name;                                                                                          // 195
  return view;                                                                                                    // 196
};                                                                                                                // 197
                                                                                                                  // 198
/**                                                                                                               // 199
 * Destroy the dynamic template, also destroying the view if it exists.                                           // 200
 */                                                                                                               // 201
DynamicTemplate.prototype.destroy = function () {                                                                 // 202
  if (this.isCreated) {                                                                                           // 203
    Blaze.remove(this.view);                                                                                      // 204
    this.view = null;                                                                                             // 205
    this.isDestroyed = true;                                                                                      // 206
    this.isCreated = false;                                                                                       // 207
  }                                                                                                               // 208
};                                                                                                                // 209
                                                                                                                  // 210
/**                                                                                                               // 211
 * View lifecycle hooks.                                                                                          // 212
 */                                                                                                               // 213
_.each(['onViewCreated', 'onViewReady', '_onViewRendered', 'onViewDestroyed'], function (hook) {                  // 214
  DynamicTemplate.prototype[hook] = function (cb) {                                                               // 215
    var hooks = this._hooks[hook] = this._hooks[hook] || [];                                                      // 216
    hooks.push(cb);                                                                                               // 217
    return this;                                                                                                  // 218
  };                                                                                                              // 219
});                                                                                                               // 220
                                                                                                                  // 221
DynamicTemplate.prototype._runHooks = function (name, view) {                                                     // 222
  var hooks = this._hooks[name] || [];                                                                            // 223
  var hook;                                                                                                       // 224
                                                                                                                  // 225
  for (var i = 0; i < hooks.length; i++) {                                                                        // 226
    hook = hooks[i];                                                                                              // 227
    // keep the "thisArg" pointing to the view, but make the first parameter to                                   // 228
    // the callback teh dynamic template instance.                                                                // 229
    hook.call(view, this);                                                                                        // 230
  }                                                                                                               // 231
};                                                                                                                // 232
                                                                                                                  // 233
/**                                                                                                               // 234
 * Insert the Layout view into the dom.                                                                           // 235
 */                                                                                                               // 236
DynamicTemplate.prototype.insert = function (options) {                                                           // 237
  options = options || {};                                                                                        // 238
                                                                                                                  // 239
  if (this.isInserted)                                                                                            // 240
    return;                                                                                                       // 241
  this.isInserted = true;                                                                                         // 242
                                                                                                                  // 243
  var el = options.el || document.body;                                                                           // 244
  var $el = $(el);                                                                                                // 245
                                                                                                                  // 246
  if ($el.length === 0)                                                                                           // 247
    throw new Error("No element to insert layout into. Is your element defined? Try a Meteor.startup callback."); // 248
                                                                                                                  // 249
  if (!this.view)                                                                                                 // 250
    this.create(options);                                                                                         // 251
                                                                                                                  // 252
  Blaze.render(this.view, $el[0], options.nextNode, options.parentView);                                          // 253
                                                                                                                  // 254
  return this;                                                                                                    // 255
};                                                                                                                // 256
                                                                                                                  // 257
/**                                                                                                               // 258
 * Reactively return the value of the current controller.                                                         // 259
 */                                                                                                               // 260
DynamicTemplate.prototype.getController = function () {                                                           // 261
  return this._controller.get();                                                                                  // 262
};                                                                                                                // 263
                                                                                                                  // 264
/**                                                                                                               // 265
 * Set the reactive value of the controller.                                                                      // 266
 */                                                                                                               // 267
DynamicTemplate.prototype.setController = function (controller) {                                                 // 268
  var didHaveController = !!this._hasController;                                                                  // 269
  this._hasController = (typeof controller !== 'undefined');                                                      // 270
                                                                                                                  // 271
  if (didHaveController !== this._hasController)                                                                  // 272
    this._hasControllerDep.changed();                                                                             // 273
                                                                                                                  // 274
  return this._controller.set(controller);                                                                        // 275
};                                                                                                                // 276
                                                                                                                  // 277
/**                                                                                                               // 278
 * Reactively returns true if the template has a controller and false otherwise.                                  // 279
 */                                                                                                               // 280
DynamicTemplate.prototype.hasController = function () {                                                           // 281
  this._hasControllerDep.depend();                                                                                // 282
  return this._hasController;                                                                                     // 283
};                                                                                                                // 284
                                                                                                                  // 285
/*****************************************************************************/                                   // 286
/* DynamicTemplate Static Methods */                                                                              // 287
/*****************************************************************************/                                   // 288
                                                                                                                  // 289
/**                                                                                                               // 290
 * Get the first parent data context that are not inclusion arguments                                             // 291
 * (see above function). Note: This function can create reactive dependencies.                                    // 292
 */                                                                                                               // 293
DynamicTemplate.getParentDataContext = function (view) {                                                          // 294
  // start off with the parent.                                                                                   // 295
  view = view.parentView;                                                                                         // 296
                                                                                                                  // 297
  while (view) {                                                                                                  // 298
    if (view.name === 'with' && !view.__isTemplateWith)                                                           // 299
      return view.dataVar.get();                                                                                  // 300
    else                                                                                                          // 301
      view = view.parentView;                                                                                     // 302
  }                                                                                                               // 303
                                                                                                                  // 304
  return null;                                                                                                    // 305
};                                                                                                                // 306
                                                                                                                  // 307
                                                                                                                  // 308
/**                                                                                                               // 309
 * Get inclusion arguments, if any, from a view.                                                                  // 310
 *                                                                                                                // 311
 * Uses the __isTemplateWith property set when a parent view is used                                              // 312
 * specificially for a data context with inclusion args.                                                          // 313
 *                                                                                                                // 314
 * Inclusion arguments are arguments provided in a template like this:                                            // 315
 * {{> yield "inclusionArg"}}                                                                                     // 316
 * or                                                                                                             // 317
 * {{> yield region="inclusionArgValue"}}                                                                         // 318
 */                                                                                                               // 319
DynamicTemplate.getInclusionArguments = function (view) {                                                         // 320
  var parent = view && view.parentView;                                                                           // 321
                                                                                                                  // 322
  if (!parent)                                                                                                    // 323
    return null;                                                                                                  // 324
                                                                                                                  // 325
  if (parent.__isTemplateWith)                                                                                    // 326
    return parent.dataVar.get();                                                                                  // 327
                                                                                                                  // 328
  return null;                                                                                                    // 329
};                                                                                                                // 330
                                                                                                                  // 331
/**                                                                                                               // 332
 * Given a view, return a function that can be used to access argument values at                                  // 333
 * the time the view was rendered. There are two key benefits:                                                    // 334
 *                                                                                                                // 335
 * 1. Save the argument data at the time of rendering. When you use lookup(...)                                   // 336
 *    it starts from the current data context which can change.                                                   // 337
 * 2. Defer creating a dependency on inclusion arguments until later.                                             // 338
 *                                                                                                                // 339
 * Example:                                                                                                       // 340
 *                                                                                                                // 341
 *   {{> MyTemplate template="MyTemplate"                                                                         // 342
 *   var args = DynamicTemplate.args(view);                                                                       // 343
 *   var tmplValue = args('template');                                                                            // 344
 *     => "MyTemplate"                                                                                            // 345
 */                                                                                                               // 346
DynamicTemplate.args = function (view) {                                                                          // 347
  return function (key) {                                                                                         // 348
    var data = DynamicTemplate.getInclusionArguments(view);                                                       // 349
                                                                                                                  // 350
    if (data) {                                                                                                   // 351
      if (key)                                                                                                    // 352
        return data[key];                                                                                         // 353
      else                                                                                                        // 354
        return data;                                                                                              // 355
    }                                                                                                             // 356
                                                                                                                  // 357
    return null;                                                                                                  // 358
  };                                                                                                              // 359
};                                                                                                                // 360
                                                                                                                  // 361
/**                                                                                                               // 362
 * Inherit from DynamicTemplate.                                                                                  // 363
 */                                                                                                               // 364
DynamicTemplate.extend = function (props) {                                                                       // 365
  return Iron.utils.extend(this, props);                                                                          // 366
};                                                                                                                // 367
                                                                                                                  // 368
/*****************************************************************************/                                   // 369
/* UI Helpers */                                                                                                  // 370
/*****************************************************************************/                                   // 371
                                                                                                                  // 372
if (typeof Template !== 'undefined') {                                                                            // 373
  UI.registerHelper('DynamicTemplate', new Template('DynamicTemplateHelper', function () {                        // 374
    var args = DynamicTemplate.args(this);                                                                        // 375
                                                                                                                  // 376
    return new DynamicTemplate({                                                                                  // 377
      data: function () { return args('data'); },                                                                 // 378
      template: function () { return args('template'); },                                                         // 379
      content: this.templateContentBlock                                                                          // 380
    }).create();                                                                                                  // 381
  }));                                                                                                            // 382
}                                                                                                                 // 383
                                                                                                                  // 384
/*****************************************************************************/                                   // 385
/* Namespacing */                                                                                                 // 386
/*****************************************************************************/                                   // 387
Iron.DynamicTemplate = DynamicTemplate;                                                                           // 388
                                                                                                                  // 389
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['iron:dynamic-template'] = {};

})();

//# sourceMappingURL=iron_dynamic-template.js.map
