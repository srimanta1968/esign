@feature_id:7590f1ac-62e8-4087-9ad3-54d7671a4db1
@epic_id:cacf4c1a-e245-4651-bd3e-c60661f9af53
Feature: E-Signature Capabilities
  Allow users to sign documents electronically using various methods.

  @scenario_id:9b13ffe1-278e-4ff9-8207-8756235c17e7
  @scenario_type:UI
  @ui_test
  Scenario: User signs a document using a mouse click
    # Scenario ID: 9b13ffe1-278e-4ff9-8207-8756235c17e7
    # Feature ID: 7590f1ac-62e8-4087-9ad3-54d7671a4db1
    # Scenario Type: UI
    # Description: Test the mouse click method for signing a document electronically.
    Given User is on the document signing page
    When User clicks on the signature box
    Then The document displays the user's signature
    And The document is marked as signed
    And User can download the signed document
    # Priority: medium
    # Status: draft
    # Test Runner Info: feature_id=7590f1ac-62e8-4087-9ad3-54d7671a4db1, scenario_id=9b13ffe1-278e-4ff9-8207-8756235c17e7, type=UI

  @scenario_id:c6be1503-a59c-4814-85a5-67bae5809706
  @scenario_type:UI
  @ui_test
  Scenario: User signs a document using a touchscreen
    # Scenario ID: c6be1503-a59c-4814-85a5-67bae5809706
    # Feature ID: 7590f1ac-62e8-4087-9ad3-54d7671a4db1
    # Scenario Type: UI
    # Description: Test the touchscreen method for signing a document electronically on mobile devices.
    Given User opens the document on a mobile device
    When User taps on the signature box
    And User draws their signature on the screen
    Then The document displays the user's signature
    And The document is marked as signed
    And User can share the signed document via email
    # Priority: medium
    # Status: draft
    # Test Runner Info: feature_id=7590f1ac-62e8-4087-9ad3-54d7671a4db1, scenario_id=c6be1503-a59c-4814-85a5-67bae5809706, type=UI

  @scenario_id:895eedb2-28f1-4693-9f4e-da0dd160efc7
  @scenario_type:UI
  @ui_test
  Scenario: User signs a document using a stylus
    # Scenario ID: 895eedb2-28f1-4693-9f4e-da0dd160efc7
    # Feature ID: 7590f1ac-62e8-4087-9ad3-54d7671a4db1
    # Scenario Type: UI
    # Description: Test the stylus method for signing a document electronically on tablets.
    Given User accesses the document signing feature on a tablet
    When User selects the signature box
    And User uses the stylus to sign the document
    Then The document displays the user's signature
    And The document is marked as signed
    And User can print the signed document
    # Priority: medium
    # Status: draft
    # Test Runner Info: feature_id=7590f1ac-62e8-4087-9ad3-54d7671a4db1, scenario_id=895eedb2-28f1-4693-9f4e-da0dd160efc7, type=UI

  @scenario_id:0f6e8fa4-711b-4b45-af0a-f2482fd04cd9
  @scenario_type:UI
  @ui_test
  Scenario: User signs a document using a pre-saved signature
    # Scenario ID: 0f6e8fa4-711b-4b45-af0a-f2482fd04cd9
    # Feature ID: 7590f1ac-62e8-4087-9ad3-54d7671a4db1
    # Scenario Type: UI
    # Description: Test the functionality of using a pre-saved signature for signing documents.
    Given User is logged into their account
    And User has a pre-saved signature in their profile
    When User navigates to the document needing a signature
    And User selects the pre-saved signature
    Then The document displays the user's pre-saved signature
    And The document is marked as signed
    And User can access the signed document from their dashboard
    # Priority: medium
    # Status: draft
    # Test Runner Info: feature_id=7590f1ac-62e8-4087-9ad3-54d7671a4db1, scenario_id=0f6e8fa4-711b-4b45-af0a-f2482fd04cd9, type=UI
