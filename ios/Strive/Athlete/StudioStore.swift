import SwiftUI
import Observation

enum StudioTab: Hashable {
    case today, approve, capture, studio
}

/// Everything the athlete studio shows and does. The server enforces that only approved content reaches fans.
@MainActor
@Observable
final class StudioStore {
    var tab: StudioTab = .today

    private(set) var today: StudioToday?
    private(set) var todayError: String?
    private(set) var queue: [StudioQuestion] = []
    private(set) var queueLoaded = false
    private(set) var drops: StudioDrops?
    private(set) var settings: StudioSettings?
    private(set) var prompts: [Prompt] = []
    private(set) var coverage: [Coverage] = []
    private(set) var stories: [Story] = []
    private(set) var bio: StudioBio?
    /// Text currently being rendered for a voice preview (drives spinners).
    private(set) var previewing: String?

    @ObservationIgnored private var api: API { AppState.shared.api }

    var queueCount: Int { queueLoaded ? queue.count : (today?.queueCount ?? 0) }

    // MARK: Loading

    func refreshToday() async {
        do {
            let response: StudioToday = try await api.get("studio/today")
            if response != today { today = response }
            todayError = nil
        } catch is CancellationError {
        } catch {
            if today == nil { todayError = APIError.message(error) }
        }
    }

    func loadQueue() async {
        guard let response: StudioQueue = try? await api.get("studio/queue") else { return }
        if response.questions != queue { queue = response.questions }
        queueLoaded = true
    }

    func loadDrops() async {
        guard let response: StudioDrops = try? await api.get("studio/drops") else { return }
        if response != drops { drops = response }
    }

    func loadSettings() async {
        if let response: StudioSettings = try? await api.get("studio/settings") { settings = response }
    }

    func loadPrompts() async {
        guard let response: PromptsResponse = try? await api.get("studio/prompts") else { return }
        prompts = response.prompts
        coverage = response.coverage
    }

    func loadStories() async {
        if let response: StoriesResponse = try? await api.get("studio/stories") { stories = response.stories }
    }

    func loadBio() async {
        if let response: StudioBio = try? await api.get("studio/bio") { bio = response }
    }

    func refreshAll() async {
        async let t: Void = refreshToday()
        async let q: Void = loadQueue()
        _ = await (t, q)
    }

    // MARK: Questions

    /// Approves (voice renders server-side, then the fan is notified). Returns a confirmation message.
    func approve(_ question: StudioQuestion, text: String) async throws -> String {
        do {
            let _: ApproveResponse = try await api.post("studio/questions/\(question.id)/approve", ["text": text.trimmed])
        } catch let error as APIError where error.status == 409 {
            // Handled from another device or screen — just drop it from this deck.
            queue.removeAll { $0.id == question.id }
            Task { await refreshToday() }
            return "Already handled — it went out from another screen."
        }
        queue.removeAll { $0.id == question.id }
        Task { await refreshToday() }
        if question.isStarter { return "Added to your instant answers ✓" }
        if let fan = question.fanName, !fan.isEmpty { return "Sent to \(fan) — in your voice ✓" }
        return "Sent — in your voice ✓"
    }

    func decline(_ question: StudioQuestion) async throws {
        do {
            try await api.perform("POST", "studio/questions/\(question.id)/decline")
        } catch let error as APIError where error.status == 409 || error.status == 404 {
            // Already gone — nothing left to decline.
        }
        queue.removeAll { $0.id == question.id }
        Task { await refreshToday() }
    }

    func revise(_ question: StudioQuestion, text: String, note: String) async throws -> String {
        let response: DraftResponse = try await api.post("studio/questions/\(question.id)/revise", ["text": text, "note": note])
        return response.draft
    }

    /// Renders text in the athlete's voice and plays it, without approving anything.
    func preview(text: String, id: String, title: String) async {
        let trimmed = text.trimmed
        guard !trimmed.isEmpty else { return }
        let audio = AudioEngine.shared
        let itemID = "preview:\(id):\(trimmed.hashValue)"
        if audio.isCurrent(itemID) {
            audio.isPlaying ? audio.pause() : audio.resume()
            return
        }
        previewing = trimmed
        defer { if previewing == trimmed { previewing = nil } }
        do {
            let rendered: RenderResponse = try await api.post("studio/preview", ["text": trimmed])
            await audio.play(PlayableAudio(id: itemID, title: title, subtitle: "Preview · not sent",
                                           source: .remote(key: rendered.audioKey), transcript: trimmed,
                                           durationHint: rendered.duration))
        } catch {
            ToastCenter.shared.show(previewError(error), style: .error)
        }
    }

