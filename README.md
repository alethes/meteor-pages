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
+ **Bootstrap 2/3-compatible navigation template**. Can be styled easily without Bootstrap as well.
+ **Failure resistance**. Accounts for multiple scenarios of failure.
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

