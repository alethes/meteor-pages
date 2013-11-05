$ ->
    $('#slider').slider
        value: 10
        max: 30
        change: ->
            Pages.set "perPage", $(this).slider("value")
            Pages2.set "perPage", $(this).slider("value")