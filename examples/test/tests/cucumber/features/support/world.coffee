module.exports = ->
  helper = @
  @World = (next) ->
    helper.world = @
    helper.world.cucumber = Package["xolvio:cucumber"].cucumber
    Package["xolvio:webdriver"].wdio.getGhostDriver (browser) ->
      helper.world.browser = browser
      browser.call next