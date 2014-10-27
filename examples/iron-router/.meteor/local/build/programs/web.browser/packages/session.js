//////////////////////////////////////////////////////////////////////////
//                                                                      //
// This is a generated file. You can view the original                  //
// source in your browser if your browser supports source maps.         //
//                                                                      //
// If you are using Chrome, open the Developer Tools and click the gear //
// icon in its lower right corner. In the General Settings panel, turn  //
// on 'Enable source maps'.                                             //
//                                                                      //
// If you are using Firefox 23, go to `about:config` and set the        //
// `devtools.debugger.source-maps-enabled` preference to true.          //
// (The preference should be on by default in Firefox 24; versions      //
// older than 23 do not support source maps.)                           //
//                                                                      //
//////////////////////////////////////////////////////////////////////////


(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var _ = Package.underscore._;
var ReactiveDict = Package['reactive-dict'].ReactiveDict;
var EJSON = Package.ejson.EJSON;

/* Package-scope variables */
var Session;

(function () {

///////////////////////////////////////////////////////////////////////////////////////////
//                                                                                       //
// packages/session/session.js                                                           //
//                                                                                       //
///////////////////////////////////////////////////////////////////////////////////////////
                                                                                         //
Session = new ReactiveDict('session');                                                   // 1
                                                                                         // 2
// Documentation here is really awkward because the methods are defined                  // 3
// elsewhere                                                                             // 4
                                                                                         // 5
/**                                                                                      // 6
 * @memberOf Session                                                                     // 7
 * @method set                                                                           // 8
 * @summary Set a variable in the session. Notify any listeners that the value has changed (eg: redraw templates, and rerun any [`Tracker.autorun`](#tracker_autorun) computations, that called [`Session.get`](#session_get) on this `key`.)
 * @locus Client                                                                         // 10
 * @param {String} key The key to set, eg, `selectedItem`                                // 11
 * @param {EJSONable | undefined} value The new value for `key`                          // 12
 */                                                                                      // 13
                                                                                         // 14
/**                                                                                      // 15
 * @memberOf Session                                                                     // 16
 * @method setDefault                                                                    // 17
 * @summary Set a variable in the session if it is undefined. Otherwise works exactly the same as [`Session.set`](#session_set).
 * @locus Client                                                                         // 19
 * @param {String} key The key to set, eg, `selectedItem`                                // 20
 * @param {EJSONable | undefined} value The new value for `key`                          // 21
 */                                                                                      // 22
                                                                                         // 23
/**                                                                                      // 24
 * @memberOf Session                                                                     // 25
 * @method get                                                                           // 26
 * @summary Get the value of a session variable. If inside a [reactive computation](#reactivity), invalidate the computation the next time the value of the variable is changed by [`Session.set`](#session_set). This returns a clone of the session value, so if it's an object or an array, mutating the returned value has no effect on the value stored in the session.
 * @locus Client                                                                         // 28
 * @param {String} key The name of the session variable to return                        // 29
 */                                                                                      // 30
                                                                                         // 31
/**                                                                                      // 32
 * @memberOf Session                                                                     // 33
 * @method equals                                                                        // 34
 * @summary Test if a session variable is equal to a value. If inside a [reactive computation](#reactivity), invalidate the computation the next time the variable changes to or from the value.
 * @locus Client                                                                         // 36
 * @param {String} key The name of the session variable to test                          // 37
 * @param {String | Number | Boolean | null | undefined} value The value to test against // 38
 */                                                                                      // 39
                                                                                         // 40
///////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package.session = {
  Session: Session
};

})();
