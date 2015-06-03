Meteor Pages
============

State of the art, out of the box Meteor pagination
--------------------------------------------------

Live demos: 

Basic usage - [http://pages.meteor.com/](http://pages.meteor.com/)

Table (using *fast-render*) - [http://pages-table.meteor.com](http://pages-table.meteor.com/)

Reactive, multiple collections - [http://pages-multi.meteor.com/](http://pages2.meteor.com/)

Infinite scrolling - [http://pages3.meteor.com/](http://pages3.meteor.com/)


Live help
---------

Do you need some assistance with Meteor development? [I'm happy to help.](https://www.codementor.io/alethes)

Features
--------

+ **Incremental subscriptions**. Downloads only what is needed, not the entire collection at once. Suitable for large datasets.
+ **Local cache**. One page - one request. Saves and reuses data on subsequent visits to the same page.
+ **Neighbor prefetching**. After loading the current page, it prefetches the neighbors to ensure seamless transitions.
+ **Request throttling**. Allows you to limit how often the page can be changed.
+ **Easy integration**. The package works out of the box. Page changes are triggered by a single session variable.
+ **Multiple collections per page**. Each Pagination instance runs independently. You can even create multiple paginations for one collection on a single page.
+ **Bootstrap 2/3-compatible navigation template**. The package itself borrows some CSS from Bootstrap 3 to ensure good looks without dependency, but can be re-styled easily.
+ **Failure resistance**. Accounts for multiple scenarios of failure.
+ **Built-in iron-router integration**. Binds easily to any other router.
+ **Infinite scrolling**. Easily controlled and fully leveraging the package's powerful features.
+ **Automatic generation of paginated tables**.
+ **Secure design**. Effortlessly control what to publish, when to publish and what view modifications to allow (using the **availableSettings** feature).
+ **Built-in authorization support**. Easily restrict data access according to arbitrary sets of rules.
+ **Trivial customization on the fly**. Items per page, sorting, filters and more adjustable on the fly! Just modify a setting and see the pagination redrawing.
+ **Live sort**. All changes in the data are immediately reflected. Items move around within and across pages according to arbitrary sorting rules.

Installation
------------
Meteor 0.9+:
`meteor add alethes:pages`

Meteorite:
`mrt add pages`

Basic usage
-----------
JavaScript/CoffeeScript (in common code, running on both the server and the client):

```js
this.Pages = new Meteor.Pagination("collection-name");
```

and HTML:
```html
<body>
    {{> collection-name}}
</body>
<template name="collection-name">
    {{> pages}}
    {{> pagesNav}}  <!--Bottom navigation-->
</template>
```

Of course, you can use any variable to store the object returned by `new Meteor.Pagination()`, not necessarily `Pages`.

As for the customizations, there's a multitude of options. You'll most likely want to define your own template for the paginated items. When you do, you can pass it's name to the `Meteor.Pagination` constructor:

```js
this.Pages = new Meteor.Pagination("collection-name", {
  itemTemplate: "myItemTemplate"
})
```

Settings
--------
Settings can be passed as a second argument to `Meteor.Pagination()`. Many of them can be changed on the client-side, causing an immediate redraw. Unless stated otherwise, user-defined functions are called in the context of the *Pagination* object.

There are two ways to modify settings:

1. In common code, during declaration (client and server):

```js
this.Pages = new Meteor.Pagination("collection-name", {
  perPage: 20,
  sort: {
    title: 1
  },
  filters: {
    count: {
      $gt: 10
    }
  },
  availableSettings: {
    perPage: true,
    sort: true
  }
});
```
2. Client-side code / common code (client and server), after declaration:

```js
Pages.set({
  perPage: 10,
  sort: {
    title: -1
  }
});
```

Available to the client:
+ **dataMargin (*Number*, default = 3)** - determines how many neighboring pages on each side should be prefetched for seamless transition after loading the current page. Prefetching stops when the subscription limit (imposed by **maxSubscriptions**) is reached.
+ **filters (*Object*, default = {})** - MongoDB find query object, eg. `{name: {$lt: 5}}`
+ **itemTemplate (*String*, default = "paginateItemDefault")** - name of the template to use for items. The default template simply lists all attributes of an item
+ **navShowEdges (*Boolean*, default = false)** - whether to show the links to the edge pages («) in the navigation panel. If true, overrides *navShowFirst* and *navShowLast*.
+ **navShowFirst (*Boolean*, default = true)** - whether to show the link to the first page («) in the navigation panel. If true, overrides *navShowEdges*.
+ **navShowLast (*Boolean*, default = true)** - whether to show the link to the last page (») in the navigation panel. If true, overrides *navShowEdges*.
+ **onReloadPage1 (*Boolean*, default = false)** - determines whether to navigate to page 1 after reloading caused by a change in settings (eg. new sorting order)
+ **paginationMargin (*Number*, default = 3)** - the number of neighboring pages to display on each side of the navigation panel
+ **perPage (*Number*, default = 10)** - number of items to display per page or to load per request in case of infinite scrolling (cannot be larger than server-imposed **pageSizeLimit**)
+ **requestTimeout (*Number*, default = 3)** - number of seconds to wait for a response until retrying (usable mainly when there are many collections on the page)
+ **route (*String*, default = "/page/")** - route prefix used for subsequent pages (eg. "/page/" gives "/page/1", "/page/2" etc.)
+ **router (*String*, default = **undefined**)** - Three options:
   - *true* - a router is used but the routes are configured separately by the user
   - *false* - no router used
   - *"iron-router"* - *iron-router* is used and the routes are automatically set up by *Pages*
+ **routerTemplate (*String*, default = "pages")** - a template used by *iron-router* to generate paging 
+ **routerLayout (*String*, default = "layout")** - a layout used by *iron-router* to generate paging 
+ **sort (*Object*, default = {})** - MongoDB sort determining object, eg. {name: 1}
+ **templateName (*String*, default = "")** - A name of the template to use. Defaults to the collection's name.

Unavailable to the client:
+ **auth (*Function*, default = undefined)** - authorization function called by the built-in publication method with the following arguments:
   - *skip* - precalculated number of items to skip based on the number of page being published. Useful when returning a cursor.
   - *subscription* - the Meteor subscription object (*this* in *Meteor.publish()*). **In authenticated connections, *subscription.userId* holds the currently signed-in user's *_id*. Otherwise, it's *null*.**
  The authorization function is called in the context of the *Pagination* object.
  The page number is not exposed because it shouldn't be necessary and page-dependent authorization rules would render calculation of the total number of pages ineffective. The total page count is needed for displaying navigation controls properly.
  
  The authorization function should return one of the following:
   - *true* - grants unrestricted access to the paginated collection
   - a *falsy value* - denies access to the paginated collection
   - a *Number* - publishes only pages with page number not greater than the specified number (1-based numbering is used for pages).
   - an *Array* of the form: [*filters*, *options*] - publishes `this.Collection.find(*filters*, *option*)`
   - a *Mongo.Collection.Cursor* (or some other cursor with a compatible interface) - publishes the cursor.
   - an *Array of Mongo.Collection.Cursor objects* (or some others cursor with a compatible interface) - publishes the cursors.
   When publishing a cursor or an array of cursors, you have to make sure to set *realFilters* (filters used in publication; sometimes different from filters visible to the client) or *nPublishedPages* (explicit number of published pages) manually to ensure proper rendering of navigation controls. In most cases, it's recommended to return an array with filters and options (option 4) instead.
+ **availableSettings (*Object*, default = {})** - defines rules for changes in settings initiated by the client. A valid entry references the name of a setting by key and has one of the following as a value:
   - *true* - allows all changes to the setting (if not otherwise limited by constraints such as `pageSizeLimit`)
   - a *falsy value* - explicitly disallows all modifications. Has the same effect as leaving the setting out.
   - a *Function* - defines a policy controlling changes in the specified setting.
+ **divWrapper (*String, Boolean*, default = "pageCont")** - if it's specified and table mode is not enabled, the Pagination page is wrapped in a div with the provided class name
+ **fastRender (*Boolean*, default = false)** - determines whether *fast-render* package should be used to speed up page loading
+ **homeRoute (*String*, default = "/")** - if "iron-router" is enabled, the specified route sets currentPage to 1
+ **infinite (*Boolean*, default = false)** - infinite scrolling
+ **infiniteItemsLimit (*Number*, default = Infinity)** - the maximum number of items to display at once in infinite scrolling mode. If the number (n) is less then Infinity only the last n items are displayed on the page.
+ **infiniteRateLimit (*Number*, default = 1)** - determines the minimum interval (in seconds) between subsequent page changes in infinite scrolling mode
+ **infiniteTrigger (*Number*, default = .8)** - if infinite scrolling is used, determines how far (for val > 1: in pixels, for 0 > val >= 1: in (1 - percent)) from the bottom of the page should the new data portion be requested
+ **initPage (*Number*, default = 1)** - number of the initially displayed page
+ **maxSubscriptions (*Number*, default = 100)** - the maximum number of simultaneously active subscriptions per client. Normally, open pages and,if **dataMargin** is greater than one, their neighbors are cached on the client-side for seamless transitions. To achieve this, multiple subscriptions (each keeping track of a single page) are held open at the same time. This prevents clients from requesting the same page several times as the user navigates back and forth within the paginated set. This lowers the amount of data sent over the wire and decreases server load for mostly static data. However, each addition to, or removal from the set (along with some of the modifications) trigger a cascade of changes in the active subscriptions. In addition, a very high number of simultaneous subscriptions may overload the memory on both the server and the client side. To prevent that, a `Pagination` instance can keep track of the number of active subscriptions and securely limit them behind the scenes. Each `Pagination` instance has a separate subscription limit.
+ **navTemplate (*String*, default = "_pagesNav")** - name of the template used for displaying the pagination navigation
+ **onDeniedSetting (*Function*, logs "Changing {{setting}} not allowed." to console by default)** - called when the setting is unavailable to the client (based on the rules defined in #availableSettings() or lack thereof).
+ **pageTemplate (*String*, default = "_pagesPage")** - name of the template used for displaying a page of items
+ **pageCountFrequency (*Number*, default = 10)** - determines the number of seconds between the client's subsequent requests for an up-to-date total page count. Shouldn't be less than 1.
+ **pageSizeLimit (*Number*, default = 60)** - limits the maximum number of items displayed per page
+ **rateLimit (*Number*, default = 1)** - determines the minimum interval (in seconds) between subsequent page changes
+ **routeSettings (*Function*, default = undefined)** - an optional function which, when *iron-router* is enabled, is called (in the context of the *Pagination* object) from *onBeforeAction* with the route object (`this` in *onBeforeAction*) as an argument. It enables modifying pagination settings (eg. filters) based on the route's parameters (see *iron-router* example, view 3).
+ **table (*Object, Boolean*, default = false)** - generates a table with data from the paginated collection. The following attributes can be provided:
  + **fields (*Array*, required)** - an array of fields to be displayed in subsequent columns of the table
  + **class (*String*, default = "")** - class name of the table
  + **header (*Array*, default = *fields*)** - an array of labels to be displayed for subsequent columns in the header row of the table. The *fields* array is used labels if *header* is not specified.
  + **wrapper (*String, Boolean*, default = false)** - a class name of the optional *\<div\>* wrapper. The wrapper is not generated if the argument is left out.


Examples
--------

Currently, the following examples are available in the */examples* directory:

+ *basic* - the most straightforward way of using *Pages*. The default item template simply lists the attributes of each item.

+ *changePerPage* - basic usage with two buttons enabling immediate changes to the "perPage" setting

+ *infinite* - infinite scrolling

+ *iron-router* - a basic example of iron-router integration

+ *multi-collection* - multiple paginations on a single page

+ *table* - a data table, constructed automatically based on the list of fields to display

Todos
-----
+ Tests
