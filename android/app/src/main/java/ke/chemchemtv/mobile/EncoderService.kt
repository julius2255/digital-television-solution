package ke.chemchemtv.mobile

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.graphics.Color
import android.os.Handler
import android.os.Looper
import android.view.View
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import com.pedro.common.ConnectChecker
import com.pedro.encoder.input.sources.audio.AudioFileSource
import com.pedro.encoder.input.sources.audio.NoAudioSource
import com.pedro.encoder.input.sources.video.BitmapSource
import com.pedro.encoder.input.sources.video.VideoFileSource
import com.pedro.library.generic.GenericStream
import io.livekit.android.LiveKit
import io.livekit.android.room.Room
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Native program encoder.
 *
 * Important: there is no MediaProjection here. The phone screen is never used
 * as the video source. RootEncoder receives the actual program media URL.
 */
class EncoderService : Service(), ConnectChecker {

  companion object {
    const val ACTION_START = "ke.chemchemtv.mobile.START"
    const val ACTION_STOP = "ke.chemchemtv.mobile.STOP"
    const val ACTION_STATUS = "ke.chemchemtv.mobile.STATUS"
    const val EXTRA_ENDPOINT = "endpoint"
    const val EXTRA_MEDIA_URL = "mediaUrl"
    const val EXTRA_OUTPUT_URL = "outputUrl"
    const val EXTRA_BASE_URL = "baseUrl"
    const val EXTRA_SESSION = "session"
    const val EXTRA_KIND = "kind"
    const val EXTRA_STATUS = "status"

    private const val CHANNEL_ID = "chemchem_broadcast"
    private const val NOTIFICATION_ID = 2205
  }

  private var stream: GenericStream? = null
  private var starting = false
  private var shouldRun = false
  private val main = Handler(Looper.getMainLooper())
  private val telemetryScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
  private var webView: WebView? = null
  private var livekitRoom: Room? = null
  private var outputUrl = ""
  private var baseUrl = ""
  private var sessionId = ""
  private var reconnectAttempts = 0
  private var lastBitrate = 0L

