@feature_id:0328599c-e164-4b79-881f-c183bd2b8453
@epic_id:cacf4c1a-e245-4651-bd3e-c60661f9af53
Feature: Signature Workflow Engine
  Facilitate the signing process by allowing users to send documents for signatures.

  @scenario_id:7f8efc1b-1953-4af7-ab14-e9da0691a10a
  @scenario_type:UI
  @ui_test
  Scenario: User can upload documents for signature
    # Scenario ID: 7f8efc1b-1953-4af7-ab14-e9da0691a10a
    # Feature ID: 0328599c-e164-4b79-881f-c183bd2b8453
    # Scenario Type: UI
    # Description: Ensure that users can upload documents they want to be signed.
    Given the user is logged into the application
    When the user navigates to the signature workflow section
    Then the user is able to select and upload a document for signature
    # Priority: medium
    # Status: draft
    # Test Runner Info: feature_id=0328599c-e164-4b79-881f-c183bd2b8453, scenario_id=7f8efc1b-1953-4af7-ab14-e9da0691a10a, type=UI

  @scenario_id:c3397a9c-57ab-4daf-88a7-b72ff66729f4
  @scenario_type:UI
  @ui_test
  Scenario: User can send documents for signatures
    # Scenario ID: c3397a9c-57ab-4daf-88a7-b72ff66729f4
    # Feature ID: 0328599c-e164-4b79-881f-c183bd2b8453
    # Scenario Type: UI
    # Description: Verify that users can send uploaded documents to designated signers.
    Given the user has uploaded a document
    When the user selects a document to send for signature
    And the user enters the email address of the signer
    Then the document is successfully sent to the signer for signature
    # Priority: medium
    # Status: draft
    # Test Runner Info: feature_id=0328599c-e164-4b79-881f-c183bd2b8453, scenario_id=c3397a9c-57ab-4daf-88a7-b72ff66729f4, type=UI

  @scenario_id:104c212d-7cf6-41a0-9888-6efeea693d95
  @scenario_type:UI
  @ui_test
  Scenario: User receives notifications for document status
    # Scenario ID: 104c212d-7cf6-41a0-9888-6efeea693d95
    # Feature ID: 0328599c-e164-4b79-881f-c183bd2b8453
    # Scenario Type: UI
    # Description: Ensure that users receive notifications when their documents are signed or require further action.
    Given the user has sent a document for signature
    When the signer signs the document
    Then the user receives a notification about the document being signed
    # Priority: medium
    # Status: draft
    # Test Runner Info: feature_id=0328599c-e164-4b79-881f-c183bd2b8453, scenario_id=104c212d-7cf6-41a0-9888-6efeea693d95, type=UI

  @scenario_id:5610395d-b31d-459b-b993-be16b7a8e9db
  @scenario_type:UI
  @ui_test
  Scenario: User can track the status of sent documents
    # Scenario ID: 5610395d-b31d-459b-b993-be16b7a8e9db
    # Feature ID: 0328599c-e164-4b79-881f-c183bd2b8453
    # Scenario Type: UI
    # Description: Verify that users can view the status of their sent documents in the application.
    Given the user has sent documents for signature
    When the user navigates to the document status section
    Then the user can see the status of each sent document
    # Priority: medium
    # Status: draft
    # Test Runner Info: feature_id=0328599c-e164-4b79-881f-c183bd2b8453, scenario_id=5610395d-b31d-459b-b993-be16b7a8e9db, type=UI
