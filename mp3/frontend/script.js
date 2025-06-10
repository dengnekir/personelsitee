document.addEventListener("DOMContentLoaded", () => {
  const downloadForm = document.getElementById("download-form");
  const downloadStatus = document.getElementById("status-message");
  const videoUrlInput = document.getElementById("video-url");
  const downloadBtn = document.getElementById("download-btn");

  // Backend sunucu URL'si
  const BACKEND_URL = "http://localhost:5000";

  // Gelişmiş hata mesajları
  const errorMessages = {
    timeout:
      "İndirme işlemi çok uzun sürdü. İnternet bağlantınızı ve video URL'sini kontrol edin.",
    network: "Ağ bağlantısı hatası. Lütfen internet bağlantınızı kontrol edin.",
    url_invalid:
      "Geçersiz YouTube URL'si. Lütfen doğru bir URL girdiğinizden emin olun.",
    server_error: "Sunucu hatası oluştu. Lütfen daha sonra tekrar deneyin.",
    default: "Bilinmeyen bir hata oluştu. Lütfen tekrar deneyin.",
  };

  // Gelişmiş logging fonksiyonu
  function log(message) {
    console.log(`[${new Date().toLocaleTimeString()}] ${message}`);
  }

  // Hata gösterme fonksiyonu
  function showError(message, type = "default") {
    if (!downloadStatus) {
      console.error("Status message elementi bulunamadı!");
      return;
    }
    const errorMsg = errorMessages[type] || errorMessages["default"];
    downloadStatus.textContent = errorMsg;
    downloadStatus.classList.add("error");
    downloadStatus.classList.remove("success");
    log(`İndirme hatası: ${message}`);
  }

  // Başarı mesajı gösterme fonksiyonu
  function showSuccess(message) {
    if (!downloadStatus) {
      console.error("Status message elementi bulunamadı!");
      return;
    }
    downloadStatus.textContent = message;
    downloadStatus.classList.add("success");
    downloadStatus.classList.remove("error");
    log(`Başarılı: ${message}`);
  }

  // Platform URL doğrulama fonksiyonları
  function validateYouTubeURL(url) {
    const youtubeRegex =
      /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(\S*)?$/;
    return youtubeRegex.test(url);
  }

  function validateInstagramURL(url) {
    const instagramRegex =
      /^(https?:\/\/)?(www\.)?(instagram\.com\/(?:p|reel|tv)\/[a-zA-Z0-9_-]+)/;
    return instagramRegex.test(url);
  }

  function validateTikTokURL(url) {
    const tiktokRegex =
      /^(https?:\/\/)?(www\.)?(tiktok\.com\/@[^/]+\/video\/\d+)/;
    return tiktokRegex.test(url);
  }

  // Platform ID çıkarma fonksiyonları
  function extractYouTubeVideoId(url) {
    const videoIdRegex = /(?:v=|\/|shorts\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(videoIdRegex);
    return match ? match[1] : null;
  }

  function extractInstagramPostId(url) {
    const postIdRegex = /\/(p|reel|tv)\/([a-zA-Z0-9_-]+)/;
    const match = url.match(postIdRegex);
    return match ? match[2] : null;
  }

  function extractTikTokVideoId(url) {
    const videoIdRegex = /\/video\/(\d+)/;
    const match = url.match(videoIdRegex);
    return match ? match[1] : null;
  }

  // Video indirme fonksiyonu
  async function downloadVideo() {
    const videoUrl = videoUrlInput.value.trim();
    const formatRadios = document.querySelectorAll('input[name="format"]');
    const selectedFormat = Array.from(formatRadios).find(
      (radio) => radio.checked
    ).value;

    log(`İndirme butonu tıklandı`);
    log(`Seçilen URL: ${videoUrl}, Format: ${selectedFormat}`);

    // Platform kontrolü ve ID çıkarma
    let platformType = "youtube";
    let videoId = null;

    if (validateYouTubeURL(videoUrl)) {
      platformType = "youtube";
      videoId = extractYouTubeVideoId(videoUrl);
    } else if (validateInstagramURL(videoUrl)) {
      platformType = "instagram";
      videoId = extractInstagramPostId(videoUrl);
    } else if (validateTikTokURL(videoUrl)) {
      platformType = "tiktok";
      videoId = extractTikTokVideoId(videoUrl);
    } else {
      showError("Desteklenmeyen platform veya geçersiz URL", "url_invalid");
      return;
    }

    if (!videoId) {
      showError(
        "Video ID'si çıkarılamadı. Lütfen URL'yi kontrol edin.",
        "url_invalid"
      );
      return;
    }

    // Yükleme durumunu göster
    if (downloadStatus) {
      downloadStatus.textContent = "İndirme başlatılıyor...";
      downloadStatus.classList.remove("error", "success");
    }
    downloadBtn.disabled = true;

    try {
      log("İndirme işlemi başlatılıyor...");
      log(
        `Video indirme başlatıldı: ${videoId}, Platform: ${platformType}, Format: ${selectedFormat}`
      );

      // Platform bazlı API URL'leri
      const apiUrls = {
        youtube: {
          mp4: `https://apiyt.com/iframe_mp4/?vid=${videoId}&color=FFCB2F&utm_source=api`,
          mp3: `https://apiyt.com/iframe/?vid=${videoId}&color=FFCB2F&utm_source=api`,
        },
        instagram: {
          mp4: `${BACKEND_URL}/download_instagram`,
          mp3: `${BACKEND_URL}/download_instagram`,
        },
        tiktok: {
          mp4: `https://apitiktok.com/iframe_mp4/?vid=${videoId}&color=FFCB2F&utm_source=api`,
          mp3: `https://apitiktok.com/iframe/?vid=${videoId}&color=FFCB2F&utm_source=api`,
        },
      };

      // Platform bazlı API URL'si seçimi
      const selectedApiUrl =
        apiUrls[platformType][selectedFormat] || apiUrls["youtube"]["mp4"];

      // Mevcut iframe'leri temizle
      const existingIframes = document.querySelectorAll(
        'iframe[rel="nofollow"]'
      );
      existingIframes.forEach((existingIframe) => existingIframe.remove());

      // Instagram için özel işlem
      if (platformType === "instagram") {
        try {
          fetch(selectedApiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              url: videoUrl,
              format: selectedFormat === "mp3" ? "audio" : "video",
            }),
          })
            .then((response) => {
              // Sunucu yanıtını detaylı logla
              console.log("Sunucu yanıt durumu:", response.status);
              console.log(
                "Yanıt headers:",
                Object.fromEntries(response.headers.entries())
              );

              if (!response.ok) {
                // Hata durumunda detaylı bilgi al
                return response.text().then((errorText) => {
                  console.error("Sunucu hata yanıtı:", errorText);
                  throw new Error(
                    `Sunucu hatası: ${response.status} - ${errorText}`
                  );
                });
              }
              return response.json();
            })
            .then((data) => {
              console.log("Sunucudan gelen yanıt:", data);

              if (data.filename) {
                // Dosyayı otomatik olarak indir
                const downloadLink = document.createElement("a");
                const downloadUrl = `${BACKEND_URL}/downloads/${data.filename}`;

                console.log("İndirme URL'si:", downloadUrl);

                downloadLink.href = downloadUrl;
                downloadLink.download = data.filename;

                // Konteyner oluştur
                const downloadContainer = document.createElement("div");
                downloadContainer.style.marginTop = "10px";
                downloadContainer.style.textAlign = "center";

                // Otomatik indirme
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);

                showSuccess(`İçerik hazır: ${data.filename}`);
              } else {
                // Sunucudan filename gelmezse detaylı hata mesajı
                const errorMessage = data.error || "İçerik indirilemedi";
                console.error("İndirme hatası:", errorMessage);
                showError(errorMessage);
              }
            })
            .catch((error) => {
              // Detaylı hata yakalama
              console.error("Tam hata detayları:", error);

              // Hata türüne göre özel mesajlar
              if (error instanceof TypeError) {
                showError(
                  `Ağ hatası: ${error.message}. İnternet bağlantınızı kontrol edin.`
                );
              } else if (error.message.includes("404")) {
                showError("İçerik bulunamadı. URL'yi kontrol edin.");
              } else if (error.message.includes("500")) {
                showError(
                  "Sunucu hatası oluştu. Lütfen daha sonra tekrar deneyin."
                );
              } else {
                showError(`İndirme hatası: ${error.message}`);
              }
            });
        } catch (error) {
          console.error("Genel işlem hatası:", error);
          showError(`İşlem hatası: ${error.message}`);
        }
      } else {
        // Iframe için konteyner oluştur
        let iframeContainer = document.getElementById("download-links");
        if (!iframeContainer) {
          iframeContainer = document.createElement("div");
          iframeContainer.id = "download-links";
          iframeContainer.style.marginTop = "10px";
          iframeContainer.style.textAlign = "center";

          // Formu veya uygun bir üst elementi bul
          const parentElement =
            downloadStatus.closest("form") ||
            downloadStatus.closest(".container") ||
            document.body;
          parentElement.appendChild(iframeContainer);
        } else {
          iframeContainer.innerHTML = ""; // Önceki içeriği temizle
        }

        // iframe oluşturma
        const iframe = document.createElement("iframe");
        iframe.setAttribute("rel", "nofollow");
        iframe.style.width = "250px"; // Genişliği biraz daraltıyorum
        iframe.style.height = "50px"; // Yüksekliği biraz küçültüyorum
        iframe.style.border = "0px";
        iframe.style.display = "block";
        iframe.style.margin = "0 auto"; // Yatayda ortalama
        iframe.style.background =
          "linear-gradient(135deg, #FFCB2F 0%,rgb(78, 56, 21) 100%)"; // Gradyan renk
        iframe.style.borderRadius = "8px"; // Yumuşak köşeler
        iframe.style.boxShadow = "0 4px 6px rgba(0,0,0,0.1)"; // Hafif gölge

        // Font boyutunu küçültmek için stil ekle
        iframe.style.fontSize = "12px"; // Font boyutunu küçültme
        iframe.style.textAlign = "center"; // İçeriği ortalama
        iframe.src = selectedApiUrl;

        iframeContainer.appendChild(iframe);
        showSuccess(
          `${
            platformType.charAt(0).toUpperCase() + platformType.slice(1)
          } indirme linki hazırlandı!`
        );
      }
    } catch (error) {
      log(`İndirme hatası: ${error}`);
      showError(error.message, "default");
    } finally {
      downloadBtn.disabled = false;
    }
  }

  // İndirme butonuna tıklama event listener'ı
  downloadBtn.addEventListener("click", downloadVideo);

  // Enter tuşu ile indirme
  videoUrlInput.addEventListener("keypress", function (event) {
    if (event.key === "Enter") {
      downloadVideo();
    }
  });

  // WOW.js Animasyon Ayarları
  const wow = new WOW({
    boxClass: "wow", // Animasyon sınıfı
    animateClass: "animated", // Animate.css animasyon sınıfı
    offset: 50, // Görünüm alanına geldiğinde başlat
    mobile: true, // Mobil cihazlarda da çalış
    live: true, // Dinamik içerik için
  });
  wow.init();

  // Konsol uyarısı
  console.log("%c⚠️ Geliştirici Modu Açık ⚠️", "color: red; font-size: 20px;");
  console.log("Herhangi bir sorun varsa konsol mesajlarını kontrol edin.");
});
