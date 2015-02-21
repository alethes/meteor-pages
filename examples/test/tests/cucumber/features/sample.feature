Feature: Home page
  Scenario:
    Given I am on the home page
    When Pages is ready
    Then I should see 10 items from 1 to 10
Feature: Page navigation
  Scenario:
    Given I am on the home page
    When I move to page 10
    And Pages is ready
    Then I should see 10 items from 91 to 100
Feature: Reactivity
  Scenario:
    Given I am on the home page
    When I move to page 10
    And Pages is ready
    Then I should see 10 items from 91 to 100
Feature: Changing the sorting order
  Scenario:
    Given I am on the home page
    When I set "sort" to {"id": -1}
    And Pages is ready
    Then I should see 10 items from 100 to 91
Feature: Setting the number of items per page
  Scenario:
    Given I am on the home page
    When I set "perPage" to 4
    And Pages is ready
    Then I should see 4 items