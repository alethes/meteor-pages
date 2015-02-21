assert = require "assert"

module.exports = ->
  helper = @
  @Given /^I am on the home page$/, (callback) ->
    helper.world.browser
      .url helper.world.cucumber.mirror.rootUrl
      .call callback
  @When /^I navigate to "([^"]*)"$/, (relativePath, callback) ->
    helper.world.browser
      .url helper.world.cucumber.mirror.rootUrl + relativePath
      .call(callback)
  @When /^I set "([^"]*)" to (.+)$/, (setting, value, callback) ->
    value = if /^[0-9]+$/.test value
      Number value
    else
      JSON.parse value
    helper.world.browser
      .execute ((setting, value) ->
        Pages.set setting, value
      ), setting, value
      .call(callback)
  @When /^"([^"]*)" is set to (.+)$/, (setting, value, callback) ->
    helper.world.browser
      .execute ((setting, value) ->
        setting = setting.split "."
        ref = Pages
        for i in setting
          ref = Pages[i]
          throw "'#{i}' has no value"  if !ref?
        _.isEqual ref, value
      ), setting, Number value
      , (err, ret) ->
        throw err  if err?
        assert ret.value, true
        callback()
  @Then /^I move to page ([0-9]*)$/, (pageNumber, callback) ->
    helper.world.browser
      .execute ((pageNumber) ->
        Pages.onNavClick pageNumber
      ), pageNumber
      .call(callback)
  @When /^(?:Pages|Pagination) is ready$/, (callback) ->
    helper.world.browser
      .timeoutsAsyncScript 20000
      .executeAsync (done) ->
        Tracker.autorun ->
          if Pages? and Pages.sess "ready"
            done true
      , (err, ret) ->
        throw err  if err?
        assert ret.value, true
        callback()
  @Then /^I should see the title of "([^"]*)"$/, (expectedTitle, callback) ->
    helper.world.browser
      .title (err, res) ->
        assert.equal res.value, expectedTitle
        callback()
  @Then /^I should see ([0-9]*) items$/, (expectedNumber, callback) ->
    helper.world.browser.elements ".pagesItemDefault", (err, ret) ->
      assert expectedNumber, ret.value.length
      callback()
  @Then /^I should see ([0-9]*) items from ([0-9]*) to ([0-9]*)$/, (n, from, to, callback) ->
    helper.world.browser
      .execute ((n, from, to) ->
        items = $ ".pagesItemDefault"
        return [false, items.length, n]  if items.length isnt Number n
        ids = [Number(from) .. Number(to)]
        return [false, items.length, ids.length]  if items.length isnt ids.length
        for i in [0 ... items.length]
          if Number(/id[^0-9]+?([0-9]+)/.exec(
            $(items[i]).html()
          )[1]) isnt ids[i]
            return [false, Number(/id[^0-9]+?([0-9]+)/.exec(
              $(items[i]).html()
            )[1]), ids[i], i, ids]
        return [true]
      ), n, from, to
      , (err, ret) ->
        assert.equal ret.value[0], true
        callback()