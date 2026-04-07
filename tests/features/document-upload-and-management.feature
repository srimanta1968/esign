@feature_id:fcf20055-62ae-431a-b2a6-cbce3b2dad91
@epic_id:cacf4c1a-e245-4651-bd3e-c60661f9af53
Feature: Document Upload and Management
  Allow users to upload and manage documents within the application.

  @scenario_id:c951dc62-e37c-437f-9322-aa2a6ae786cb
  @scenario_type:UI
  @ui_test
  Scenario: Upload Document Successfully
    # Scenario ID: c951dc62-e37c-437f-9322-aa2a6ae786cb
    # Feature ID: fcf20055-62ae-431a-b2a6-cbce3b2dad91
    # Scenario Type: UI
    # Description: Ensure that users can successfully upload documents to the application.
    Given the user is logged into the application
    When the user navigates to the document upload section
    And the user selects a document to upload
    And the user clicks on the upload button
    Then the document should be uploaded successfully
    And the document should appear in the user's document list
    # Priority: medium
    # Status: draft
    # Test Runner Info: feature_id=fcf20055-62ae-431a-b2a6-cbce3b2dad91, scenario_id=c951dc62-e37c-437f-9322-aa2a6ae786cb, type=UI

  @scenario_id:7076f6d2-cc8b-4e61-9935-41dd091e4f86
  @scenario_type:UI
  @ui_test
  Scenario: Manage Uploaded Document
    # Scenario ID: 7076f6d2-cc8b-4e61-9935-41dd091e4f86
    # Feature ID: fcf20055-62ae-431a-b2a6-cbce3b2dad91
    # Scenario Type: UI
    # Description: Ensure that users can manage their uploaded documents effectively.
    Given the user has uploaded at least one document
    When the user navigates to the document management section
    And the user selects a document from the list
    And the user clicks on the delete button
    Then the document should be removed from the user's document list
    And the user should see a confirmation message
    # Priority: medium
    # Status: draft
    # Test Runner Info: feature_id=fcf20055-62ae-431a-b2a6-cbce3b2dad91, scenario_id=7076f6d2-cc8b-4e61-9935-41dd091e4f86, type=UI

  @scenario_id:3cea25fc-6f25-41e7-bfbb-1e102e31edb7
  @scenario_type:UI
  @ui_test
  Scenario: Invalid Document Upload Attempt
    # Scenario ID: 3cea25fc-6f25-41e7-bfbb-1e102e31edb7
    # Feature ID: fcf20055-62ae-431a-b2a6-cbce3b2dad91
    # Scenario Type: UI
    # Description: Ensure that the application handles invalid document uploads gracefully.
    Given the user is logged into the application
    When the user navigates to the document upload section
    And the user attempts to upload an unsupported file type
    And the user clicks on the upload button
    Then the application should display an error message
    And the document should not be uploaded
    # Priority: medium
    # Status: draft
    # Test Runner Info: feature_id=fcf20055-62ae-431a-b2a6-cbce3b2dad91, scenario_id=3cea25fc-6f25-41e7-bfbb-1e102e31edb7, type=UI

  @scenario_id:90c84b76-a835-46af-996d-8827db3ecb02
  @scenario_type:UI
  @ui_test
  Scenario: View Document Details
    # Scenario ID: 90c84b76-a835-46af-996d-8827db3ecb02
    # Feature ID: fcf20055-62ae-431a-b2a6-cbce3b2dad91
    # Scenario Type: UI
    # Description: Ensure that users can view the details of their uploaded documents.
    Given the user has uploaded at least one document
    When the user navigates to the document management section
    And the user clicks on a document to view its details
    Then the document details should be displayed
    And the user should see options to edit or delete the document
    # Priority: medium
    # Status: draft
    # Test Runner Info: feature_id=fcf20055-62ae-431a-b2a6-cbce3b2dad91, scenario_id=90c84b76-a835-46af-996d-8827db3ecb02, type=UI
