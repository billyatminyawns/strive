import SwiftUI
import Observation
import UserNotifications

enum FanTab: Hashable {
    case home, ask, library, you
}

/// Everything the fan app shows, loaded from the API. Only ever contains athlete-approved content.
@MainActor
@Observable
final class FanStore {
    var tab: FanTab = .home

    private(set) var home: HomeResponse?
    private(set) var homeError: String?
    private(set) var questions: [Question] = []
    private(set) var threadLoaded = false
    private(set) var paused = false
    private(set) var drops: [Drop] = []
    private(set) var dropsLoaded = false
    private(set) var notifications: [AppNotification] = []
    private(set) var unread = 0

    @ObservationIgnored private var api: API { AppState.shared.api }

    init() {
        AudioEngine.shared.onListenCredit = { [weak self] dropID in
            self?.creditListen(dropID)
        }
        home = DiskCache.load(HomeResponse.self, from: "home")
        if let cached = DiskCache.load(QuestionsResponse.self, from: "questions") {
            questions = cached.questions
            paused = cached.paused
        }
        if let cached = DiskCache.load(DropsResponse.self, from: "drops") {
            drops = cached.drops
            dropsLoaded = true
        }
    }

    var athlete: Athlete? { home?.athlete ?? AppState.shared.athlete }

    var savedReplies: [Question] {
        questions.filter { $0.saved == true && $0.hasVoiceReply }.reversed()
    }

    /// Suggested questions that this fan hasn't already asked.
    var suggestions: [String] {
        let asked = Set(questions.map { $0.text.lowercased() })
        return (home?.suggestions ?? []).filter { !asked.contains($0.lowercased()) }
    }

    // MARK: Loading

    func loadHome() async {
        do {
            let response: HomeResponse = try await api.get("home")
            if response != home {
                home = response
                DiskCache.save(response, as: "home")
            }
            unread = response.unread
            homeError = nil
            AppState.shared.updateAthlete(response.athlete)
        } catch is CancellationError {
        } catch {
            if home == nil { homeError = APIError.message(error) }
        }
    }

    func loadQuestions() async {
        guard let response: QuestionsResponse = try? await api.get("questions") else { return }
        if response.questions != questions { questions = response.questions }
        paused = response.paused
        threadLoaded = true
        DiskCache.save(response, as: "questions")
    }

    func loadDrops() async {
        guard let response: DropsResponse = try? await api.get("drops") else { return }
        if response.drops != drops { drops = response.drops }
        dropsLoaded = true
        DiskCache.save(response, as: "drops")
    }

    func loadNotifications() async {
        guard let response: NotificationsResponse = try? await api.get("notifications") else { return }
        notifications = response.notifications
        unread = response.unread
    }

    func markNotificationsRead() async {
        guard unread > 0 || notifications.contains(where: { !$0.read }) else { return }
        try? await api.perform("POST", "notifications/read")
        unread = 0
        for index in notifications.indices { notifications[index].read = true }
        try? await UNUserNotificationCenterBadge.clear()
    }

    func refreshAll() async {
        async let home: Void = loadHome()
        async let thread: Void = loadQuestions()
        _ = await (home, thread)
    }

    // MARK: Actions

    func ask(_ text: String) async throws {
        let response: QuestionEnvelope = try await api.post("questions", ["text": text])
        questions.append(response.question)
    }

    func setSaved(_ question: Question, _ saved: Bool) async {
        guard let index = questions.firstIndex(where: { $0.id == question.id }) else { return }
        questions[index].saved = saved
        do {
            let response: QuestionEnvelope = try await api.post("questions/\(question.id)/save", ["saved": saved])
            if let i = questions.firstIndex(where: { $0.id == question.id }) { questions[i] = response.question }
            ToastCenter.shared.show(saved ? "Saved to your Library" : "Removed from your Library", style: .info)
        } catch {
            if let i = questions.firstIndex(where: { $0.id == question.id }) { questions[i].saved = !saved }
            ToastCenter.shared.show(APIError.message(error), style: .error)
        }
    }

    private func creditListen(_ dropID: String) {
        markListened(dropID)
        Task { try? await api.perform("POST", "drops/\(dropID)/listen") }
    }

    private func markListened(_ dropID: String) {
        func mark(_ drops: inout [Drop]) {
            for index in drops.indices where drops[index].id == dropID { drops[index].listened = true }
        }
        mark(&drops)
        guard let current = home else { return }
        var picks = current.picks
        var suggested = current.suggested
        var today = current.today
        mark(&picks)
        mark(&suggested)
        if today?.id == dropID { today?.listened = true }
        home = HomeResponse(athlete: current.athlete, today: today, picks: picks, suggested: suggested,
                            suggestions: current.suggestions, unread: current.unread)
    }
}

enum UNUserNotificationCenterBadge {
    static func clear() async throws {
        try await UNUserNotificationCenter.current().setBadgeCount(0)
    }
}
