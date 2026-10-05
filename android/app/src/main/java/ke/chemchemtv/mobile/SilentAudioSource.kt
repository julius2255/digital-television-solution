package ke.chemchemtv.mobile

import com.pedro.encoder.Frame
import com.pedro.encoder.input.audio.GetMicrophoneData
import com.pedro.encoder.input.sources.audio.AudioSource

/** Silent AAC track so Facebook receives a normal audio track without microphone access. */
class SilentAudioSource : AudioSource() {
  private var running = false
  private var worker: Thread? = null

  override fun create(sampleRate: Int, isStereo: Boolean, echoCanceler: Boolean, noiseSuppressor: Boolean): Boolean {
    return true
  }

  override fun start(getMicrophoneData: GetMicrophoneData) {
    if (running) return
    this.getMicrophoneData = getMicrophoneData
    running = true
    worker = Thread {
      val bytesPerSecond = sampleRate * if (isStereo) 4 else 2
      val chunk = ByteArray(4096)
      val intervalMs = (chunk.size * 1000L / bytesPerSecond).coerceAtLeast(10L)
      while (running) {
        val callback = this.getMicrophoneData
        if (callback != null) {
          callback.inputPCMData(Frame(chunk, 0, chunk.size, System.nanoTime() / 1000L))
        }
        try { Thread.sleep(intervalMs) } catch (_: InterruptedException) { break }
      }
    }.apply { start() }
  }

  override fun stop() {
    running = false
    worker?.interrupt()
    worker = null
    getMicrophoneData = null
  }

  override fun release() {
    stop()
  }

  override fun isRunning(): Boolean = running
}
