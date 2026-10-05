package ke.chemchemtv.mobile

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.SurfaceTexture
import android.os.Handler
import android.os.Looper
import android.view.Surface
import android.view.View
import com.pedro.encoder.input.sources.video.VideoSource
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Encodes only the clean Program Output view.
 *
 * Important: VideoSource.start() must return immediately. RootEncoder owns the
 * encoder thread, so the frame pump runs on its own worker instead of blocking
 * start(). The WebView is rendered on Android's main thread into a bitmap and
 * that bitmap is copied to the encoder Surface at the requested FPS.
 */
class ProgramViewSource(private val view: View) : VideoSource() {

  private val main = Handler(Looper.getMainLooper())
  private val capturePending = AtomicBoolean(false)
  private val frameLock = Any()
  private val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)

  @Volatile private var running = false
  @Volatile private var surface: Surface? = null
  @Volatile private var bitmap: Bitmap? = null
  private var worker: Thread? = null

  override fun create(width: Int, height: Int, fps: Int, rotation: Int): Boolean {
    return width > 0 && height > 0 && fps > 0
  }

  override fun start(surfaceTexture: SurfaceTexture) {
    stop()

    try {
      surfaceTexture.setDefaultBufferSize(width, height)
      surface = Surface(surfaceTexture)
      bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    } catch (e: Exception) {
      running = false
      throw e
    }

    running = true
    worker = Thread({
      val frameDelay = (1000L / fps.coerceAtLeast(1)).coerceAtLeast(1L)

      while (running) {
        requestCapture()

        try {
          synchronized(frameLock) {
            val output = surface
            val frame = bitmap
            if (output != null && frame != null && !frame.isRecycled) {
              val canvas = output.lockCanvas(null)
              if (canvas != null) {
                try {
                  canvas.drawColor(Color.BLACK)
                  canvas.drawBitmap(frame, null, canvas.clipBounds, paint)
                } finally {
                  try {
                    output.unlockCanvasAndPost(canvas)
                  } catch (_: Exception) {
                  }
                }
              }
            }
          }
        } catch (_: Exception) {
          // The encoder may destroy/recreate the Surface during shutdown.
        }

        try {
          Thread.sleep(frameDelay)
        } catch (_: InterruptedException) {
          break
        }
      }
    }, "chemchem-program-frames").apply {
      isDaemon = true
      start()
    }
  }

  private fun requestCapture() {
    if (!running || !capturePending.compareAndSet(false, true)) return

    main.post {
      try {
        if (!running) return@post

        val frame = bitmap ?: return@post
        if (frame.isRecycled) return@post

        val w = view.width
        val h = view.height
        if (w <= 0 || h <= 0) return@post

        synchronized(frameLock) {
          if (!running || frame.isRecycled) return@synchronized

          val canvas = Canvas(frame)
          canvas.drawColor(Color.BLACK)

          val sx = width.toFloat() / w.toFloat()
          val sy = height.toFloat() / h.toFloat()

          canvas.save()
          canvas.scale(sx, sy)
          try {
            view.draw(canvas)
          } catch (_: Exception) {
            // WebView can be destroyed while the activity is closing.
          } finally {
            canvas.restore()
          }
        }
      } finally {
        capturePending.set(false)
      }
    }
  }

  override fun stop() {
    running = false
    main.removeCallbacksAndMessages(null)

    worker?.interrupt()
    worker = null

    try {
      surface?.release()
    } catch (_: Exception) {
    }
    surface = null

    synchronized(frameLock) {
      val old = bitmap
      bitmap = null
      try {
        if (old != null && !old.isRecycled) old.recycle()
      } catch (_: Exception) {
      }
    }
  }

  override fun release() {
    stop()
  }

  override fun isRunning(): Boolean = running
}
