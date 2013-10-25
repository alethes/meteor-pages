Meteor Paginate
===============

State of the art, out of the box Meteor pagination.
---------------------------------------------------

Features
--------

+ **Incremental subscriptions**. Downloads only what's needed, not the entire collection at once. Suitable for large datasets.
+ **Local cache**. One page - one request. Saves and reuses data on subsequent visits to the same page.
+ **Neighbor prefetching**. After loading the current page, it prefetches the neighbors to ensure seamless transition.
+ **Request throttling**. Allows you to limit how often the page can be changed.
+ **Easy integration**. The package works out of the box. Pages changes are triggered by one session variable.
+ **Bootstrap 2/3-compatible navigation template**. The package itself borrows some CSS from Bootstrap 3 to ensure good looks without dependency, but can be re-styled easily.
+ **Failure resistance**. Accounts for multiple scenarios of failure.
+ **Built-in iron-router integration**. Easy binding to any other router.
+ **Trivial customization**. Items per page, sorting, filters and more adjustable on the fly! Just modify a setting and see the pagination redrawing.

Usage
-----
Coffeescript:

`@Paginate = Meteor.Paginate "collection-name"`
      
or Javascript:

`
this.Paginate = Meteor.Paginate("collection-name");
`

and HTML:
```
<body>
    {{> paginateNav}}
    <div style="min-height:400px">
    {{> paginate}}
    </div>
    {{> paginateNav}}
</body>
```

Examples
--------

Currently there're just two examples. One demonstrates the most basic usage and the other shows how to easily integrate pages with iron-router. If you experience any problems, make sure all the dependencies are installed (using Meteorite).
Basic example:
```
meteor add coffeescript
mrt add pages
```
Iron-router:
```
meteor add coffeescript
mrt add pages
mrt add iron-router
mrt add bootstrap-3 (optional)
```