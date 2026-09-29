import Foundation

// Wire types for API v1 (see docs/API-v1.md). Enums decode leniently so a new server value never breaks the app.

protocol LenientEnum: RawRepresentable, Codable where RawValue == String {
    static var unknown: Self { get }
}

extension LenientEnum {
    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = Self(rawValue: raw) ?? .unknown
    }
}

struct Athlete: Codable, Identifiable, Equatable {
    struct Bio: Codable, Equatable {
        let text: String
        let audioKey: String?
        let duration: Double?
    }

    let id: String
    let name: String
    let firstName: String
    let coachName: String?
    let headline: String?
    let sport: String?
    let photoURL: URL?
    let heroURL: URL?
    let badges: [String]?
    let bio: Bio?
    let paused: Bool?

    var coach: String { coachName ?? "Coach \(firstName)" }
}

struct User: Codable, Identifiable, Equatable {
    enum Role: String, LenientEnum {
        case fan, athlete, unknown
    }

    let id: String
    let role: Role
    var name: String?
    var interests: [String]?
    let athleteId: String
    let createdAt: Int64?
}

struct Drop: Codable, Identifiable, Equatable, Hashable {
    enum Status: String, LenientEnum {
        case draft, queued, published, rejected, unknown
    }

    let id: String
    var title: String
    var script: String
    var status: Status
    var source: String?
    var audioKey: String?
    var duration: Double?
    var publishedAt: Int64?
    var queuePos: Int?
    var listens: Int?
    var pinned: Bool?
    var listened: Bool?
}

struct Question: Codable, Identifiable, Equatable {
    enum Status: String, LenientEnum {
        case pending, answered, instant, guarded, declined, unknown
    }

    let id: String
    let text: String
    var status: Status
    var answer: String?
    var audioKey: String?
    var duration: Double?
    var note: String?
    let createdAt: Int64
    var answeredAt: Int64?
    var saved: Bool?

    var hasVoiceReply: Bool { (status == .answered || status == .instant) && audioKey != nil }
}

struct StudioQuestion: Codable, Identifiable, Equatable {
    let id: String
    let text: String
    let fanName: String?
    let kind: String
    var draft: String?
    let draftSource: String?
    var drafting: Bool?
    let createdAt: Int64

    var isStarter: Bool { kind == "starter" }
    var hasDraft: Bool { !(draft ?? "").trimmed.isEmpty }
}

struct AppNotification: Codable, Identifiable, Equatable {
    let id: String
    let text: String
    let sub: String?
    let link: String?
    let createdAt: Int64
    var read: Bool
}

struct AppConfig: Codable, Equatable {
    let drafting: Bool
    let voice: Bool
    let push: Bool
    let minBuild: Int?

    static let fallback = AppConfig(drafting: false, voice: true, push: false, minBuild: nil)
}

struct Prompt: Codable, Identifiable, Hashable {
    let id: String
    let title: String
    let src: String?
    let hint: String?
}

struct Coverage: Codable, Identifiable, Equatable {
    let bucket: String
    let pct: Double
    var id: String { bucket }
}

struct Story: Codable, Identifiable, Equatable {
    let id: String
    let promptId: String?
    let title: String
    let transcript: String?
    let duration: Double?
    let createdAt: Int64
}

struct StudioStats: Codable, Equatable {
    let members: Int
    let membersWeek: Int
    let answeredPct: Double?
    let medianReplyHours: Double?
    let listensWeek: Int
    let published: Int
}

struct StudioSettings: Codable, Equatable {
    var paused: Bool
    var guardTopics: Bool
    var guardDecline: Bool
}

struct StudioBio: Codable, Equatable {
    let text: String
    let status: String
    let audioKey: String?
    let duration: Double?

    var isApproved: Bool { status == "approved" }
}

// MARK: - Envelopes

struct AuthResponse: Decodable { let token: String; let user: User; let athlete: Athlete }
struct MeResponse: Decodable { let user: User; let athlete: Athlete }
struct UserEnvelope: Decodable { let user: User }
struct HomeResponse: Codable, Equatable {
    let athlete: Athlete
    let today: Drop?
    let picks: [Drop]
    let suggested: [Drop]
    let suggestions: [String]
    let unread: Int
}
struct DropsResponse: Codable { let drops: [Drop] }
struct DropEnvelope: Decodable { let drop: Drop }
struct ListenResponse: Decodable { let listens: Int }
struct QuestionsResponse: Codable { let questions: [Question]; let paused: Bool }
struct QuestionEnvelope: Decodable { let question: Question }
struct NotificationsResponse: Decodable { let notifications: [AppNotification]; let unread: Int }
struct StudioToday: Decodable, Equatable {
    let queueCount: Int
    let stats: StudioStats
    let draftDrops: [Drop]
    let queued: [Drop]
    let nextPublishAt: Int64?
    let bioStatus: String?
}
struct StudioQueue: Decodable { let questions: [StudioQuestion] }
struct StudioDrops: Decodable, Equatable { let drafts: [Drop]; let queued: [Drop]; let published: [Drop] }
struct ApproveResponse: Decodable { let ok: Bool?; let audioKey: String?; let duration: Double? }
struct DraftResponse: Decodable { let draft: String }
struct RenderResponse: Decodable { let audioKey: String; let duration: Double? }
struct PromptsResponse: Decodable { let prompts: [Prompt]; let coverage: [Coverage] }
struct StoriesResponse: Decodable { let stories: [Story] }
struct StoryEnvelope: Decodable { let story: Story }
struct OKResponse: Decodable { let ok: Bool? }
