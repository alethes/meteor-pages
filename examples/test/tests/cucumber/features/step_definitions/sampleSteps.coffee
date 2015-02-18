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
    helper.world.browser
      .execute ((setting, value) ->
        ->
          Pages.set setting, value
      ) setting, value
      .call(callback)
  @When /^(?:Pages|Pagination) is ready$/, (callback) ->
    helper.world.browser
      .timeoutsAsyncScript 5000
      .executeAsync (done) ->
        Tracker.autorun ->
          return done 1#a.b.c#Items.findOne()
          if Pages? and Pages.sess "ready"
            done()
      , ->
        console.log arguments
        callback()
  @Then /^I should see the title of "([^"]*)"$/, (expectedTitle, callback) ->
    helper.world.browser
      .title (err, res) ->
        assert.equal 1, 1#res.value, expectedTitle
        callback()
  @Then /^I should see ([0-9]*) items$/, (expectedNumber, callback) ->
    helper.world.browser.elements ".pagesItemDefault", (err, ret) ->
      assert expectedNumber, ret.value.length
      callback()