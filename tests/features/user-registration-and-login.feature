@feature_id:b81f3231-2e03-408a-b7b6-9346f9225714
@epic_id:cacf4c1a-e245-4651-bd3e-c60661f9af53
Feature: User Registration and Login
  Implement user registration and login functionality to manage user accounts securely.

  @scenario_id:a0514adb-94b0-4269-827b-920eea5ee605
  @scenario_type:UI
  @ui_test
  Scenario: User Registration with Valid Data
    # Scenario ID: a0514adb-94b0-4269-827b-920eea5ee605
    # Feature ID: b81f3231-2e03-408a-b7b6-9346f9225714
    # Scenario Type: UI
    # Description: Test the user registration process with valid input data.
    Given the user is on the registration page
    When the user enters valid registration details
    Then the user should be redirected to the welcome page
    And the user account should be created in the system
    # Priority: medium
    # Status: draft
    # Test Runner Info: feature_id=b81f3231-2e03-408a-b7b6-9346f9225714, scenario_id=a0514adb-94b0-4269-827b-920eea5ee605, type=UI

  @scenario_id:de527578-3a61-4097-91b8-c59981d607f8
  @scenario_type:UI
  @ui_test
  Scenario: User Registration with Invalid Email
    # Scenario ID: de527578-3a61-4097-91b8-c59981d607f8
    # Feature ID: b81f3231-2e03-408a-b7b6-9346f9225714
    # Scenario Type: UI
    # Description: Test the user registration process when the email format is invalid.
    Given the user is on the registration page
    When the user enters an invalid email address
    Then an error message should be displayed indicating the email is invalid
    # Priority: medium
    # Status: draft
    # Test Runner Info: feature_id=b81f3231-2e03-408a-b7b6-9346f9225714, scenario_id=de527578-3a61-4097-91b8-c59981d607f8, type=UI

  @scenario_id:3b58d2f2-ed34-4924-8e2f-0570b394ebcc
  @scenario_type:UI
  @ui_test
  Scenario: User Login with Valid Credentials
    # Scenario ID: 3b58d2f2-ed34-4924-8e2f-0570b394ebcc
    # Feature ID: b81f3231-2e03-408a-b7b6-9346f9225714
    # Scenario Type: UI
    # Description: Test the user login process with valid credentials.
    Given the user is on the login page
    When the user enters valid login credentials
    Then the user should be redirected to the dashboard
    And the user should see a welcome message
    # Priority: medium
    # Status: draft
    # Test Runner Info: feature_id=b81f3231-2e03-408a-b7b6-9346f9225714, scenario_id=3b58d2f2-ed34-4924-8e2f-0570b394ebcc, type=UI

  @scenario_id:8c35644b-e8cd-4a63-a51d-bab55dc9798e
  @scenario_type:UI
  @ui_test
  Scenario: User Login with Incorrect Password
    # Scenario ID: 8c35644b-e8cd-4a63-a51d-bab55dc9798e
    # Feature ID: b81f3231-2e03-408a-b7b6-9346f9225714
    # Scenario Type: UI
    # Description: Test the user login process with an incorrect password.
    Given the user is on the login page
    When the user enters a valid email and an incorrect password
    Then an error message should be displayed indicating the credentials are incorrect
    # Priority: medium
    # Status: draft
    # Test Runner Info: feature_id=b81f3231-2e03-408a-b7b6-9346f9225714, scenario_id=8c35644b-e8cd-4a63-a51d-bab55dc9798e, type=UI
