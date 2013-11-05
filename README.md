Meteor Pages
============

State of the art, out of the box Meteor pagination.
---------------------------------------------------
Live demo: [http://pages.meteor.com/](http://pages.meteor.com/)
Live demo (2 collections, adjustable page size): [http://pages2.meteor.com/](http://pages2.meteor.com/)

Features
--------

+ **Incremental subscriptions**. Downloads only what's needed, not the entire collection at once. Suitable for large datasets.
+ **Local cache**. One page - one request. Saves and reuses data on subsequent visits to the same page.
+ **Neighbor prefetching**. After loading the current page, it prefetches the neighbors to ensure seamless transitions.
+ **Request throttling**. Allows you to limit how often the page can be changed.
+ **Easy integration**. The package works out of the box. Page changes are triggered by a single session variable.
+ **Multiple collections per page**. Each Pagination instance runs independently.
+ **Bootstrap 2/3-compatible navigation template**. The package itself borrows some CSS from Bootstrap 3 to ensure good looks without dependency, but can be re-styled easily.
+ **Failure resistance**. Accounts for multiple scenarios of failure.
+ **Built-in iron-router integration**. Binds easily to any other router.
+ **Trivial customization on the fly**. Items per page, sorting, filters and more adjustable on the fly! Just modify a setting and see the pagination redrawing.

Installation
------------
Meteorite:
`mrt add pages`

Basic usage
-----------
The following should be executed in the common code (both on the server- and the client-side).

Coffeescript:

`@Pages = Meteor.Paginate "collection-name"`
      
or Javascript:

`
this.Pages = Meteor.Paginate("collection-name");
`

and HTML:
```
<body>
    {{> collection-name}}
</body>
<template name="collection-name">
    {{{pagesNav}}} <!--Top navigation--> 
    <div style="min-height:500px">
    {{{pages}}}
    </div>
    {{{pagesNav}}} <!--Bottom navigation-->
</template>
```

Of course, you can use any variable to store the object returned by `Meteor.Paginate()`, not necessarily `Pages`.

Settings
--------
Settings can be passed as a second argument to `Meteor.Paginate()`. Almost all of them can be changed on the client-side, causing immediate redrawing.

There are two ways to modify settings:

1. In common code, during declaration (client and server):

```
@Pages = Meteor.Paginate "collection-name",
    perPage: 20
    sort: 
        title: 1
    filters: 
        count: 
            $gt: 10
```
2. Client-side code / common code (client and server), after declaration:

```
Pages.set({
    perPage: 10,
    sort: 
        {title: -1}
})
```

Available to the client:
+ **dataMargin (*Number*, default: 3)** - determines how many neighboring pages on each side should be prefetched for seamless transition after loading the current page.
+ **filters (*Object*, default = {})** - MongoDB find query object, eg. `{name: {$lt: 5}}`
+ **itemTemplate (*String*, default = "paginateItemDefault")** - name of the template to use for items. The default template simply lists all attributes of an item
+ **navShowFirst (*Boolean*, default = false)** - whether to show the link to the first page («) in the navigation panel
+ **navShowLast (*Boolean*, default = false)** - whether to show the link to the last page (») in the navigation panel
+ **onReloadPage1 (*Boolean*, default = false)** - determines whether to navigate to page 1 after reloading caused by a change in settings (eg. new sorting order)
+ **paginationMargin (*Number*, default = 3)** - the number of neighboring pages to display on each side of the navigation panel
+ **perPage (*Number*, default = 10)** - number of items to display per page (can't be larger than server-imposed **pageSizeLimit**)
+ **requestTimeout (*Number*, default = 3)** - number of seconds to wait for a response until retrying (usable mainly when there're many collections on the page)
+ **route (*String*, default = "/page/")** - route prefix used for subsequent pages (eg. "/page/" gives "/page/1", "/page/2" etc.)
+ **router (*String or Boolean*, default = false)** - Three options:
   - *true* - a router is used but the routes are configured separately by the user
   - *false* - no router used
   - *"iron-router"* - *iron-router* is used and the routes are automatically set up by *pages*
+ **routerTemplate (*String*, default = "pages")** - a template used by *iron-router* to generate paging 
+ **sort (*Object*, defualt = {})** - MongoDB sort determining object, eg. {name: 1}
+ **templateName (*String*, defualt = "")** - A name of the template to use. Defaults to the collection's name.

Unavailable to the client:
+ **pageSizeLimit (*Number*, default = 60)** - limits the maximum number of items displayed per page


Examples
--------

Currently there're just two examples. One demonstrates the most basic usage and the other shows how to easily integrate *pages* with iron-router. If you experience any problems, make sure all the dependencies are installed (using Meteorite).
Basic example:
```
meteor add coffeescript
mrt add pages
mrt add bootstrap-3 (optional)
```
Iron-router:
```
meteor add coffeescript
mrt add pages
mrt add iron-router
mrt add bootstrap-3 (optional)
```

Todos
-----
+ Infinite scrolling
+ Option to preserve the old page until new one is loaded
+ Handling dynamically incoming data with timestamp field
+ Other pagination styles
+ TESTS!