    private func previewError(_ error: Error) -> String {
        if let apiError = error as? APIError, apiError.status == 503 {
            return "Voice previews for edited text aren't switched on yet."
        }
        return APIError.message(error)
    }

    // MARK: Drops

    func approveDrop(_ drop: Drop, title: String? = nil, script: String? = nil, publishNow: Bool = false) async throws -> Drop {
        var body: [String: Any] = ["publishNow": publishNow]
        if let title { body["title"] = title.trimmed }
        if let script { body["script"] = script.trimmed }
        do {
            let response: DropEnvelope = try await api.post("studio/drops/\(drop.id)/approve", body)
            await refreshToday()
            await loadDrops()
            return response.drop
        } catch let error as APIError where error.status == 409 {
            await refreshToday()
            await loadDrops()
            throw error
        }
    }

    func rejectDrop(_ drop: Drop) async throws {
        try await api.perform("POST", "studio/drops/\(drop.id)/reject")
        await refreshToday()
    }

    func setPinned(_ drop: Drop, _ pinned: Bool) async {
        do {
            let _: DropEnvelope = try await api.post("studio/drops/\(drop.id)/pin", ["pinned": pinned])
            await loadDrops()
            ToastCenter.shared.show(pinned ? "Pinned to your profile" : "Unpinned", style: .info)
        } catch {
            ToastCenter.shared.show(APIError.message(error), style: .error)
        }
    }

    func createDrop(title: String, script: String) async throws {
        let _: DropEnvelope = try await api.post("studio/drops", ["title": title.trimmed, "script": script.trimmed])
        await refreshToday()
    }

    // MARK: Bio

    func approveBio(text: String) async throws {
        let response: StudioBio = try await api.post("studio/bio", ["text": text.trimmed])
        bio = response
        await refreshToday()
        await AppState.shared.refreshAthleteProfile()
    }

    // MARK: Settings

    func update(_ changes: [String: Any]) async {
        let previous = settings
        if var optimistic = settings {
            if let v = changes["paused"] as? Bool { optimistic.paused = v }
            if let v = changes["guardTopics"] as? Bool { optimistic.guardTopics = v }
            if let v = changes["guardDecline"] as? Bool { optimistic.guardDecline = v }
            settings = optimistic
        }
        do {
            let response: StudioSettings = try await api.patch("studio/settings", changes)
            settings = response
        } catch {
            settings = previous
            ToastCenter.shared.show(APIError.message(error), style: .error)
        }
    }

    // MARK: Capture

    func pass(_ prompt: Prompt) async {
        prompts.removeAll { $0.id == prompt.id }
        try? await api.perform("POST", "studio/prompts/\(prompt.id)/pass")
        ToastCenter.shared.show("Noted — we won't ask you that again.", style: .info)
    }

    func saveStory(promptID: String, title: String, transcript: String, take: RecordedTake) async throws {
        let audio = (try? Data(contentsOf: take.url))?.base64EncodedString()
        var body: [String: Any] = [
            "promptId": promptID,
            "title": title,
            "transcript": transcript.trimmed,
            "duration": take.duration,
        ]
        body["audio"] = audio ?? NSNull()
        let response: StoryEnvelope = try await api.post("studio/stories", body)
        stories.insert(response.story, at: 0)
        await loadPrompts()
    }

    func deleteStory(_ story: Story) async {
        stories.removeAll { $0.id == story.id }
        try? await api.perform("DELETE", "studio/stories/\(story.id)")
    }
}

extension AppState {
    /// Re-reads the public athlete profile (e.g. after the athlete approves a new bio).
    func refreshAthleteProfile() async {
        if let me: MeResponse = try? await api.get("me") { updateAthlete(me.athlete) }
    }
}
