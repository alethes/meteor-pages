Meteor Pages
============

State of the art, out of the box Meteor pagination
--------------------------------------------------

As of version 1.0.0, following a major overhaul, the module is fully compatible with Blaze (Meteor 0.8.0+) and features native reactivity support.

Live demos: 

Basic usage - [http://pages.meteor.com/](http://pages.meteor.com/)

Table (using *fast-render*) - [http://pages-table.meteor.com](http://pages-table.meteor.com/)

Reactive, multiple collections - [http://pages-multi.meteor.com/](http://pages2.meteor.com/)

Infinite scrolling - [http://pages3.meteor.com/](http://pages3.meteor.com/)

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
+ **Trivial customization on the fly**. Items per page, sorting, filters and more adjustable on the fly! Just modify a setting and see the pagination redrawing.

Installation
------------
Meteorite:
`mrt add pages`

Basic usage
-----------
JavaScript/CoffeScript (in common code, running on both the server and the client):

`
Pages = new Meteor.Pagination("collection-name")
`

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

Settings
--------
Settings can be passed as a second argument to `Meteor.Pagination()`. Most of them can be changed on the client-side, causing an immediate redrawing.

There are two ways to modify settings:

1. In common code, during declaration (client and server):

```CoffeeScript:
@Pages = new Meteor.Pagination "collection-name",
    perPage: 20
    sort: 
        title: 1
    filters: 
        count: 
            $gt: 10
```
2. Client-side code / common code (client and server), after declaration:

```CoffeeScript:
Pages.set
  perPage: 10
  sort:
    title: -1
```

Available to the client:
+ **dataMargin (*Number*, default = 3)** - determines how many neighboring pages on each side should be prefetched for seamless transition after loading the current page.
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
+ **router (*String or Boolean*, default = false)** - Three options:
   - *true* - a router is used but the routes are configured separately by the user
   - *false* - no router used
   - *"iron-router"* - *iron-router* is used and the routes are automatically set up by *Pages*
+ **routerTemplate (*String*, default = "pages")** - a template used by *iron-router* to generate paging 
+ **sort (*Object*, default = {})** - MongoDB sort determining object, eg. {name: 1}
+ **templateName (*String*, default = "")** - A name of the template to use. Defaults to the collection's name.

Unavailable to the client:
+ **divWrapper (*String*, default = false)** - if provided, the Pagination page is wrapped in a div with the provided class name
+ **fastRender (*Boolean*, default = false)** - determines whether *fast-render* package should be used to speed up page loading
+ **homeRoute (*String*, default = "/")** - if "iron-router" is enabled, the specified route sets currentPage to 1
+ **infinite (*Boolean*, default = false)** - infinite scrolling
+ **infiniteItemsLimit (*Number*, default = Infinity)** - the maximum number of items to display at once in infinite scrolling mode. If the number (n) is less then Infinity only the last n items are displayed on the page.
+ **infiniteRateLimit (*Number*, default = 1)** - determines the minimum interval (in seconds) between subsequent page changes in infinite scrolling mode
+ **infiniteTrigger (*Number*, default = .8)** - if infinite scrolling is used, determines how far (for val > 1: in pixels, for 0 > val >= 1: in (1 - percent)) from the bottom of the page should the new data portion be requested
+ **navTemplate (*String*, default = "_pagesNav")** - name of the template used for displaying the pagination navigation
+ **pageTemplate (*String*, default = "_pagesPage")** - name of the template used for displaying a page of items
+ **pageSizeLimit (*Number*, default = 60)** - limits the maximum number of items displayed per page
+ **rateLimit (*Number*, default = 1)** - determines the minimum interval (in seconds) between subsequent page changes
+ **table (*Object*, default = false)** - generates a table with data from the paginated collection. The following attributes can be provided:
  + **fields (*Array*, required)** - an array of fields to be displayed in subsequent columns of the table
  + **class (*String*, default = "")** - class name of the table
  + **header (*Array*, default = *fields*)** - an array of labels to be displayed for subsequent columns in the header row of the table. The *fields* array is used labels if *header* is not specified.
  + **wrapper (*String*, default = false)** - a class name of the optional *\<div\>* wrapper. The wrapper is not generated if the argument is left out.


Examples
--------

Currently, the following examples are available in the */examples* directory:

+ *basic* - the most straightforward way of using *Pages*. The default item template simply lists each item's attributes.

+ *table* - a data table, constructed automatically based on the list of fields to display

If you experience any problems, make sure all the dependencies are installed (using Meteorite). Just run `mrt install` and Meteorite will install the dependencies. CoffeeScript is also required, so run `meteor add coffeescript`.

Todos
-----
+ Implementing performance optimized live sort for modified/incoming data
+ Tests

Support
-------
If you find this package useful, please support its development:
[https://www.gittip.com/alethes/](https://www.gittip.com/alethes/)