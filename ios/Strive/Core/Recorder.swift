import AVFoundation
import Observation
import Speech

struct RecordedTake: Equatable {
    let url: URL
    let duration: TimeInterval
}

/// Hold-to-talk recorder used by Capture and by voice notes in the reply editor.
@MainActor
@Observable
final class Recorder {
    enum RecorderError: LocalizedError {
        case couldNotStart
        var errorDescription: String? { "Couldn't start recording. Try again." }
    }

    private(set) var isRecording = false
    private(set) var elapsed: TimeInterval = 0
    /// 0…1, smoothed input level for the orb animation.
    private(set) var level: Double = 0

    @ObservationIgnored private var recorder: AVAudioRecorder?
    @ObservationIgnored private var timer: Timer?
    @ObservationIgnored private var startedAt = Date()

    static var permissionDenied: Bool {
        AVAudioApplication.shared.recordPermission == .denied
    }

    static func requestPermission() async -> Bool {
        switch AVAudioApplication.shared.recordPermission {
        case .granted: return true
        case .denied: return false
        default: return await AVAudioApplication.requestRecordPermission()
        }
    }

    func start() throws {
        guard !isRecording else { return }
        AudioEngine.shared.stop()
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker])
        try session.setActive(true)

        let url = FileManager.default.temporaryDirectory.appendingPathComponent("take-\(UUID().uuidString).m4a")
        let settings: [String: Any] = [
            AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
            AVSampleRateKey: 44_100,
            AVNumberOfChannelsKey: 1,
            AVEncoderBitRateKey: 64_000,
            AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue,
        ]
        let newRecorder = try AVAudioRecorder(url: url, settings: settings)
        newRecorder.isMeteringEnabled = true
        guard newRecorder.record() else { throw RecorderError.couldNotStart }

        recorder = newRecorder
        startedAt = Date()
        elapsed = 0
        level = 0
        isRecording = true
        let timer = Timer(timeInterval: 0.08, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.tick() }
        }
        RunLoop.main.add(timer, forMode: .common)
        self.timer = timer
    }

    /// Stops and returns the take (nil if nothing usable was captured).
    @discardableResult
    func stop() -> RecordedTake? {
        guard let recorder, isRecording else { return nil }
        let duration = recorder.currentTime
        recorder.stop()
        finish()
        guard duration >= 0.6 else {
            try? FileManager.default.removeItem(at: recorder.url)
            return nil
        }
        return RecordedTake(url: recorder.url, duration: duration)
    }

    func cancel() {
        guard let recorder else { return }
        recorder.stop()
        try? FileManager.default.removeItem(at: recorder.url)
        finish()
    }

    private func finish() {
        timer?.invalidate()
        timer = nil
        recorder = nil
        isRecording = false
        level = 0
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    private func tick() {
        guard let recorder else { return }
        elapsed = Date().timeIntervalSince(startedAt)
        recorder.updateMeters()
        let power = Double(recorder.averagePower(forChannel: 0)) // -160…0 dB
        let normalized = max(0, min(1, (power + 50) / 50))
        level = level * 0.6 + normalized * 0.4
    }
}

/// On-device (when available) speech-to-text for captured takes and voice notes.
enum Transcriber {
    enum TranscribeError: LocalizedError {
        case notAllowed, unavailable, empty
        var errorDescription: String? {
            switch self {
            case .notAllowed: return "Speech recognition is off for Strive. You can type instead, or enable it in Settings."
            case .unavailable: return "Transcription isn't available right now. You can type instead."
            case .empty: return "We couldn't make out any words. Try again a little closer to the mic."
            }
        }
    }

    static func authorize() async -> Bool {
        if SFSpeechRecognizer.authorizationStatus() == .authorized { return true }
        return await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { status in
                continuation.resume(returning: status == .authorized)
            }
        }
    }

    static func transcribe(_ url: URL) async throws -> String {
        guard await authorize() else { throw TranscribeError.notAllowed }
        guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US")), recognizer.isAvailable else {
            throw TranscribeError.unavailable
        }
        let request = SFSpeechURLRecognitionRequest(url: url)
        request.shouldReportPartialResults = false
        request.addsPunctuation = true
        if recognizer.supportsOnDeviceRecognition { request.requiresOnDeviceRecognition = true }

        let text: String = try await withCheckedThrowingContinuation { continuation in
            let once = Once()
            recognizer.recognitionTask(with: request) { result, error in
                if let error {
                    if once.claim() { continuation.resume(throwing: error) }
                    return
                }
                if let result, result.isFinal, once.claim() {
                    continuation.resume(returning: result.bestTranscription.formattedString)
                }
            }
        }
        let trimmed = text.trimmed
        guard !trimmed.isEmpty else { throw TranscribeError.empty }
        return trimmed
    }

    private final class Once: @unchecked Sendable {
        private var done = false
        private let lock = NSLock()

        func claim() -> Bool {
            lock.lock()
            defer { lock.unlock() }
            if done { return false }
            done = true
            return true
        }
    }
}
