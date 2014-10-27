(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var Tracker = Package.tracker.Tracker;
var Deps = Package.tracker.Deps;

/* Package-scope variables */
var HTML, IDENTITY, SLICE;

(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                             //
// packages/htmljs/preamble.js                                                                 //
//                                                                                             //
/////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                               //
HTML = {};                                                                                     // 1
                                                                                               // 2
IDENTITY = function (x) { return x; };                                                         // 3
SLICE = Array.prototype.slice;                                                                 // 4
                                                                                               // 5
/////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                             //
// packages/htmljs/visitors.js                                                                 //
//                                                                                             //
/////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                               //
////////////////////////////// VISITORS                                                        // 1
                                                                                               // 2
// _assign is like _.extend or the upcoming Object.assign.                                     // 3
// Copy src's own, enumerable properties onto tgt and return                                   // 4
// tgt.                                                                                        // 5
var _hasOwnProperty = Object.prototype.hasOwnProperty;                                         // 6
var _assign = function (tgt, src) {                                                            // 7
  for (var k in src) {                                                                         // 8
    if (_hasOwnProperty.call(src, k))                                                          // 9
      tgt[k] = src[k];                                                                         // 10
  }                                                                                            // 11
  return tgt;                                                                                  // 12
};                                                                                             // 13
                                                                                               // 14
HTML.Visitor = function (props) {                                                              // 15
  _assign(this, props);                                                                        // 16
};                                                                                             // 17
                                                                                               // 18
HTML.Visitor.def = function (options) {                                                        // 19
  _assign(this.prototype, options);                                                            // 20
};                                                                                             // 21
                                                                                               // 22
HTML.Visitor.extend = function (options) {                                                     // 23
  var curType = this;                                                                          // 24
  var subType = function HTMLVisitorSubtype(/*arguments*/) {                                   // 25
    HTML.Visitor.apply(this, arguments);                                                       // 26
  };                                                                                           // 27
  subType.prototype = new curType;                                                             // 28
  subType.extend = curType.extend;                                                             // 29
  subType.def = curType.def;                                                                   // 30
  if (options)                                                                                 // 31
    _assign(subType.prototype, options);                                                       // 32
  return subType;                                                                              // 33
};                                                                                             // 34
                                                                                               // 35
HTML.Visitor.def({                                                                             // 36
  visit: function (content/*, ...*/) {                                                         // 37
    if (content == null)                                                                       // 38
      // null or undefined.                                                                    // 39
      return this.visitNull.apply(this, arguments);                                            // 40
                                                                                               // 41
    if (typeof content === 'object') {                                                         // 42
      if (content.htmljsType) {                                                                // 43
        switch (content.htmljsType) {                                                          // 44
        case HTML.Tag.htmljsType:                                                              // 45
          return this.visitTag.apply(this, arguments);                                         // 46
        case HTML.CharRef.htmljsType:                                                          // 47
          return this.visitCharRef.apply(this, arguments);                                     // 48
        case HTML.Comment.htmljsType:                                                          // 49
          return this.visitComment.apply(this, arguments);                                     // 50
        case HTML.Raw.htmljsType:                                                              // 51
          return this.visitRaw.apply(this, arguments);                                         // 52
        default:                                                                               // 53
          throw new Error("Unknown htmljs type: " + content.htmljsType);                       // 54
        }                                                                                      // 55
      }                                                                                        // 56
                                                                                               // 57
      if (HTML.isArray(content))                                                               // 58
        return this.visitArray.apply(this, arguments);                                         // 59
                                                                                               // 60
      return this.visitObject.apply(this, arguments);                                          // 61
                                                                                               // 62
    } else if ((typeof content === 'string') ||                                                // 63
               (typeof content === 'boolean') ||                                               // 64
               (typeof content === 'number')) {                                                // 65
      return this.visitPrimitive.apply(this, arguments);                                       // 66
                                                                                               // 67
    } else if (typeof content === 'function') {                                                // 68
      return this.visitFunction.apply(this, arguments);                                        // 69
    }                                                                                          // 70
                                                                                               // 71
    throw new Error("Unexpected object in htmljs: " + content);                                // 72
                                                                                               // 73
  },                                                                                           // 74
  visitNull: function (nullOrUndefined/*, ...*/) {},                                           // 75
  visitPrimitive: function (stringBooleanOrNumber/*, ...*/) {},                                // 76
  visitArray: function (array/*, ...*/) {},                                                    // 77
  visitComment: function (comment/*, ...*/) {},                                                // 78
  visitCharRef: function (charRef/*, ...*/) {},                                                // 79
  visitRaw: function (raw/*, ...*/) {},                                                        // 80
  visitTag: function (tag/*, ...*/) {},                                                        // 81
  visitObject: function (obj/*, ...*/) {                                                       // 82
    throw new Error("Unexpected object in htmljs: " + obj);                                    // 83
  },                                                                                           // 84
  visitFunction: function (obj/*, ...*/) {                                                     // 85
    throw new Error("Unexpected function in htmljs: " + obj);                                  // 86
  }                                                                                            // 87
});                                                                                            // 88
                                                                                               // 89
HTML.TransformingVisitor = HTML.Visitor.extend();                                              // 90
HTML.TransformingVisitor.def({                                                                 // 91
  visitNull: IDENTITY,                                                                         // 92
  visitPrimitive: IDENTITY,                                                                    // 93
  visitArray: function (array/*, ...*/) {                                                      // 94
    var argsCopy = SLICE.call(arguments);                                                      // 95
    var result = array;                                                                        // 96
    for (var i = 0; i < array.length; i++) {                                                   // 97
      var oldItem = array[i];                                                                  // 98
      argsCopy[0] = oldItem;                                                                   // 99
      var newItem = this.visit.apply(this, argsCopy);                                          // 100
      if (newItem !== oldItem) {                                                               // 101
        // copy `array` on write                                                               // 102
        if (result === array)                                                                  // 103
          result = array.slice();                                                              // 104
        result[i] = newItem;                                                                   // 105
      }                                                                                        // 106
    }                                                                                          // 107
    return result;                                                                             // 108
  },                                                                                           // 109
  visitComment: IDENTITY,                                                                      // 110
  visitCharRef: IDENTITY,                                                                      // 111
  visitRaw: IDENTITY,                                                                          // 112
  visitObject: IDENTITY,                                                                       // 113
  visitFunction: IDENTITY,                                                                     // 114
  visitTag: function (tag/*, ...*/) {                                                          // 115
    var oldChildren = tag.children;                                                            // 116
    var argsCopy = SLICE.call(arguments);                                                      // 117
    argsCopy[0] = oldChildren;                                                                 // 118
    var newChildren = this.visitChildren.apply(this, argsCopy);                                // 119
                                                                                               // 120
    var oldAttrs = tag.attrs;                                                                  // 121
    argsCopy[0] = oldAttrs;                                                                    // 122
    var newAttrs = this.visitAttributes.apply(this, argsCopy);                                 // 123
                                                                                               // 124
    if (newAttrs === oldAttrs && newChildren === oldChildren)                                  // 125
      return tag;                                                                              // 126
                                                                                               // 127
    var newTag = HTML.getTag(tag.tagName).apply(null, newChildren);                            // 128
    newTag.attrs = newAttrs;                                                                   // 129
    return newTag;                                                                             // 130
  },                                                                                           // 131
  visitChildren: function (children/*, ...*/) {                                                // 132
    return this.visitArray.apply(this, arguments);                                             // 133
  },                                                                                           // 134
  // Transform the `.attrs` property of a tag, which may be a dictionary,                      // 135
  // an array, or in some uses, a foreign object (such as                                      // 136
  // a template tag).                                                                          // 137
  visitAttributes: function (attrs/*, ...*/) {                                                 // 138
    if (HTML.isArray(attrs)) {                                                                 // 139
      var argsCopy = SLICE.call(arguments);                                                    // 140
      var result = attrs;                                                                      // 141
      for (var i = 0; i < attrs.length; i++) {                                                 // 142
        var oldItem = attrs[i];                                                                // 143
        argsCopy[0] = oldItem;                                                                 // 144
        var newItem = this.visitAttributes.apply(this, argsCopy);                              // 145
        if (newItem !== oldItem) {                                                             // 146
          // copy on write                                                                     // 147
          if (result === attrs)                                                                // 148
            result = attrs.slice();                                                            // 149
          result[i] = newItem;                                                                 // 150
        }                                                                                      // 151
      }                                                                                        // 152
      return result;                                                                           // 153
    }                                                                                          // 154
                                                                                               // 155
    if (attrs && HTML.isConstructedObject(attrs)) {                                            // 156
      throw new Error("The basic HTML.TransformingVisitor does not support " +                 // 157
                      "foreign objects in attributes.  Define a custom " +                     // 158
                      "visitAttributes for this case.");                                       // 159
    }                                                                                          // 160
                                                                                               // 161
    var oldAttrs = attrs;                                                                      // 162
    var newAttrs = oldAttrs;                                                                   // 163
    if (oldAttrs) {                                                                            // 164
      var attrArgs = [null, null];                                                             // 165
      attrArgs.push.apply(attrArgs, arguments);                                                // 166
      for (var k in oldAttrs) {                                                                // 167
        var oldValue = oldAttrs[k];                                                            // 168
        attrArgs[0] = k;                                                                       // 169
        attrArgs[1] = oldValue;                                                                // 170
        var newValue = this.visitAttribute.apply(this, attrArgs);                              // 171
        if (newValue !== oldValue) {                                                           // 172
          // copy on write                                                                     // 173
          if (newAttrs === oldAttrs)                                                           // 174
            newAttrs = _assign({}, oldAttrs);                                                  // 175
          newAttrs[k] = newValue;                                                              // 176
        }                                                                                      // 177
      }                                                                                        // 178
    }                                                                                          // 179
                                                                                               // 180
    return newAttrs;                                                                           // 181
  },                                                                                           // 182
  // Transform the value of one attribute name/value in an                                     // 183
  // attributes dictionary.                                                                    // 184
  visitAttribute: function (name, value, tag/*, ...*/) {                                       // 185
    var args = SLICE.call(arguments, 2);                                                       // 186
    args[0] = value;                                                                           // 187
    return this.visit.apply(this, args);                                                       // 188
  }                                                                                            // 189
});                                                                                            // 190
                                                                                               // 191
                                                                                               // 192
HTML.ToTextVisitor = HTML.Visitor.extend();                                                    // 193
HTML.ToTextVisitor.def({                                                                       // 194
  visitNull: function (nullOrUndefined) {                                                      // 195
    return '';                                                                                 // 196
  },                                                                                           // 197
  visitPrimitive: function (stringBooleanOrNumber) {                                           // 198
    var str = String(stringBooleanOrNumber);                                                   // 199
    if (this.textMode === HTML.TEXTMODE.RCDATA) {                                              // 200
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;');                                 // 201
    } else if (this.textMode === HTML.TEXTMODE.ATTRIBUTE) {                                    // 202
      // escape `&` and `"` this time, not `&` and `<`                                         // 203
      return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;');                               // 204
    } else {                                                                                   // 205
      return str;                                                                              // 206
    }                                                                                          // 207
  },                                                                                           // 208
  visitArray: function (array) {                                                               // 209
    var parts = [];                                                                            // 210
    for (var i = 0; i < array.length; i++)                                                     // 211
      parts.push(this.visit(array[i]));                                                        // 212
    return parts.join('');                                                                     // 213
  },                                                                                           // 214
  visitComment: function (comment) {                                                           // 215
    throw new Error("Can't have a comment here");                                              // 216
  },                                                                                           // 217
  visitCharRef: function (charRef) {                                                           // 218
    if (this.textMode === HTML.TEXTMODE.RCDATA ||                                              // 219
        this.textMode === HTML.TEXTMODE.ATTRIBUTE) {                                           // 220
      return charRef.html;                                                                     // 221
    } else {                                                                                   // 222
      return charRef.str;                                                                      // 223
    }                                                                                          // 224
  },                                                                                           // 225
  visitRaw: function (raw) {                                                                   // 226
    return raw.value;                                                                          // 227
  },                                                                                           // 228
  visitTag: function (tag) {                                                                   // 229
    // Really we should just disallow Tags here.  However, at the                              // 230
    // moment it's useful to stringify any HTML we find.  In                                   // 231
    // particular, when you include a template within `{{#markdown}}`,                         // 232
    // we render the template as text, and since there's currently                             // 233
    // no way to make the template be *parsed* as text (e.g. `<template                        // 234
    // type="text">`), we hackishly support HTML tags in markdown                              // 235
    // in templates by parsing them and stringifying them.                                     // 236
    return this.visit(this.toHTML(tag));                                                       // 237
  },                                                                                           // 238
  visitObject: function (x) {                                                                  // 239
    throw new Error("Unexpected object in htmljs in toText: " + x);                            // 240
  },                                                                                           // 241
  toHTML: function (node) {                                                                    // 242
    return HTML.toHTML(node);                                                                  // 243
  }                                                                                            // 244
});                                                                                            // 245
                                                                                               // 246
                                                                                               // 247
                                                                                               // 248
HTML.ToHTMLVisitor = HTML.Visitor.extend();                                                    // 249
HTML.ToHTMLVisitor.def({                                                                       // 250
  visitNull: function (nullOrUndefined) {                                                      // 251
    return '';                                                                                 // 252
  },                                                                                           // 253
  visitPrimitive: function (stringBooleanOrNumber) {                                           // 254
    var str = String(stringBooleanOrNumber);                                                   // 255
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;');                                   // 256
  },                                                                                           // 257
  visitArray: function (array) {                                                               // 258
    var parts = [];                                                                            // 259
    for (var i = 0; i < array.length; i++)                                                     // 260
      parts.push(this.visit(array[i]));                                                        // 261
    return parts.join('');                                                                     // 262
  },                                                                                           // 263
  visitComment: function (comment) {                                                           // 264
    return '<!--' + comment.sanitizedValue + '-->';                                            // 265
  },                                                                                           // 266
  visitCharRef: function (charRef) {                                                           // 267
    return charRef.html;                                                                       // 268
  },                                                                                           // 269
  visitRaw: function (raw) {                                                                   // 270
    return raw.value;                                                                          // 271
  },                                                                                           // 272
  visitTag: function (tag) {                                                                   // 273
    var attrStrs = [];                                                                         // 274
                                                                                               // 275
    var tagName = tag.tagName;                                                                 // 276
    var children = tag.children;                                                               // 277
                                                                                               // 278
    var attrs = tag.attrs;                                                                     // 279
    if (attrs) {                                                                               // 280
      attrs = HTML.flattenAttributes(attrs);                                                   // 281
      for (var k in attrs) {                                                                   // 282
        if (k === 'value' && tagName === 'textarea') {                                         // 283
          children = [attrs[k], children];                                                     // 284
        } else {                                                                               // 285
          var v = this.toText(attrs[k], HTML.TEXTMODE.ATTRIBUTE);                              // 286
          attrStrs.push(' ' + k + '="' + v + '"');                                             // 287
        }                                                                                      // 288
      }                                                                                        // 289
    }                                                                                          // 290
                                                                                               // 291
    var startTag = '<' + tagName + attrStrs.join('') + '>';                                    // 292
                                                                                               // 293
    var childStrs = [];                                                                        // 294
    var content;                                                                               // 295
    if (tagName === 'textarea') {                                                              // 296
                                                                                               // 297
      for (var i = 0; i < children.length; i++)                                                // 298
        childStrs.push(this.toText(children[i], HTML.TEXTMODE.RCDATA));                        // 299
                                                                                               // 300
      content = childStrs.join('');                                                            // 301
      if (content.slice(0, 1) === '\n')                                                        // 302
        // TEXTAREA will absorb a newline, so if we see one, add                               // 303
        // another one.                                                                        // 304
        content = '\n' + content;                                                              // 305
                                                                                               // 306
    } else {                                                                                   // 307
      for (var i = 0; i < children.length; i++)                                                // 308
        childStrs.push(this.visit(children[i]));                                               // 309
                                                                                               // 310
      content = childStrs.join('');                                                            // 311
    }                                                                                          // 312
                                                                                               // 313
    var result = startTag + content;                                                           // 314
                                                                                               // 315
    if (children.length || ! HTML.isVoidElement(tagName)) {                                    // 316
      // "Void" elements like BR are the only ones that don't get a close                      // 317
      // tag in HTML5.  They shouldn't have contents, either, so we could                      // 318
      // throw an error upon seeing contents here.                                             // 319
      result += '</' + tagName + '>';                                                          // 320
    }                                                                                          // 321
                                                                                               // 322
    return result;                                                                             // 323
  },                                                                                           // 324
  visitObject: function (x) {                                                                  // 325
    throw new Error("Unexpected object in htmljs in toHTML: " + x);                            // 326
  },                                                                                           // 327
  toText: function (node, textMode) {                                                          // 328
    return HTML.toText(node, textMode);                                                        // 329
  }                                                                                            // 330
});                                                                                            // 331
                                                                                               // 332
/////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                             //
// packages/htmljs/html.js                                                                     //
//                                                                                             //
/////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                               //
///!README                                                                                     // 1
                                                                                               // 2
/**                                                                                            // 3
 * # HTMLjs                                                                                    // 4
 *                                                                                             // 5
 * HTMLjs is a small library for expressing HTML trees with a concise                          // 6
 * syntax.  It is used to render content in Blaze and to represent                             // 7
 * templates during compilation.                                                               // 8
 *                                                                                             // 9
```                                                                                            // 10
var UL = HTML.UL, LI = HTML.LI, B = HTML.B;                                                    // 11
                                                                                               // 12
HTML.toHTML(                                                                                   // 13
  UL({id: 'mylist'},                                                                           // 14
     LI({'class': 'item'}, "Hello ", B("world"), "!"),                                         // 15
     LI({'class': 'item'}, "Goodbye, world")))                                                 // 16
```                                                                                            // 17
                                                                                               // 18
```                                                                                            // 19
<ul id="mylist">                                                                               // 20
  <li class="item">Hello <b>world</b>!</li>                                                    // 21
  <li class="item">Goodbye, world</li>                                                         // 22
</ul>                                                                                          // 23
```                                                                                            // 24
 *                                                                                             // 25
 * The functions `UL`, `LI`, and `B` are constructors which                                    // 26
 * return instances of `HTML.Tag`.  These tag objects can                                      // 27
 * then be converted to an HTML string or directly into DOM nodes.                             // 28
 *                                                                                             // 29
 * The flexible structure of HTMLjs allows different kinds of Blaze                            // 30
 * directives to be embedded in the tree.  HTMLjs does not know about                          // 31
 * these directives, which are considered "foreign objects."                                   // 32
 *                                                                                             // 33
 * # Built-in Types                                                                            // 34
 *                                                                                             // 35
 * The following types are built into HTMLjs.  Built-in methods like                           // 36
 * `HTML.toHTML` require a tree consisting only of these types.                                // 37
 *                                                                                             // 38
 * * __`null`, `undefined`__ - Render to nothing.                                              // 39
 *                                                                                             // 40
 * * __boolean, number__ - Render to the string form of the boolean or number.                 // 41
 *                                                                                             // 42
 * * __string__ - Renders to a text node (or part of an attribute value).  All characters are safe, and no HTML injection is possible.  The string `"<a>"` renders `&lt;a>` in HTML, and `document.createTextNode("<a>")` in DOM.
 *                                                                                             // 44
 * * __Array__ - Renders to its elements in order.  An array may be empty.  Arrays are detected using `HTML.isArray(...)`.
 *                                                                                             // 46
 * * __`HTML.Tag`__ - Renders to an HTML element (including start tag, contents, and end tag). // 47
 *                                                                                             // 48
 * * __`HTML.CharRef({html: ..., str: ...})`__ - Renders to a character reference (such as `&nbsp`) when generating HTML.
 *                                                                                             // 50
 * * __`HTML.Comment(text)`__ - Renders to an HTML comment.                                    // 51
 *                                                                                             // 52
 * * __`HTML.Raw(html)`__ - Renders to a string of HTML to include verbatim.                   // 53
 *                                                                                             // 54
 * The `new` keyword is not required before constructors of HTML object types.                 // 55
 *                                                                                             // 56
 * All objects and arrays should be considered immutable.  Instance properties                 // 57
 * are public, but they should only be read, not written.  Arrays should not                   // 58
 * be spliced in place.  This convention allows for clean patterns of                          // 59
 * processing and transforming HTMLjs trees.                                                   // 60
 */                                                                                            // 61
                                                                                               // 62
/**                                                                                            // 63
 * ## HTML.Tag                                                                                 // 64
 *                                                                                             // 65
 * An `HTML.Tag` is created using a tag-specific constructor, like                             // 66
 * `HTML.P` for a `<p>` tag or `HTML.INPUT` for an `<input>` tag.  The                         // 67
 * resulting object is `instanceof HTML.Tag`.  (The `HTML.Tag`                                 // 68
 * constructor should not be called directly.)                                                 // 69
 *                                                                                             // 70
 * Tag constructors take an optional attributes dictionary followed                            // 71
 * by zero or more children:                                                                   // 72
 *                                                                                             // 73
 * ```                                                                                         // 74
 * HTML.HR()                                                                                   // 75
 *                                                                                             // 76
 * HTML.DIV(HTML.P("First paragraph"),                                                         // 77
 *          HTML.P("Second paragraph"))                                                        // 78
 *                                                                                             // 79
 * HTML.INPUT({type: "text"})                                                                  // 80
 *                                                                                             // 81
 * HTML.SPAN({'class': "foo"}, "Some text")                                                    // 82
 * ```                                                                                         // 83
 *                                                                                             // 84
 * ### Instance properties                                                                     // 85
 *                                                                                             // 86
 * Tags have the following properties:                                                         // 87
 *                                                                                             // 88
 * * `tagName` - The tag name in lowercase (or camelCase)                                      // 89
 * * `children` - An array of children (always present)                                        // 90
 * * `attrs` - An attributes dictionary, `null`, or an array (see below)                       // 91
 */                                                                                            // 92
                                                                                               // 93
                                                                                               // 94
HTML.Tag = function () {};                                                                     // 95
HTML.Tag.prototype.tagName = ''; // this will be set per Tag subclass                          // 96
HTML.Tag.prototype.attrs = null;                                                               // 97
HTML.Tag.prototype.children = Object.freeze ? Object.freeze([]) : [];                          // 98
HTML.Tag.prototype.htmljsType = HTML.Tag.htmljsType = ['Tag'];                                 // 99
                                                                                               // 100
// Given "p" create the function `HTML.P`.                                                     // 101
var makeTagConstructor = function (tagName) {                                                  // 102
  // HTMLTag is the per-tagName constructor of a HTML.Tag subclass                             // 103
  var HTMLTag = function (/*arguments*/) {                                                     // 104
    // Work with or without `new`.  If not called with `new`,                                  // 105
    // perform instantiation by recursively calling this constructor.                          // 106
    // We can't pass varargs, so pass no args.                                                 // 107
    var instance = (this instanceof HTML.Tag) ? this : new HTMLTag;                            // 108
                                                                                               // 109
    var i = 0;                                                                                 // 110
    var attrs = arguments.length && arguments[0];                                              // 111
    if (attrs && (typeof attrs === 'object')) {                                                // 112
      // Treat vanilla JS object as an attributes dictionary.                                  // 113
      if (! HTML.isConstructedObject(attrs)) {                                                 // 114
        instance.attrs = attrs;                                                                // 115
        i++;                                                                                   // 116
      } else if (attrs instanceof HTML.Attrs) {                                                // 117
        var array = attrs.value;                                                               // 118
        if (array.length === 1) {                                                              // 119
          instance.attrs = array[0];                                                           // 120
        } else if (array.length > 1) {                                                         // 121
          instance.attrs = array;                                                              // 122
        }                                                                                      // 123
        i++;                                                                                   // 124
      }                                                                                        // 125
    }                                                                                          // 126
                                                                                               // 127
                                                                                               // 128
    // If no children, don't create an array at all, use the prototype's                       // 129
    // (frozen, empty) array.  This way we don't create an empty array                         // 130
    // every time someone creates a tag without `new` and this constructor                     // 131
    // calls itself with no arguments (above).                                                 // 132
    if (i < arguments.length)                                                                  // 133
      instance.children = SLICE.call(arguments, i);                                            // 134
                                                                                               // 135
    return instance;                                                                           // 136
  };                                                                                           // 137
  HTMLTag.prototype = new HTML.Tag;                                                            // 138
  HTMLTag.prototype.constructor = HTMLTag;                                                     // 139
  HTMLTag.prototype.tagName = tagName;                                                         // 140
                                                                                               // 141
  return HTMLTag;                                                                              // 142
};                                                                                             // 143
                                                                                               // 144
/**                                                                                            // 145
 * ### Special forms of attributes                                                             // 146
 *                                                                                             // 147
 * The attributes of a Tag may be an array of dictionaries.  In order                          // 148
 * for a tag constructor to recognize an array as the attributes argument,                     // 149
 * it must be written as `HTML.Attrs(attrs1, attrs2, ...)`, as in this                         // 150
 * example:                                                                                    // 151
 *                                                                                             // 152
 * ```                                                                                         // 153
 * var extraAttrs = {'class': "container"};                                                    // 154
 *                                                                                             // 155
 * var div = HTML.DIV(HTML.Attrs({id: "main"}, extraAttrs),                                    // 156
 *                    "This is the content.");                                                 // 157
 *                                                                                             // 158
 * div.attrs // => [{id: "main"}, {'class': "container"}]                                      // 159
 * ```                                                                                         // 160
 *                                                                                             // 161
 * `HTML.Attrs` may also be used to pass a foreign object in place of                          // 162
 * an attributes dictionary of a tag.                                                          // 163
 *                                                                                             // 164
 */                                                                                            // 165
// Not an HTMLjs node, but a wrapper to pass multiple attrs dictionaries                       // 166
// to a tag (for the purpose of implementing dynamic attributes).                              // 167
var Attrs = HTML.Attrs = function (/*attrs dictionaries*/) {                                   // 168
  // Work with or without `new`.  If not called with `new`,                                    // 169
  // perform instantiation by recursively calling this constructor.                            // 170
  // We can't pass varargs, so pass no args.                                                   // 171
  var instance = (this instanceof Attrs) ? this : new Attrs;                                   // 172
                                                                                               // 173
  instance.value = SLICE.call(arguments);                                                      // 174
                                                                                               // 175
  return instance;                                                                             // 176
};                                                                                             // 177
                                                                                               // 178
/**                                                                                            // 179
 * ### Normalized Case for Tag Names                                                           // 180
 *                                                                                             // 181
 * The `tagName` field is always in "normalized case," which is the                            // 182
 * official case for that particular element name (usually lowercase).                         // 183
 * For example, `HTML.DIV().tagName` is `"div"`.  For some elements                            // 184
 * used in inline SVG graphics, the correct case is "camelCase."  For                          // 185
 * example, there is an element named `clipPath`.                                              // 186
 *                                                                                             // 187
 * Web browsers have a confusing policy about case.  They perform case                         // 188
 * normalization when parsing HTML, but not when creating SVG elements                         // 189
 * at runtime; the correct case is required.                                                   // 190
 *                                                                                             // 191
 * Therefore, in order to avoid ever having to normalize case at                               // 192
 * runtime, the policy of HTMLjs is to put the burden on the caller                            // 193
 * of functions like `HTML.ensureTag` -- for example, a template                               // 194
 * engine -- of supplying correct normalized case.                                             // 195
 *                                                                                             // 196
 * Briefly put, normlized case is usually lowercase, except for certain                        // 197
 * elements where it is camelCase.                                                             // 198
 */                                                                                            // 199
                                                                                               // 200
////////////////////////////// KNOWN ELEMENTS                                                  // 201
                                                                                               // 202
/**                                                                                            // 203
 * ### Known Elements                                                                          // 204
 *                                                                                             // 205
 * HTMLjs comes preloaded with constructors for all "known" HTML and                           // 206
 * SVG elements.  You can use `HTML.P`, `HTML.DIV`, and so on out of                           // 207
 * the box.  If you want to create a tag like `<foo>` for some reason,                         // 208
 * you have to tell HTMLjs to create the `HTML.FOO` constructor for you                        // 209
 * using `HTML.ensureTag` or `HTML.getTag`.                                                    // 210
 *                                                                                             // 211
 * HTMLjs's lists of known elements are public because they are useful to                      // 212
 * other packages that provide additional functions not found here, like                       // 213
 * functions for normalizing case.                                                             // 214
 *                                                                                             // 215
 */                                                                                            // 216
                                                                                               // 217
/**                                                                                            // 218
 * ## Foreign objects                                                                          // 219
 *                                                                                             // 220
 * Arbitrary objects are allowed in HTMLjs trees, which is useful for                          // 221
 * adapting HTMLjs to a wide variety of uses.  Such objects are called                         // 222
 * foreign objects.                                                                            // 223
 *                                                                                             // 224
 * The one restriction on foreign objects is that they must be                                 // 225
 * instances of a class -- so-called "constructed objects" (see                                // 226
 * `HTML.isConstructedObject`) -- so that they can be distinguished                            // 227
 * from the vanilla JS objects that represent attributes dictionaries                          // 228
 * when constructing Tags.                                                                     // 229
 *                                                                                             // 230
 * Functions are also considered foreign objects.                                              // 231
 */                                                                                            // 232
                                                                                               // 233
/**                                                                                            // 234
 * ## HTML.getTag(tagName)                                                                     // 235
 *                                                                                             // 236
 * * `tagName` - A string in normalized case                                                   // 237
 *                                                                                             // 238
 * Creates a tag constructor for `tagName`, assigns it to the `HTML`                           // 239
 * namespace object, and returns it.                                                           // 240
 *                                                                                             // 241
 * For example, `HTML.getTag("p")` returns `HTML.P`.  `HTML.getTag("foo")`                     // 242
 * will create and return `HTML.FOO`.                                                          // 243
 *                                                                                             // 244
 * It's very important that `tagName` be in normalized case, or else                           // 245
 * an incorrect tag constructor will be registered and used henceforth.                        // 246
 */                                                                                            // 247
HTML.getTag = function (tagName) {                                                             // 248
  var symbolName = HTML.getSymbolName(tagName);                                                // 249
  if (symbolName === tagName) // all-caps tagName                                              // 250
    throw new Error("Use the lowercase or camelCase form of '" + tagName + "' here");          // 251
                                                                                               // 252
  if (! HTML[symbolName])                                                                      // 253
    HTML[symbolName] = makeTagConstructor(tagName);                                            // 254
                                                                                               // 255
  return HTML[symbolName];                                                                     // 256
};                                                                                             // 257
                                                                                               // 258
/**                                                                                            // 259
 * ## HTML.ensureTag(tagName)                                                                  // 260
 *                                                                                             // 261
 * * `tagName` - A string in normalized case                                                   // 262
 *                                                                                             // 263
 * Ensures that a tag constructor (like `HTML.FOO`) exists for a tag                           // 264
 * name (like `"foo"`), creating it if necessary.  Like `HTML.getTag`                          // 265
 * but does not return the tag constructor.                                                    // 266
 */                                                                                            // 267
HTML.ensureTag = function (tagName) {                                                          // 268
  HTML.getTag(tagName); // don't return it                                                     // 269
};                                                                                             // 270
                                                                                               // 271
/**                                                                                            // 272
 * ## HTML.isTagEnsured(tagName)                                                               // 273
 *                                                                                             // 274
 * * `tagName` - A string in normalized case                                                   // 275
 *                                                                                             // 276
 * Returns whether a particular tag is guaranteed to be available on                           // 277
 * the `HTML` object (under the name returned by `HTML.getSymbolName`).                        // 278
 *                                                                                             // 279
 * Useful for code generators.                                                                 // 280
 */                                                                                            // 281
HTML.isTagEnsured = function (tagName) {                                                       // 282
  return HTML.isKnownElement(tagName);                                                         // 283
};                                                                                             // 284
                                                                                               // 285
/**                                                                                            // 286
 * ## HTML.getSymbolName(tagName)                                                              // 287
 *                                                                                             // 288
 * * `tagName` - A string in normalized case                                                   // 289
 *                                                                                             // 290
 * Returns the name of the all-caps constructor (like `"FOO"`) for a                           // 291
 * tag name in normalized case (like `"foo"`).                                                 // 292
 *                                                                                             // 293
 * In addition to converting `tagName` to all-caps, hyphens (`-`) in                           // 294
 * tag names are converted to underscores (`_`).                                               // 295
 *                                                                                             // 296
 * Useful for code generators.                                                                 // 297
 */                                                                                            // 298
HTML.getSymbolName = function (tagName) {                                                      // 299
  // "foo-bar" -> "FOO_BAR"                                                                    // 300
  return tagName.toUpperCase().replace(/-/g, '_');                                             // 301
};                                                                                             // 302
                                                                                               // 303
                                                                                               // 304
/**                                                                                            // 305
 * ## HTML.knownElementNames                                                                   // 306
 *                                                                                             // 307
 * An array of all known HTML5 and SVG element names in normalized case.                       // 308
 */                                                                                            // 309
HTML.knownElementNames = 'a abbr acronym address applet area article aside audio b base basefont bdi bdo big blockquote body br button canvas caption center cite code col colgroup command data datagrid datalist dd del details dfn dir div dl dt em embed eventsource fieldset figcaption figure font footer form frame frameset h1 h2 h3 h4 h5 h6 head header hgroup hr html i iframe img input ins isindex kbd keygen label legend li link main map mark menu meta meter nav noframes noscript object ol optgroup option output p param pre progress q rp rt ruby s samp script section select small source span strike strong style sub summary sup table tbody td textarea tfoot th thead time title tr track tt u ul var video wbr'.split(' ');
// (we add the SVG ones below)                                                                 // 311
                                                                                               // 312
/**                                                                                            // 313
 * ## HTML.knownSVGElementNames                                                                // 314
 *                                                                                             // 315
 * An array of all known SVG element names in normalized case.                                 // 316
 *                                                                                             // 317
 * The `"a"` element is not included because it is primarily a non-SVG                         // 318
 * element.                                                                                    // 319
 */                                                                                            // 320
HTML.knownSVGElementNames = 'altGlyph altGlyphDef altGlyphItem animate animateColor animateMotion animateTransform circle clipPath color-profile cursor defs desc ellipse feBlend feColorMatrix feComponentTransfer feComposite feConvolveMatrix feDiffuseLighting feDisplacementMap feDistantLight feFlood feFuncA feFuncB feFuncG feFuncR feGaussianBlur feImage feMerge feMergeNode feMorphology feOffset fePointLight feSpecularLighting feSpotLight feTile feTurbulence filter font font-face font-face-format font-face-name font-face-src font-face-uri foreignObject g glyph glyphRef hkern image line linearGradient marker mask metadata missing-glyph path pattern polygon polyline radialGradient rect script set stop style svg switch symbol text textPath title tref tspan use view vkern'.split(' ');
// Append SVG element names to list of known element names                                     // 322
HTML.knownElementNames = HTML.knownElementNames.concat(HTML.knownSVGElementNames);             // 323
                                                                                               // 324
/**                                                                                            // 325
 * ## HTML.voidElementNames                                                                    // 326
 *                                                                                             // 327
 * An array of all "void" element names in normalized case.  Void                              // 328
 * elements are elements with a start tag and no end tag, such as BR,                          // 329
 * HR, IMG, and INPUT.                                                                         // 330
 *                                                                                             // 331
 * The HTML spec defines a closed class of void elements.                                      // 332
 */                                                                                            // 333
HTML.voidElementNames = 'area base br col command embed hr img input keygen link meta param source track wbr'.split(' ');
                                                                                               // 335
// Speed up search through lists of known elements by creating internal "sets"                 // 336
// of strings.                                                                                 // 337
var YES = {yes:true};                                                                          // 338
var makeSet = function (array) {                                                               // 339
  var set = {};                                                                                // 340
  for (var i = 0; i < array.length; i++)                                                       // 341
    set[array[i]] = YES;                                                                       // 342
  return set;                                                                                  // 343
};                                                                                             // 344
var voidElementSet = makeSet(HTML.voidElementNames);                                           // 345
var knownElementSet = makeSet(HTML.knownElementNames);                                         // 346
var knownSVGElementSet = makeSet(HTML.knownSVGElementNames);                                   // 347
                                                                                               // 348
/**                                                                                            // 349
 * ## HTML.isKnownElement(tagName)                                                             // 350
 *                                                                                             // 351
 * * `tagName` - A string in normalized case                                                   // 352
 *                                                                                             // 353
 * Returns whether `tagName` is a known HTML5 or SVG element.                                  // 354
 */                                                                                            // 355
HTML.isKnownElement = function (tagName) {                                                     // 356
  return knownElementSet[tagName] === YES;                                                     // 357
};                                                                                             // 358
                                                                                               // 359
/**                                                                                            // 360
 * ## HTML.isKnownSVGElement(tagName)                                                          // 361
 *                                                                                             // 362
 * * `tagName` - A string in normalized case                                                   // 363
 *                                                                                             // 364
 * Returns whether `tagName` is the name of a known SVG element.                               // 365
 */                                                                                            // 366
HTML.isKnownSVGElement = function (tagName) {                                                  // 367
  return knownSVGElementSet[tagName] === YES;                                                  // 368
};                                                                                             // 369
                                                                                               // 370
/**                                                                                            // 371
 * ## HTML.isVoidElement(tagName)                                                              // 372
 *                                                                                             // 373
 * * `tagName` - A string in normalized case                                                   // 374
 *                                                                                             // 375
 * Returns whether `tagName` is the name of a void element.                                    // 376
 */                                                                                            // 377
HTML.isVoidElement = function (tagName) {                                                      // 378
  return voidElementSet[tagName] === YES;                                                      // 379
};                                                                                             // 380
                                                                                               // 381
                                                                                               // 382
// Ensure tags for all known elements                                                          // 383
for (var i = 0; i < HTML.knownElementNames.length; i++)                                        // 384
  HTML.ensureTag(HTML.knownElementNames[i]);                                                   // 385
                                                                                               // 386
                                                                                               // 387
/**                                                                                            // 388
 * ## HTML.CharRef({html: ..., str: ...})                                                      // 389
 *                                                                                             // 390
 * Represents a character reference like `&nbsp;`.                                             // 391
 *                                                                                             // 392
 * A CharRef is not required for escaping special characters like `<`,                         // 393
 * which are automatically escaped by HTMLjs.  For example,                                    // 394
 * `HTML.toHTML("<")` is `"&lt;"`.  Also, now that browsers speak                              // 395
 * Unicode, non-ASCII characters typically do not need to be expressed                         // 396
 * as character references either.  The purpose of `CharRef` is offer                          // 397
 * control over the generated HTML, allowing template engines to                               // 398
 * preserve any character references that they come across.                                    // 399
 *                                                                                             // 400
 * Constructing a CharRef requires two strings, the uninterpreted                              // 401
 * "HTML" form and the interpreted "string" form.  Both are required                           // 402
 * to be present, and it is up to the caller to make sure the                                  // 403
 * information is accurate.                                                                    // 404
 *                                                                                             // 405
 * Examples of valid CharRefs:                                                                 // 406
 *                                                                                             // 407
 * * `HTML.CharRef({html: '&amp;', str: '&'})`                                                 // 408
 * * `HTML.CharRef({html: '&nbsp;', str: '\u00A0'})                                            // 409
 *                                                                                             // 410
 * Instance properties: `.html`, `.str`                                                        // 411
 */                                                                                            // 412
var CharRef = HTML.CharRef = function (attrs) {                                                // 413
  if (! (this instanceof CharRef))                                                             // 414
    // called without `new`                                                                    // 415
    return new CharRef(attrs);                                                                 // 416
                                                                                               // 417
  if (! (attrs && attrs.html && attrs.str))                                                    // 418
    throw new Error(                                                                           // 419
      "HTML.CharRef must be constructed with ({html:..., str:...})");                          // 420
                                                                                               // 421
  this.html = attrs.html;                                                                      // 422
  this.str = attrs.str;                                                                        // 423
};                                                                                             // 424
CharRef.prototype.htmljsType = CharRef.htmljsType = ['CharRef'];                               // 425
                                                                                               // 426
/**                                                                                            // 427
 * ## HTML.Comment(value)                                                                      // 428
 *                                                                                             // 429
 * * `value` - String                                                                          // 430
 *                                                                                             // 431
 * Represents an HTML Comment.  For example, `HTML.Comment("foo")` represents                  // 432
 * the comment `<!--foo-->`.                                                                   // 433
 *                                                                                             // 434
 * The value string should not contain two consecutive hyphens (`--`) or start                 // 435
 * or end with a hyphen.  If it does, the offending hyphens will be stripped                   // 436
 * before generating HTML.                                                                     // 437
 *                                                                                             // 438
 * Instance properties: `value`                                                                // 439
 */                                                                                            // 440
var Comment = HTML.Comment = function (value) {                                                // 441
  if (! (this instanceof Comment))                                                             // 442
    // called without `new`                                                                    // 443
    return new Comment(value);                                                                 // 444
                                                                                               // 445
  if (typeof value !== 'string')                                                               // 446
    throw new Error('HTML.Comment must be constructed with a string');                         // 447
                                                                                               // 448
  this.value = value;                                                                          // 449
  // Kill illegal hyphens in comment value (no way to escape them in HTML)                     // 450
  this.sanitizedValue = value.replace(/^-|--+|-$/g, '');                                       // 451
};                                                                                             // 452
Comment.prototype.htmljsType = Comment.htmljsType = ['Comment'];                               // 453
                                                                                               // 454
/**                                                                                            // 455
 * ## HTML.Raw(value)                                                                          // 456
 *                                                                                             // 457
 * * `value` - String                                                                          // 458
 *                                                                                             // 459
 * Represents HTML code to be inserted verbatim.  `value` must consist                         // 460
 * of a valid, complete fragment of HTML, with all tags closed and                             // 461
 * all required end tags present.                                                              // 462
 *                                                                                             // 463
 * No security checks are performed, and no special characters are                             // 464
 * escaped.  `Raw` should not be used if there are other ways of                               // 465
 * accomplishing the same result.  HTML supplied by an application                             // 466
 * user should not be rendered unless the user is trusted, and even                            // 467
 * then, there could be strange results if required end tags are                               // 468
 * missing.                                                                                    // 469
 *                                                                                             // 470
 * Instance properties: `value`                                                                // 471
 */                                                                                            // 472
var Raw = HTML.Raw = function (value) {                                                        // 473
  if (! (this instanceof Raw))                                                                 // 474
    // called without `new`                                                                    // 475
    return new Raw(value);                                                                     // 476
                                                                                               // 477
  if (typeof value !== 'string')                                                               // 478
    throw new Error('HTML.Raw must be constructed with a string');                             // 479
                                                                                               // 480
  this.value = value;                                                                          // 481
};                                                                                             // 482
Raw.prototype.htmljsType = Raw.htmljsType = ['Raw'];                                           // 483
                                                                                               // 484
                                                                                               // 485
/**                                                                                            // 486
 * ## HTML.isArray(x)                                                                          // 487
 *                                                                                             // 488
 * Returns whether `x` is considered an array for the purposes of                              // 489
 * HTMLjs.  An array is an object created using `[...]` or                                     // 490
 * `new Array`.                                                                                // 491
 *                                                                                             // 492
 * This function is provided because there are several common ways to                          // 493
 * determine whether an object should be treated as an array in                                // 494
 * JavaScript.                                                                                 // 495
 */                                                                                            // 496
HTML.isArray = function (x) {                                                                  // 497
  // could change this to use the more convoluted Object.prototype.toString                    // 498
  // approach that works when objects are passed between frames, but does                      // 499
  // it matter?                                                                                // 500
  return (x instanceof Array);                                                                 // 501
};                                                                                             // 502
                                                                                               // 503
/**                                                                                            // 504
 * ## HTML.isConstructedObject(x)                                                              // 505
 *                                                                                             // 506
 * Returns whether `x` is a "constructed object," which is (loosely                            // 507
 * speaking) an object that was created with `new Foo` (for some `Foo`)                        // 508
 * rather than with `{...}` (a vanilla object).  Vanilla objects are used                      // 509
 * as attribute dictionaries when constructing tags, while constructed                         // 510
 * objects are used as children.                                                               // 511
 *                                                                                             // 512
 * For example, in `HTML.DIV({id:"foo"})`, `{id:"foo"}` is a vanilla                           // 513
 * object.  In `HTML.DIV(HTML.SPAN("text"))`, the `HTML.SPAN` is a                             // 514
 * constructed object.                                                                         // 515
 *                                                                                             // 516
 * A simple constructed object can be created as follows:                                      // 517
 *                                                                                             // 518
 * ```                                                                                         // 519
 * var Foo = function () {};                                                                   // 520
 * var x = new Foo; // x is a constructed object                                               // 521
 * ```                                                                                         // 522
 *                                                                                             // 523
 * In particular, the test is that `x` is an object and `x.constructor`                        // 524
 * is set, but on a prototype of the object, not the object itself.                            // 525
 * The above example works because JavaScript sets                                             // 526
 * `Foo.prototype.constructor = Foo` when you create a function `Foo`.                         // 527
 */                                                                                            // 528
HTML.isConstructedObject = function (x) {                                                      // 529
  return (x && (typeof x === 'object') &&                                                      // 530
          (x.constructor !== Object) &&                                                        // 531
          (! Object.prototype.hasOwnProperty.call(x, 'constructor')));                         // 532
};                                                                                             // 533
                                                                                               // 534
/**                                                                                            // 535
 * ## HTML.isNully(content)                                                                    // 536
 *                                                                                             // 537
 * Returns true if `content` is `null`, `undefined`, an empty array,                           // 538
 * or an array of only "nully" elements.                                                       // 539
 */                                                                                            // 540
HTML.isNully = function (node) {                                                               // 541
  if (node == null)                                                                            // 542
    // null or undefined                                                                       // 543
    return true;                                                                               // 544
                                                                                               // 545
  if (HTML.isArray(node)) {                                                                    // 546
    // is it an empty array or an array of all nully items?                                    // 547
    for (var i = 0; i < node.length; i++)                                                      // 548
      if (! HTML.isNully(node[i]))                                                             // 549
        return false;                                                                          // 550
    return true;                                                                               // 551
  }                                                                                            // 552
                                                                                               // 553
  return false;                                                                                // 554
};                                                                                             // 555
                                                                                               // 556
/**                                                                                            // 557
 * ## HTML.isValidAttributeName(name)                                                          // 558
 *                                                                                             // 559
 * Returns whether `name` is a valid name for an attribute of an HTML tag                      // 560
 * or element.  `name` must:                                                                   // 561
 *                                                                                             // 562
 * * Start with `:`, `_`, `A-Z` or `a-z`                                                       // 563
 * * Consist only of those characters plus `-`, `.`, and `0-9`.                                // 564
 *                                                                                             // 565
 * Discussion: The HTML spec and the DOM API (`setAttribute`) have different                   // 566
 * definitions of what characters are legal in an attribute.  The HTML                         // 567
 * parser is extremely permissive (allowing, for example, `<a %=%>`), while                    // 568
 * `setAttribute` seems to use something like the XML grammar for names (and                   // 569
 * throws an error if a name is invalid, making that attribute unsettable).                    // 570
 * If we knew exactly what grammar browsers used for `setAttribute`, we could                  // 571
 * include various Unicode ranges in what's legal.  For now, we allow ASCII chars              // 572
 * that are known to be valid XML, valid HTML, and settable via `setAttribute`.                // 573
 *                                                                                             // 574
 * See <http://www.w3.org/TR/REC-xml/#NT-Name> and                                             // 575
 * <http://dev.w3.org/html5/markup/syntax.html#syntax-attributes>.                             // 576
 */                                                                                            // 577
HTML.isValidAttributeName = function (name) {                                                  // 578
  return /^[:_A-Za-z][:_A-Za-z0-9.\-]*/.test(name);                                            // 579
};                                                                                             // 580
                                                                                               // 581
/**                                                                                            // 582
 * ## HTML.flattenAttributes(attrs)                                                            // 583
 *                                                                                             // 584
 * If `attrs` is an array, the attribute dictionaries in the array are                         // 585
 * combined into a single attributes dictionary, which is returned.                            // 586
 * Any "nully" attribute values (see `HTML.isNully`) are ignored in                            // 587
 * the process.  If `attrs` is a single attribute dictionary, a copy                           // 588
 * is returned with any nully attributes removed.  If `attrs` is                               // 589
 * equal to null or an empty array, `null` is returned.                                        // 590
 *                                                                                             // 591
 * Attribute dictionaries are combined by assigning the name/value                             // 592
 * pairs in array order, with later values overwriting previous                                // 593
 * values.                                                                                     // 594
 *                                                                                             // 595
 * `attrs` must not contain any foreign objects.                                               // 596
 */                                                                                            // 597
// If `attrs` is an array of attributes dictionaries, combines them                            // 598
// into one.  Removes attributes that are "nully."                                             // 599
HTML.flattenAttributes = function (attrs) {                                                    // 600
  if (! attrs)                                                                                 // 601
    return attrs;                                                                              // 602
                                                                                               // 603
  var isArray = HTML.isArray(attrs);                                                           // 604
  if (isArray && attrs.length === 0)                                                           // 605
    return null;                                                                               // 606
                                                                                               // 607
  var result = {};                                                                             // 608
  for (var i = 0, N = (isArray ? attrs.length : 1); i < N; i++) {                              // 609
    var oneAttrs = (isArray ? attrs[i] : attrs);                                               // 610
    if ((typeof oneAttrs !== 'object') ||                                                      // 611
        HTML.isConstructedObject(oneAttrs))                                                    // 612
      throw new Error("Expected plain JS object as attrs, found: " + oneAttrs);                // 613
    for (var name in oneAttrs) {                                                               // 614
      if (! HTML.isValidAttributeName(name))                                                   // 615
        throw new Error("Illegal HTML attribute name: " + name);                               // 616
      var value = oneAttrs[name];                                                              // 617
      if (! HTML.isNully(value))                                                               // 618
        result[name] = value;                                                                  // 619
    }                                                                                          // 620
  }                                                                                            // 621
                                                                                               // 622
  return result;                                                                               // 623
};                                                                                             // 624
                                                                                               // 625
                                                                                               // 626
                                                                                               // 627
////////////////////////////// TOHTML                                                          // 628
                                                                                               // 629
/**                                                                                            // 630
 * ## HTML.toHTML(content)                                                                     // 631
 *                                                                                             // 632
 * * `content` - any HTMLjs content                                                            // 633
 *                                                                                             // 634
 * Returns a string of HTML generated from `content`.                                          // 635
 *                                                                                             // 636
 * For example:                                                                                // 637
 *                                                                                             // 638
 * ```                                                                                         // 639
 * HTML.toHTML(HTML.HR()) // => "<hr>"                                                         // 640
 * ```                                                                                         // 641
 *                                                                                             // 642
 * Foreign objects are not allowed in `content`.  To generate HTML                             // 643
 * containing foreign objects, create a subclass of                                            // 644
 * `HTML.ToHTMLVisitor` and override `visitObject`.                                            // 645
 */                                                                                            // 646
HTML.toHTML = function (content) {                                                             // 647
  return (new HTML.ToHTMLVisitor).visit(content);                                              // 648
};                                                                                             // 649
                                                                                               // 650
// Escaping modes for outputting text when generating HTML.                                    // 651
HTML.TEXTMODE = {                                                                              // 652
  STRING: 1,                                                                                   // 653
  RCDATA: 2,                                                                                   // 654
  ATTRIBUTE: 3                                                                                 // 655
};                                                                                             // 656
                                                                                               // 657
/**                                                                                            // 658
 * ## HTML.toText(content, textMode)                                                           // 659
 *                                                                                             // 660
 * * `content` - any HTMLjs content                                                            // 661
 * * `textMode` - the type of text to generate; one of                                         // 662
 *   `HTML.TEXTMODE.STRING`, `HTML.TEXTMODE.RCDATA`, or                                        // 663
 *   `HTML.TEXTMODE.ATTRIBUTE`                                                                 // 664
 *                                                                                             // 665
 * Generating HTML or DOM from HTMLjs content requires generating text                         // 666
 * for attribute values and for the contents of TEXTAREA elements,                             // 667
 * among others.  The input content may contain strings, arrays,                               // 668
 * booleans, numbers, nulls, and CharRefs.  Behavior on other types                            // 669
 * is undefined.                                                                               // 670
 *                                                                                             // 671
 * The required `textMode` argument specifies the type of text to                              // 672
 * generate:                                                                                   // 673
 *                                                                                             // 674
 * * `HTML.TEXTMODE.STRING` - a string with no special                                         // 675
 *   escaping or encoding performed, suitable for passing to                                   // 676
 *   `setAttribute` or `document.createTextNode`.                                              // 677
 * * `HTML.TEXTMODE.RCDATA` - a string with `<` and `&` encoded                                // 678
 *   as character references (and CharRefs included in their                                   // 679
 *   "HTML" form), suitable for including in a string of HTML                                  // 680
 * * `HTML.TEXTMODE.ATTRIBUTE` - a string with `"` and `&` encoded                             // 681
 *   as character references (and CharRefs included in their                                   // 682
 *   "HTML" form), suitable for including in an HTML attribute                                 // 683
 *   value surrounded by double quotes                                                         // 684
 */                                                                                            // 685
                                                                                               // 686
HTML.toText = function (content, textMode) {                                                   // 687
  if (! textMode)                                                                              // 688
    throw new Error("textMode required for HTML.toText");                                      // 689
  if (! (textMode === HTML.TEXTMODE.STRING ||                                                  // 690
         textMode === HTML.TEXTMODE.RCDATA ||                                                  // 691
         textMode === HTML.TEXTMODE.ATTRIBUTE))                                                // 692
    throw new Error("Unknown textMode: " + textMode);                                          // 693
                                                                                               // 694
  var visitor = new HTML.ToTextVisitor({textMode: textMode});;                                 // 695
  return visitor.visit(content);                                                               // 696
};                                                                                             // 697
                                                                                               // 698
/////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package.htmljs = {
  HTML: HTML
};

})();

//# sourceMappingURL=htmljs.js.map