  override fun onCreate() {
    super.onCreate()
    createNotificationChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_STOP -> {
        shouldRun = false
        main.removeCallbacksAndMessages(null)
        stopEncoder()
        stopTelemetry()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
      }
      ACTION_START -> {
        val endpoint = intent.getStringExtra(EXTRA_ENDPOINT).orEmpty()
        outputUrl = intent.getStringExtra(EXTRA_OUTPUT_URL).orEmpty()
        baseUrl = intent.getStringExtra(EXTRA_BASE_URL).orEmpty().trimEnd('/')
        sessionId = intent.getStringExtra(EXTRA_SESSION).orEmpty()
        val mediaUrl = intent.getStringExtra(EXTRA_MEDIA_URL).orEmpty()
        val kind = intent.getStringExtra(EXTRA_KIND).orEmpty()

        if (endpoint.isBlank()) {
          sendStatus("ERROR: Facebook RTMPS is missing")
          stopSelf()
        } else {
          shouldRun = true
          promoteToForeground(kind == "CAMERA")
          if (outputUrl.isNotBlank() && baseUrl.isNotBlank()) {
            startTelemetry()
            startProgramOutputEncoder(endpoint)
          } else if (kind == "CAMERA") {
            startCameraEncoder(endpoint)
          } else if (mediaUrl.isNotBlank()) {
            startEncoder(endpoint, mediaUrl, kind)
          } else {
            sendStatus("ERROR: Program Output is missing")
            stopSelf()
          }
        }
      }
    }
    return START_STICKY
  }

  private fun promoteToForeground(camera: Boolean = false) {
    val n = notification("CHEMCHEM TV KENYA • NATIVE ENCODER STARTING")
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      ServiceCompat.startForeground(
        this,
        NOTIFICATION_ID,
        n,
        if (camera) android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA or android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE else android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
      )
    } else {
      startForeground(NOTIFICATION_ID, n)
    }
  }

  private fun startProgramOutputEncoder(endpoint: String) {
    if (starting || stream?.isStreaming == true || !shouldRun) return
    starting = true
    stopStreamOnly()
    main.post {
      try {
        ensureProgramWebView()
        val newStream = GenericStream(
          applicationContext,
          this,
          ProgramViewSource(webView!!),
          SilentAudioSource()
        )
        newStream.getGlInterface().setForceRender(true, 30)
        val videoReady = newStream.prepareVideo(1280, 720, 3500 * 1000, fps = 30, rotation = 0)
        val audioReady = newStream.prepareAudio(44100, true, 128 * 1000, false, false)
        if (!videoReady || !audioReady) {
          newStream.release()
          throw IllegalStateException("H.264/AAC encoder preparation failed")
        }
        stream = newStream
        sendStatus("CONNECTING: Program Output → Facebook RTMPS")
        updateNotification("CHEMCHEM TV KENYA • FACEBOOK CONNECTING")
        newStream.startStream(endpoint)
        starting = false
      } catch (e: Exception) {
        starting = false
        sendStatus("ERROR: " + (e.message ?: "Program Output encoder failed"))
        scheduleReconnect(endpoint)
      }
    }
  }

  private fun ensureProgramWebView() {
    if (webView != null) return
    val wv = WebView(applicationContext)
    wv.setBackgroundColor(Color.BLACK)
    wv.settings.javaScriptEnabled = true
    wv.settings.domStorageEnabled = true
    wv.settings.mediaPlaybackRequiresUserGesture = false
    wv.settings.cacheMode = WebSettings.LOAD_DEFAULT
    wv.webChromeClient = WebChromeClient()
    wv.webViewClient = object : WebViewClient() {
      override fun onPageFinished(view: WebView?, url: String?) {
        sendStatus("PROGRAM OUTPUT READY")
      }
    }
    wv.measure(
      View.MeasureSpec.makeMeasureSpec(1280, View.MeasureSpec.EXACTLY),
      View.MeasureSpec.makeMeasureSpec(720, View.MeasureSpec.EXACTLY)
    )
    wv.layout(0, 0, 1280, 720)
    webView = wv
    sendStatus("PROGRAM OUTPUT CONNECTING")
    wv.loadUrl(outputUrl)
  }

  private fun scheduleReconnect(endpoint: String) {
    if (!shouldRun) return
    reconnectAttempts++
    val delay = if (reconnectAttempts <= 3) 5000L else 10000L
    sendStatus("NETWORK WEAK: reconnecting #$reconnectAttempts")
    updateNotification("CHEMCHEM TV KENYA • RECONNECTING")
    main.removeCallbacksAndMessages(null)
    main.postDelayed({
      if (shouldRun) startProgramOutputEncoder(endpoint)
    }, delay)
  }

  private fun stopStreamOnly() {
    try { stream?.stopStream() } catch (_: Exception) {}
    try { stream?.release() } catch (_: Exception) {}
    stream = null
    starting = false
  }

  private fun startTelemetry() {
    if (baseUrl.isBlank() || livekitRoom != null) return
    telemetryScope.launch {
      try {
        val connection = (URL(baseUrl + "/api/livekit/token?role=connector").openConnection() as HttpURLConnection).apply {
          requestMethod = "GET"
          connectTimeout = 10000
          readTimeout = 10000
        }
        val json = JSONObject(connection.inputStream.bufferedReader().use { it.readText() })
        connection.disconnect()
        if (!json.optBoolean("ok")) throw IllegalStateException(json.optString("error", "LiveKit token failed"))
        val room = LiveKit.create(applicationContext)
        livekitRoom = room
        room.connect(json.getString("url"), json.getString("token"))
        publishTelemetry("CONNECTOR_CONNECTED", "Android Facebook bridge connected")
      } catch (e: Exception) {
        sendStatus("TELEMETRY OFFLINE: " + (e.message ?: "LiveKit unavailable"))
      }
    }
  }

  private fun publishTelemetry(status: String, detail: String) {
    val room = livekitRoom ?: return
    val payload = JSONObject()
      .put("type", "chemchem-encoder-status")
      .put("version", 1)
      .put("sessionId", sessionId)
      .put("status", status)
      .put("detail", detail)
      .put("bitrateKbps", lastBitrate / 1000L)
      .put("fps", 30)
      .put("quality", if (lastBitrate >= 3000000L) "STRONG" else if (lastBitrate >= 1500000L) "GOOD" else if (lastBitrate >= 700000L) "WEAK" else "CONNECTING")
      .put("retries", reconnectAttempts)
      .put("sentAt", System.currentTimeMillis())
      .toString().toByteArray(Charsets.UTF_8)
    telemetryScope.launch {
      try { room.localParticipant.publishData(payload, topic = "chemchem-encoder-status") } catch (_: Exception) {}
    }
  }

  private fun stopTelemetry() {
    try { livekitRoom?.disconnect() } catch (_: Exception) {}
    livekitRoom = null
  }

  private fun startEncoder(endpoint: String, mediaUrl: String, kind: String) {
    if (starting || stream?.isStreaming == true) return

    starting = true
    stopEncoder()

    Thread {
      try {
        val uri = Uri.parse(mediaUrl)
        val lower = mediaUrl.substringBefore("?").lowercase()

        val newStream: GenericStream

        if (kind == "IMAGE" || isImage(lower)) {
          val bitmap = applicationContext.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it) }
            ?: throw IllegalStateException("Could not download Program image")
          newStream = GenericStream(
            applicationContext,
            this,
            BitmapSource(bitmap),
            SilentAudioSource()
          )
        } else {
          val audioInfo = probeAudio(uri)
          val videoSource = VideoFileSource(applicationContext, uri, true)
          val audioSource = if (audioInfo != null) {
            AudioFileSource(applicationContext, uri, true)
          } else {
            // Always provide a real AAC clock/track to the RTMPS muxer.
            // This prevents Facebook from seeing a video-only ingest.
            SilentAudioSource()
          }

          newStream = GenericStream(applicationContext, this, videoSource, audioSource)

          val sampleRate = audioInfo?.first ?: 44100
          val stereo = (audioInfo?.second ?: 2) >= 2

          newStream.getGlInterface().setForceRender(true, 30)

          val videoReady = newStream.prepareVideo(
            1280, 720, 3500 * 1000, fps = 30, rotation = 0
          )
          val audioReady = newStream.prepareAudio(
            sampleRate, stereo, 128 * 1000, false, false
          )

          if (!videoReady || !audioReady) {
            newStream.release()
            throw IllegalStateException("H.264/AAC encoder preparation failed")
          }

          stream = newStream
          sendStatus("PROGRAM READY • H.264 720P + AAC")
          sendStatus("CONNECTING • FACEBOOK RTMPS")
          updateNotification("CHEMCHEM TV KENYA • FACEBOOK CONNECTING")
          newStream.startStream(endpoint)
          return@Thread
        }

        newStream.getGlInterface().setForceRender(true, 30)
        val videoReady = newStream.prepareVideo(
          1280, 720, 3500 * 1000, fps = 30, rotation = 0
        )
        val audioReady = newStream.prepareAudio(
          44100, true, 128 * 1000, false, false
        )

        if (!videoReady || !audioReady) {
          newStream.release()
          throw IllegalStateException("Encoder preparation failed")
        }

        stream = newStream
        sendStatus("PROGRAM READY • H.264 720P + AAC")
        sendStatus("CONNECTING • FACEBOOK RTMPS")
        updateNotification("CHEMCHEM TV KENYA • FACEBOOK CONNECTING")
        newStream.startStream(endpoint)
      } catch (e: Exception) {
        starting = false
        sendStatus("ERROR: " + (e.message ?: "native encoder failed"))
        stopEncoder()
        stopSelf()
      }
    }.start()
  }

  private fun startCameraEncoder(endpoint: String) {
    if (starting || stream?.isStreaming == true) return
    starting = true
    stopEncoder()
    Thread {
      try {
        val newStream = GenericStream(applicationContext, this)
        val videoReady = newStream.prepareVideo(1280, 720, 3500 * 1000, fps = 30, rotation = 0)
        val audioReady = newStream.prepareAudio(44100, true, 128 * 1000, false, false)
        if (!videoReady || !audioReady) {
          newStream.release()
          throw IllegalStateException("Camera H.264/AAC preparation failed")
        }
        stream = newStream
        sendStatus("CAMERA READY • H.264 720P + AAC")
        sendStatus("CONNECTING • FACEBOOK RTMPS")
        updateNotification("CHEMCHEM TV KENYA • CAMERA CONNECTING")
        newStream.startStream(endpoint)
      } catch (e: Exception) {
        starting = false
        sendStatus("ERROR: " + (e.message ?: "camera encoder failed"))
        stopEncoder()
        stopSelf()
      }
    }.start()
  }

  private fun probeAudio(uri: Uri): Pair<Int, Int>? {
    val extractor = MediaExtractor()
    return try {
      extractor.setDataSource(this, uri, null)
      for (i in 0 until extractor.trackCount) {
        val format = extractor.getTrackFormat(i)
        val mime = format.getString(MediaFormat.KEY_MIME).orEmpty()
        if (mime.startsWith("audio/")) {
          val rate = if (format.containsKey(MediaFormat.KEY_SAMPLE_RATE))
            format.getInteger(MediaFormat.KEY_SAMPLE_RATE) else 44100
          val channels = if (format.containsKey(MediaFormat.KEY_CHANNEL_COUNT))
            format.getInteger(MediaFormat.KEY_CHANNEL_COUNT) else 2
          return Pair(rate, channels)
        }
      }
      null
    } finally {
      extractor.release()
    }
  }

  private fun isImage(url: String): Boolean =
    Regex("\\.(jpg|jpeg|png|webp|gif)$", RegexOption.IGNORE_CASE).containsMatchIn(url)

  private fun updateNotification(text: String) {
    getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, notification(text))
  }

  private fun stopEncoder() {
    stopStreamOnly()
    try { webView?.stopLoading() } catch (_: Exception) {}
    try { webView?.destroy() } catch (_: Exception) {}
    webView = null
  }

  private fun sendStatus(value: String) {
    sendBroadcast(
      Intent(ACTION_STATUS)
        .setPackage(packageName)
        .putExtra(EXTRA_STATUS, value)
    )
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      getSystemService(NotificationManager::class.java).createNotificationChannel(
        NotificationChannel(
          CHANNEL_ID,
          "CHEMCHEM TV Broadcast",
          NotificationManager.IMPORTANCE_LOW
        )
      )
    }
  }

  private fun notification(text: String): Notification {
    val stopPending = PendingIntent.getService(
      this,
      1,
      Intent(this, EncoderService::class.java).setAction(ACTION_STOP),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    val openPending = PendingIntent.getActivity(
      this,
      2,
      Intent(this, MainActivity::class.java),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_media_play)
      .setContentTitle("CHEMCHEM TV KENYA")
      .setContentText(text)
      .setContentIntent(openPending)
      .setOngoing(true)
      .setSilent(true)
      .addAction(android.R.drawable.ic_media_pause, "STOP STREAM", stopPending)
      .build()
  }

  override fun onBind(intent: Intent?): IBinder? = null
  override fun onConnectionStarted(url: String) { sendStatus("CONNECTING") }
  override fun onConnectionSuccess() {
    starting = false
    reconnectAttempts = 0
    sendStatus("LIVE: Facebook Connected • 30 FPS")
    updateNotification("CHEMCHEM TV KENYA • LIVE • FACEBOOK CONNECTED")
  }
  override fun onNewBitrate(bitrate: Long) {
    lastBitrate = bitrate
    val kbps = bitrate / 1000
    val quality = if (bitrate >= 3000000L) "STRONG" else if (bitrate >= 1500000L) "GOOD" else if (bitrate >= 700000L) "WEAK" else "VERY WEAK"
    sendStatus("LIVE: Facebook Connected • ${kbps} kbps • 30 FPS • ${quality}")
    updateNotification("CHEMCHEM TV • LIVE • ${kbps} kbps • ${quality}")
  }
  override fun onConnectionFailed(reason: String) {
    starting = false
    if (shouldRun) scheduleReconnect(endpoint) else sendStatus("ERROR: " + reason)
  }
  override fun onDisconnect() {
    starting = false
    if (shouldRun) scheduleReconnect(endpoint) else sendStatus("DISCONNECTED")
  }
  override fun onAuthError() {
    starting = false
    sendStatus("FACEBOOK KEY REJECTED")
    updateNotification("CHEMCHEM TV KENYA • FACEBOOK KEY REJECTED")
  }
  override fun onAuthSuccess() = Unit

  override fun onDestroy() {
    shouldRun = false
    main.removeCallbacksAndMessages(null)
    stopEncoder()
    stopTelemetry()
    telemetryScope.cancel()
    super.onDestroy()
  }
}
