import AVFoundation
import MediaPlayer
import Observation
import SwiftUI

/// Something the player can play: a server clip (drop, reply, bio, preview) or a local take.
struct PlayableAudio: Equatable {
    enum Source: Equatable {
        case remote(key: String)
        case local(URL)
    }

    let id: String
    let title: String
    let subtitle: String
    let source: Source
    var transcript: String?
    var durationHint: Double?
    /// Set for published drops: the fan earns a listen once they hear most of it.
    var listenDropID: String?
}

extension PlayableAudio {
    static func drop(_ drop: Drop, athlete: Athlete?) -> PlayableAudio? {
        guard let key = drop.audioKey else { return nil }
        return PlayableAudio(id: "drop:\(drop.id)", title: drop.title, subtitle: athlete?.name ?? "Strive",
                             source: .remote(key: key), transcript: drop.script, durationHint: drop.duration,
                             listenDropID: drop.status == .published ? drop.id : nil)
    }

    static func reply(_ question: Question, athlete: Athlete?) -> PlayableAudio? {
        guard let key = question.audioKey else { return nil }
        return PlayableAudio(id: "reply:\(question.id)", title: question.text,
                             subtitle: "\(athlete?.firstName ?? "Angela")'s reply",
                             source: .remote(key: key), transcript: question.answer, durationHint: question.duration)
    }

    static func bio(_ bio: Athlete.Bio, athlete: Athlete) -> PlayableAudio? {
        guard let key = bio.audioKey else { return nil }
        return PlayableAudio(id: "bio:\(athlete.id)", title: "Who is \(athlete.firstName)", subtitle: "In her own voice",
                             source: .remote(key: key), transcript: bio.text, durationHint: bio.duration)
    }
}

