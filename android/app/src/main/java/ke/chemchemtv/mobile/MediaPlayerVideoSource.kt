package ke.chemchemtv.mobile

import android.content.Context
import android.media.MediaPlayer
import android.graphics.SurfaceTexture
import android.view.Surface
import android.net.Uri
import com.pedro.encoder.input.sources.video.VideoSource

class MediaPlayerVideoSource(
  private val context: Context,
  private val mediaUrl: String
) : VideoSource() {
  private var surface: Surface? = null
  private var player: MediaPlayer? = null
  @Volatile private var running = false

  override fun create(width: Int, height: Int, fps: Int, rotation: Int): Boolean =
    mediaUrl.startsWith("http://", true) || mediaUrl.startsWith("https://", true)

  override fun start(surfaceTexture: SurfaceTexture) {
    stop()
    surfaceTexture.setDefaultBufferSize(width, height)
    surface = Surface(surfaceTexture)
    val mp = MediaPlayer()
    player = mp
    running = true
    mp.setSurface(surface)
    mp.isLooping = true
    mp.setVolume(0f, 0f)
    mp.setWakeMode(context, android.os.PowerManager.PARTIAL_WAKE_LOCK)
    mp.setOnPreparedListener {
      if (running) {
        try { it.start() } catch (_: Exception) { running = false }
      }
    }
    mp.setOnErrorListener { _, _, _ -> running = false; true }
    try {
      mp.setDataSource(context, Uri.parse(mediaUrl))
      mp.prepareAsync()
    } catch (_: Exception) {
      running = false
    }
  }

  override fun stop() {
    running = false
    try { player?.stop() } catch (_: Exception) {}
    try { player?.reset() } catch (_: Exception) {}
    try { player?.release() } catch (_: Exception) {}
    player = null
    try { surface?.release() } catch (_: Exception) {}
    surface = null
  }

  override fun release() = stop()
  override fun isRunning(): Boolean = running
}
