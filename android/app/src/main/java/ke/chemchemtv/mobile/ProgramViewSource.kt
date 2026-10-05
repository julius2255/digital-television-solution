package ke.chemchemtv.mobile

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.SurfaceTexture
import android.os.Handler
import android.os.Looper
import android.view.Surface
import android.view.View
import com.pedro.encoder.input.sources.video.VideoSource
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.max

/** Encodes only the clean Program Output view; it never captures the phone display. */
class ProgramViewSource(private val view: View) : VideoSource() {
  private var surface: Surface? = null
  private var bitmap: Bitmap? = null
  private var running = false
  private val main = Handler(Looper.getMainLooper())
  private val capturePending = AtomicBoolean(false)
  private val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)

  override fun create(width: Int, height: Int, fps: Int, rotation: Int): Boolean {
    return width > 0 && height > 0 && fps > 0
  }

  override fun start(surfaceTexture: SurfaceTexture) {
    surfaceTexture.setDefaultBufferSize(width, height)
    surface = Surface(surfaceTexture)
    bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    running = true
    while (running) {
      requestCapture()
      try {
        val canvas = surface?.lockCanvas(null)
        if (canvas != null) {
          val frame = bitmap
          if (frame != null) canvas.drawBitmap(frame, 0f, 0f, paint)
          surface?.unlockCanvasAndPost(canvas)
        }
      } catch (_: Exception) { }
      Thread.sleep(max(1, 1000L / fps))
    }
  }

  private fun requestCapture() {
    if (!capturePending.compareAndSet(false, true)) return
    main.post {
      try {
        val frame = bitmap
        val w = view.width
        val h = view.height
        if (frame != null && w > 0 && h > 0) {
          val canvas = Canvas(frame)
          canvas.drawColor(android.graphics.Color.BLACK)
          val sx = width.toFloat() / w.toFloat()
          val sy = height.toFloat() / h.toFloat()
          canvas.save()
          canvas.scale(sx, sy)
          view.draw(canvas)
          canvas.restore()
        }
      } finally {
        capturePending.set(false)
      }
    }
  }

  override fun stop() {
    running = false
    main.removeCallbacksAndMessages(null)
    try { surface?.release() } catch (_: Exception) { }
    surface = null
  }

  override fun release() {
    stop()
    bitmap?.recycle()
    bitmap = null
  }

  override fun isRunning(): Boolean = running
}
