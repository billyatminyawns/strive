// Contract check: compiles the app's own Models.swift + API.swift for macOS and exercises every endpoint the
// iOS app calls, decoding each response with the app's real types. Catches client/server drift without Xcode.
//
//   ./scripts/contract-check.sh            (defaults to http://127.0.0.1:8787/v1/ and $STRIVE_TEST_KEY_REVIEW)
import Foundation

struct CheckFailure: Error, CustomStringConvertible {
    let description: String
}

@main
struct ContractCheck {
    static var failures = 0

    static func check(_ name: String, _ body: () async throws -> Void) async {
        do {
            try await body()
            print("  ✓ \(name)")
        } catch {
            failures += 1
            print("  ✗ \(name): \(error)")
        }
    }

    static func expect(_ condition: Bool, _ message: String) throws {
        if !condition { throw CheckFailure(description: message) }
    }

    static func main() async {
        let env = ProcessInfo.processInfo.environment
        let base = URL(string: env["STRIVE_API_BASE"] ?? "http://127.0.0.1:8787/v1/")!
        let reviewKey = env["STRIVE_TEST_KEY_REVIEW"] ?? ""
        print("Strive contract check → \(base.absoluteString)")

        // MARK: Fan
        let fan = API(baseURL: base)
        var todayDrop: Drop?
        var instant: Question?

        await check("GET config") {
            let _: AppConfig = try await fan.get("config")
        }
        await check("POST auth/fan with a bad code → 404") {
            do {
                let _: AuthResponse = try await fan.post("auth/fan", ["code": "NOPE-NOPE"])
                throw CheckFailure(description: "bad code was accepted")
            } catch let error as APIError {
                try expect(error.status == 404, "expected 404, got \(error.status): \(error.message)")
            }
        }
        await check("POST auth/fan REVIEW") {
            let r: AuthResponse = try await fan.post("auth/fan", ["code": "REVIEW", "name": "Contract"])
            try expect(r.user.role == .fan, "role should be fan")
            try expect(r.athlete.id == "angela-review", "should land in the review sandbox, got \(r.athlete.id)")
            fan.token = r.token
        }
        await check("GET me") {
            let me: MeResponse = try await fan.get("me")
            try expect(me.user.name == "Contract", "name should round-trip")
        }
        await check("PATCH me") {
            let r: UserEnvelope = try await fan.patch("me", ["name": "Contract Two", "interests": ["Mindset", "Recovery"]])
            try expect(r.user.interests == ["Mindset", "Recovery"], "interests should round-trip")
        }
        await check("GET home (review sandbox is pre-approved)") {
            let h: HomeResponse = try await fan.get("home")
            try expect(h.today != nil, "today's drop missing")
            try expect(h.athlete.bio?.audioKey != nil, "approved bio with audio missing")
            try expect(!h.suggestions.isEmpty, "suggestions missing")
            try expect(h.today?.audioKey != nil, "today's drop has no audio")
            todayDrop = h.today
        }
        await check("GET drops") {
            let r: DropsResponse = try await fan.get("drops")
            try expect(r.drops.allSatisfy { $0.status == .published }, "fans must only see published drops")
        }
        await check("GET audio for today's drop") {
            guard let key = todayDrop?.audioKey else { throw CheckFailure(description: "no key") }
            let data = try await fan.audio(key)
            try expect(data.count > 8_000, "audio too small: \(data.count) bytes")
        }
        await check("POST drops/:id/listen is idempotent") {
            guard let id = todayDrop?.id else { throw CheckFailure(description: "no drop") }
            let a: ListenResponse = try await fan.post("drops/\(id)/listen")
            let b: ListenResponse = try await fan.post("drops/\(id)/listen")
            try expect(a.listens == b.listens, "second listen changed the count")
        }
        await check("POST questions → instant") {
            let r: QuestionEnvelope = try await fan.post("questions", ["text": "How do I handle pre-game nerves?"])
            try expect(r.question.status == .instant, "expected instant, got \(r.question.status)")
            try expect(r.question.audioKey != nil, "instant answer without audio")
            instant = r.question
        }
        await check("POST questions → guarded") {
            let r: QuestionEnvelope = try await fan.post("questions", ["text": "Should I bet on the game tonight?"])
            try expect(r.question.status == .guarded, "expected guarded, got \(r.question.status)")
        }
        await check("POST questions → no false instant for 'mediocre'") {
            let r: QuestionEnvelope = try await fan.post("questions", ["text": "How do I stop being mediocre in practice?"])
            try expect(r.question.status == .pending, "expected pending, got \(r.question.status)")
        }
        await check("POST questions/:id/save") {
            guard let q = instant else { throw CheckFailure(description: "no instant question") }
            let r: QuestionEnvelope = try await fan.post("questions/\(q.id)/save", ["saved": true])
            try expect(r.question.saved == true, "not saved")
        }
        await check("GET questions") {
            let r: QuestionsResponse = try await fan.get("questions")
            try expect(r.questions.count >= 3, "thread should have the questions just asked")
        }
        await check("GET notifications") {
            let _: NotificationsResponse = try await fan.get("notifications")
        }
        await check("fan hitting a studio route → 403") {
            do {
                let _: StudioToday = try await fan.get("studio/today")
                throw CheckFailure(description: "fan reached the studio")
            } catch let error as APIError {
                try expect(error.status == 403, "expected 403, got \(error.status)")
            }
        }

        // MARK: Athlete
        let athlete = API(baseURL: base)
        var starter: StudioQuestion?
        var draftDrop: Drop?

        await check("POST auth/athlete with a bad key → 401") {
            do {
                let _: AuthResponse = try await athlete.post("auth/athlete", ["key": "definitely-not-a-key"])
                throw CheckFailure(description: "bad key accepted")
            } catch let error as APIError {
                try expect(error.status == 401, "expected 401, got \(error.status)")
            }
        }
        if reviewKey.isEmpty {
            print("  – athlete checks skipped (STRIVE_TEST_KEY_REVIEW not set)")
        } else {
            await check("POST auth/athlete") {
                let r: AuthResponse = try await athlete.post("auth/athlete", ["key": reviewKey])
                try expect(r.user.role == .athlete, "role should be athlete")
                athlete.token = r.token
            }
            await check("GET studio/today") {
                let t: StudioToday = try await athlete.get("studio/today")
                try expect(t.stats.members >= 1, "the contract fan should count as a member")
                draftDrop = t.draftDrops.first
            }
            await check("GET studio/queue") {
                let q: StudioQueue = try await athlete.get("studio/queue")
                starter = q.questions.first { $0.isStarter && $0.hasDraft }
                try expect(starter != nil, "no starter question with a draft")
                try expect(q.questions.contains { $0.kind == "fan" && $0.text.contains("mediocre") }, "fan's pending question missing")
            }
            await check("GET studio/drops · settings · prompts · stories · bio") {
                let _: StudioDrops = try await athlete.get("studio/drops")
                let _: StudioSettings = try await athlete.get("studio/settings")
                let p: PromptsResponse = try await athlete.get("studio/prompts")
                try expect(!p.prompts.isEmpty && !p.coverage.isEmpty, "prompts/coverage empty")
                let _: StoriesResponse = try await athlete.get("studio/stories")
                let _: StudioBio = try await athlete.get("studio/bio")
            }
            await check("POST studio/preview (unedited starter text is pre-voiced)") {
                guard let text = starter?.draft else { throw CheckFailure(description: "no starter") }
                let r: RenderResponse = try await athlete.post("studio/preview", ["text": text])
                try expect(!r.audioKey.isEmpty, "no audio key")
            }
            await check("POST studio/questions/:id/approve (starter)") {
                guard let q = starter else { throw CheckFailure(description: "no starter") }
                let r: ApproveResponse = try await athlete.post("studio/questions/\(q.id)/approve", ["text": q.draft ?? ""])
                try expect(r.audioKey != nil, "approve returned no audio")
            }
            await check("POST studio/drops/:id/approve (queue)") {
                guard let d = draftDrop else { throw CheckFailure(description: "no drafted drop") }
                let r: DropEnvelope = try await athlete.post("studio/drops/\(d.id)/approve", ["publishNow": false])
                try expect(r.drop.status == .queued, "expected queued, got \(r.drop.status)")
            }
            await check("POST studio/drops (create draft from a capture)") {
                let r: DropEnvelope = try await athlete.post("studio/drops", ["title": "Contract drop", "script": "A captured thought."])
                try expect(r.drop.status == .draft, "expected draft")
                try await athlete.perform("POST", "studio/drops/\(r.drop.id)/reject")
            }
            await check("POST studio/stories + DELETE") {
                let r: StoryEnvelope = try await athlete.post("studio/stories", [
                    "promptId": "free", "title": "Contract story", "transcript": "A story for the contract check.",
                    "duration": 3.5, "audio": NSNull(),
                ])
                try await athlete.perform("DELETE", "studio/stories/\(r.story.id)")
            }
            await check("PATCH studio/settings pause → fan ask 409 → unpause") {
                let paused: StudioSettings = try await athlete.patch("studio/settings", ["paused": true])
                try expect(paused.paused, "not paused")
                do {
                    let _: QuestionEnvelope = try await fan.post("questions", ["text": "Are you there?"])
                    throw CheckFailure(description: "ask succeeded while paused")
                } catch let error as APIError {
                    try expect(error.status == 409, "expected 409, got \(error.status)")
                }
                let open: StudioSettings = try await athlete.patch("studio/settings", ["paused": false])
                try expect(!open.paused, "still paused")
            }
            await check("POST auth/signout (athlete)") {
                try await athlete.perform("POST", "auth/signout")
            }
        }

        // MARK: Cleanup
        await check("DELETE me (fan) → token dies") {
            try await fan.perform("DELETE", "me")
            do {
                let _: MeResponse = try await fan.get("me")
                throw CheckFailure(description: "token still works after deletion")
            } catch let error as APIError {
                try expect(error.status == 401, "expected 401, got \(error.status)")
            }
        }

        print(failures == 0 ? "CONTRACT OK" : "CONTRACT FAILED (\(failures))")
        exit(failures == 0 ? 0 : 1)
    }
}