/// On-disk cache for downloaded clips (Caches/audio). Keys are content hashes, so a cached file never goes stale.
enum AudioCache {
    static var directory: URL {
        let dir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("audio", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    static func url(for key: String) -> URL {
        let safe = key.filter { $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" }
        return directory.appendingPathComponent(safe + ".mp3")
    }

    static func clear() {
        try? FileManager.default.removeItem(at: directory)
    }
}

@MainActor
@Observable
final class AudioEngine {
    static let shared = AudioEngine()

    private(set) var current: PlayableAudio?
    private(set) var isPlaying = false
    private(set) var isLoading = false
    private(set) var currentTime: TimeInterval = 0
    private(set) var duration: TimeInterval = 0

    /// Called once per drop when a fan has heard at least 60% of it.
    @ObservationIgnored var onListenCredit: ((String) -> Void)?

    @ObservationIgnored private var player: AVAudioPlayer?
    @ObservationIgnored private var ticker: Timer?
    @ObservationIgnored private let delegateProxy = PlayerDelegate()
    @ObservationIgnored private var loadToken = UUID()
    @ObservationIgnored private var credited: Set<String> = []

    private init() {
        delegateProxy.onFinish = { [weak self] in
            Task { @MainActor in self?.didFinish() }
        }
        configureRemoteCommands()
        NotificationCenter.default.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] note in
            let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt
            guard raw == AVAudioSession.InterruptionType.began.rawValue else { return }
            Task { @MainActor in self?.pause() }
        }
    }

    // MARK: Queries

    func isCurrent(_ id: String) -> Bool { current?.id == id }
    func isPlaying(_ id: String) -> Bool { current?.id == id && isPlaying }
    func isLoading(_ id: String) -> Bool { current?.id == id && isLoading }

    func progress(_ id: String) -> Double {
        guard current?.id == id, duration > 0 else { return 0 }
        return min(1, currentTime / duration)
    }

    // MARK: Control

    func toggle(_ item: PlayableAudio) {
        if current?.id == item.id, player != nil {
            isPlaying ? pause() : resume()
        } else if current?.id == item.id, isLoading {
            return
        } else {
            Task { await play(item) }
        }
    }

    func play(_ item: PlayableAudio) async {
        stopPlayer()
        current = item
        isLoading = true
        currentTime = 0
        duration = item.durationHint ?? 0
        let token = UUID()
        loadToken = token

        do {
            let url = try await fileURL(for: item.source)
            guard loadToken == token else { return }
            try activatePlaybackSession()
            let newPlayer = try AVAudioPlayer(contentsOf: url)
            newPlayer.delegate = delegateProxy
            newPlayer.prepareToPlay()
            player = newPlayer
            duration = newPlayer.duration
            isLoading = false
            newPlayer.play()
            isPlaying = true
            startTicker()
            updateNowPlaying()
        } catch is CancellationError {
            guard loadToken == token else { return }
            reset()
        } catch {
            guard loadToken == token else { return }
            reset()
            ToastCenter.shared.show(APIError.message(error) == APIError.offline.message
                                    ? "Couldn't load that clip — you look offline."
                                    : "Couldn't play that clip. Try again.", style: .error)
        }
    }

    func pause() {
        player?.pause()
        isPlaying = false
        stopTicker()
        updateNowPlaying()
    }

    func resume() {
        guard let player else { return }
        try? activatePlaybackSession()
        player.play()
        isPlaying = true
        startTicker()
        updateNowPlaying()
    }

    func stop() {
        loadToken = UUID()
        reset()
    }

    func seek(to time: TimeInterval) {
        guard let player else { return }
        player.currentTime = max(0, min(time, player.duration))
        currentTime = player.currentTime
        updateNowPlaying()
    }

    func skip(_ delta: TimeInterval) { seek(to: currentTime + delta) }

    // MARK: Internals

    private func reset() {
        stopPlayer()
        current = nil
        isPlaying = false
        isLoading = false
        currentTime = 0
        duration = 0
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
    }

    private func stopPlayer() {
        stopTicker()
        player?.stop()
        player = nil
    }

    private func fileURL(for source: PlayableAudio.Source) async throws -> URL {
        switch source {
        case .local(let url):
            return url
        case .remote(let key):
            let destination = AudioCache.url(for: key)
            if FileManager.default.fileExists(atPath: destination.path) { return destination }
            let data = try await AppState.shared.api.audio(key)
            try data.write(to: destination, options: .atomic)
            return destination
        }
    }

    private func activatePlaybackSession() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playback, mode: .spokenAudio)
        try session.setActive(true)
    }

    private func startTicker() {
        stopTicker()
        let timer = Timer(timeInterval: 0.25, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.tick() }
        }
        RunLoop.main.add(timer, forMode: .common)
        ticker = timer
    }

    private func stopTicker() {
        ticker?.invalidate()
        ticker = nil
    }

    private func tick() {
        guard let player else { return }
        currentTime = player.currentTime
        creditListenIfEarned()
    }

    private func didFinish() {
        currentTime = duration
        creditListenIfEarned(force: true)
        isPlaying = false
        stopTicker()
        player?.currentTime = 0
        updateNowPlaying()
    }

    private func creditListenIfEarned(force: Bool = false) {
        guard let dropID = current?.listenDropID, !credited.contains(dropID) else { return }
        guard force || (duration > 0 && currentTime / duration >= 0.6) else { return }
        credited.insert(dropID)
        onListenCredit?(dropID)
    }

    private func updateNowPlaying() {
        guard let current else {
            MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
            return
        }
        var info: [String: Any] = [
            MPMediaItemPropertyTitle: current.title,
            MPMediaItemPropertyArtist: current.subtitle,
            MPMediaItemPropertyAlbumTitle: "Strive",
            MPMediaItemPropertyPlaybackDuration: duration,
            MPNowPlayingInfoPropertyElapsedPlaybackTime: currentTime,
            MPNowPlayingInfoPropertyPlaybackRate: isPlaying ? 1.0 : 0.0,
        ]
        #if canImport(UIKit)
        if let image = UIImage(named: "AngelaHead") {
            info[MPMediaItemPropertyArtwork] = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
        }
        #endif
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    }

    private func configureRemoteCommands() {
        let center = MPRemoteCommandCenter.shared()
        center.playCommand.addTarget { [weak self] _ in
            Task { @MainActor in self?.resume() }
            return .success
        }
        center.pauseCommand.addTarget { [weak self] _ in
            Task { @MainActor in self?.pause() }
            return .success
        }
        center.togglePlayPauseCommand.addTarget { [weak self] _ in
            Task { @MainActor in
                guard let self else { return }
                self.isPlaying ? self.pause() : self.resume()
            }
            return .success
        }
        center.skipForwardCommand.preferredIntervals = [15]
        center.skipForwardCommand.addTarget { [weak self] _ in
            Task { @MainActor in self?.skip(15) }
            return .success
        }
        center.skipBackwardCommand.preferredIntervals = [15]
        center.skipBackwardCommand.addTarget { [weak self] _ in
            Task { @MainActor in self?.skip(-15) }
            return .success
        }
        center.changePlaybackPositionCommand.addTarget { [weak self] event in
            guard let event = event as? MPChangePlaybackPositionCommandEvent else { return .commandFailed }
            let position = event.positionTime
            Task { @MainActor in self?.seek(to: position) }
            return .success
        }
    }
}

private final class PlayerDelegate: NSObject, AVAudioPlayerDelegate {
    var onFinish: (() -> Void)?

    func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        onFinish?()
    }
}
