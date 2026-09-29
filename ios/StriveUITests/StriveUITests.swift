import XCTest

/// End-to-end tour of both apps against a running API (a hermetic local worker in CI).
/// Every step leaves a named screenshot — they double as App Store screenshots.
///
/// Environment (pass with the TEST_RUNNER_ prefix through xcodebuild):
///   STRIVE_API_BASE          API base URL, e.g. http://127.0.0.1:8787/v1/  (defaults to production)
///   STRIVE_TEST_KEY_REVIEW   studio key for the `angela-review` sandbox (athlete tour is skipped without it)
final class StriveTourTests: XCTestCase {
    private var app: XCUIApplication!

    override func setUp() {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments = ["-uiTesting"]
        if let base = env("STRIVE_API_BASE") { app.launchEnvironment["STRIVE_API_BASE"] = base }
        app.launch()
    }

    // MARK: Fan

    func test1_FanTour() {
        let code = app.textFields["inviteCode"]
        XCTAssertTrue(code.waitForExistence(timeout: 20), "welcome screen")
        snap("01-welcome")

        code.tap()
        code.typeText("NOPE")
        app.buttons["unlock"].tap()
        XCTAssertTrue(app.staticTexts["inviteError"].waitForExistence(timeout: 15), "bad code is rejected")
        clear(code)
        code.typeText("REVIEW")
        app.buttons["unlock"].tap()

        XCTAssertTrue(app.staticTexts["interestsTitle"].waitForExistence(timeout: 20), "interests step")
        let name = app.textFields["nameField"]
        name.tap()
        name.typeText("Jordan\n")
        app.buttons["chip-Recovery"].tap()
        snap("02-interests")
        app.buttons["enterApp"].tap()

        XCTAssertTrue(app.staticTexts["todayDropTitle"].waitForExistence(timeout: 25), "today's drop on home")
        snap("03-home")
        app.buttons["playToday"].tap()
        XCTAssertTrue(el("miniPlayer").waitForExistence(timeout: 15),
                      "mini player appears while a drop plays")
        sleep(2)
        snap("04-home-playing")
        app.swipeUp()
        sleep(1)
        snap("05-home-more")

        app.tabBars.buttons["Ask"].tap()
        let field = el("askField")
        XCTAssertTrue(field.waitForExistence(timeout: 15), "ask composer")
        field.tap()
        field.typeText("How do I handle pre-game nerves?")
        app.buttons["askSend"].tap()
        dismissSystemAlertIfNeeded()
        XCTAssertTrue(el("voiceReply").waitForExistence(timeout: 20),
                      "an approved answer comes back instantly")
        snap("06-ask-instant")

        field.tap()
        field.typeText("Should I bet on the game tonight?")
        app.buttons["askSend"].tap()
        XCTAssertTrue(el("guardNote").waitForExistence(timeout: 20),
                      "sensitive topics get a polite pass")

        field.tap()
        field.typeText("What's the best advice a teammate ever gave you?")
        app.buttons["askSend"].tap()
        XCTAssertTrue(el("pendingNote").waitForExistence(timeout: 20),
                      "new questions wait for the athlete")
        app.swipeDown()
        snap("07-ask-thread")

        app.tabBars.buttons["Library"].tap()
        sleep(2)
        snap("08-library")

        app.tabBars.buttons["You"].tap()
        let delete = app.buttons["deleteAccount"]
        XCTAssertTrue(delete.waitForExistence(timeout: 10))
        snap("09-you")
        app.swipeUp()
        delete.tap()
        let confirm = app.buttons.matching(NSPredicate(format: "label == 'Delete account' AND identifier != 'deleteAccount'")).firstMatch
        XCTAssertTrue(confirm.waitForExistence(timeout: 10), "delete confirmation")
        confirm.tap()
        XCTAssertTrue(app.textFields["inviteCode"].waitForExistence(timeout: 20), "account deletion signs out")
    }

    // MARK: Athlete

    func test2_AthleteTour() throws {
        guard let key = env("STRIVE_TEST_KEY_REVIEW") else {
            throw XCTSkip("STRIVE_TEST_KEY_REVIEW not set")
        }
        XCTAssertTrue(app.buttons["athleteSignIn"].waitForExistence(timeout: 20))
        app.buttons["athleteSignIn"].tap()
        let keyField = app.secureTextFields["studioKey"]
        XCTAssertTrue(keyField.waitForExistence(timeout: 10))
        keyField.tap()
        keyField.typeText(key)
        app.buttons["studioSignIn"].tap()
        dismissSystemAlertIfNeeded()

        XCTAssertTrue(el("statsGrid").waitForExistence(timeout: 25), "studio today")
        dismissSystemAlertIfNeeded()
        snap("20-studio-today")
        app.swipeUp()
        sleep(1)
        snap("21-studio-drafted")

        app.tabBars.buttons["Approve"].tap()
        XCTAssertTrue(app.staticTexts["cardQuestion"].firstMatch.waitForExistence(timeout: 20), "approval deck")
        snap("22-approve-deck")

        app.buttons["editButton"].tap()
        XCTAssertTrue(el("replyEditor").waitForExistence(timeout: 10), "in-app editor")
        snap("23-edit-reply")
        app.buttons["Cancel"].tap()

        // Starter drafts are pre-voiced, so approving one works even without a TTS key.
        app.buttons["approveButton"].tap()
        XCTAssertTrue(el("toast").waitForExistence(timeout: 30),
                      "approval confirmed")
        snap("24-approved")

        app.tabBars.buttons["Capture"].tap()
        XCTAssertTrue(el("holdToTalk").waitForExistence(timeout: 10), "capture orb")
        sleep(1)
        snap("25-capture")

        app.tabBars.buttons["Studio"].tap()
        sleep(2)
        snap("26-studio-settings")
        app.swipeUp()
        let signOut = app.buttons["signOut"]
        XCTAssertTrue(signOut.waitForExistence(timeout: 10))
        signOut.tap()
        let confirm = app.buttons.matching(NSPredicate(format: "label == 'Sign out' AND identifier != 'signOut'")).firstMatch
        XCTAssertTrue(confirm.waitForExistence(timeout: 10))
        confirm.tap()
        XCTAssertTrue(app.textFields["inviteCode"].waitForExistence(timeout: 20), "signed out")
    }

    // MARK: Helpers

    /// Finds an element by accessibility identifier regardless of its type (container, text view, button…).
    private func el(_ id: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: id).firstMatch
    }

    private func env(_ key: String) -> String? {
        let value = ProcessInfo.processInfo.environment[key]
        return (value?.isEmpty ?? true) ? nil : value
    }

    private func snap(_ name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    private func clear(_ field: XCUIElement) {
        field.tap()
        if let value = field.value as? String, !value.isEmpty {
            field.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: value.count))
        }
    }

    /// Notification / microphone permission prompts belong to SpringBoard; accept them so the tour continues.
    private func dismissSystemAlertIfNeeded() {
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        for label in ["Allow", "OK", "Allow While Using App"] {
            let button = springboard.buttons[label]
            if button.waitForExistence(timeout: 2) {
                button.tap()
                return
            }
        }
    }
}
