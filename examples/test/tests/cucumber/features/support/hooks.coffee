module.exports = ->
  helper = @
  @Before ->
    world = helper.world
    next = arguments[arguments.length - 1]
    world.browser.init()
      .setViewportSize
        width: 1280
        height: 1024
      .call next
  @After ->
    world = helper.world
    next = arguments[arguments.length - 1]
    world.browser
      .end()
      .call next