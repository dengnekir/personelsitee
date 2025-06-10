import os
import uuid
import json
import re
import subprocess
import yt_dlp
from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
import logging
import traceback
import requests
import random
import socket
import urllib3

# Urllib3 uyarılarını devre dışı bırak
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Gerekli dizinleri oluştur
DOWNLOAD_DIR = os.path.join(os.path.dirname(__file__), 'downloads')
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

# Gelişmiş logging ayarları
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('download_logs.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Tüm kaynaklardan gelen isteklere izin ver

# Gelişmiş proxy listesi
PROXIES = [
    'http://103.152.112.162:80',
    'http://103.152.112.162:8080',
    'http://45.79.158.134:8080',
    'http://185.230.160.97:80',
    'http://185.230.160.97:8080',
]

def get_proxy():
    """Rastgele proxy seçimi"""
    return random.choice(PROXIES) if PROXIES else None

def sanitize_filename(filename):
    """Dosya adını güvenli hale getir"""
    return "".join(c for c in filename if c.isalnum() or c in (' ', '.', '_')).rstrip()

def set_global_socket_timeout(timeout=60):
    """Global socket timeout ayarla"""
    socket.setdefaulttimeout(timeout)

def convert_shorts_to_video_url(url):
    """Shorts URL'sini standart YouTube video URL'sine çevir"""
    # Shorts URL'lerini standart YouTube URL formatına çevir
    shorts_patterns = [
        r'https?://(?:www\.)?youtube\.com/shorts/([^/?]+)',
        r'https?://(?:www\.)?youtube\.com/shorts\?v=([^&]+)',
        r'https?://(?:www\.)?youtube\.com/shorts/([^/?]+)\?si=[^&]+'
    ]
    
    for pattern in shorts_patterns:
        match = re.search(pattern, url)
        if match:
            video_id = match.group(1)
            return f'https://www.youtube.com/watch?v={video_id}'
    
    return url

def validate_youtube_url(url):
    """YouTube URL'sini doğrula"""
    youtube_regex = r'^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(\S*)?$'
    return re.match(youtube_regex, url) is not None

def download_youtube_video(url, download_type='mp3'):
    """yt-dlp kullanarak YouTube videosunu indir"""
    try:
        # Hızlı timeout ayarları
        socket.setdefaulttimeout(30)  # 30 saniye timeout

        # Benzersiz bir klasör oluştur
        download_folder = os.path.join(DOWNLOAD_DIR, str(uuid.uuid4()))
        os.makedirs(download_folder, exist_ok=True)
        
        # Gelişmiş User-Agent listesi
        user_agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        ]
        
        # yt-dlp için optimize edilmiş ayarlar
        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': os.path.join(download_folder, '%(title)s.%(ext)s'),
            'nooverwrites': True,
            'no_color': True,
            'no_warnings': False,
            'ignoreerrors': False,
            'quiet': True,  # Detaylı çıktıyı kapat
            'no_warnings': True,
            'socket_timeout': 30,  # Hızlı timeout
            'retries': 2,  # Az sayıda yeniden deneme
            'fragment_retries': 2,
            'extractor_retries': 2,
            'user_agent': random.choice(user_agents),  # Rastgele User-Agent
            'force_generic_extractor': True,  # Farklı video kaynaklarını destekle
            'allow_unplayable_formats': True,
            'no_color': True,
            'progress_hooks': [lambda d: logger.debug(f'İndirme durumu: {d}')],
        }
        
        # Format seçimi
        if download_type == 'mp3':
            ydl_opts.update({
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': '192',
                }]
            })
        elif download_type == 'mp4':
            ydl_opts.update({
                'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            })
        
        # Proxy ayarları
        proxy = get_proxy()
        if proxy:
            ydl_opts['proxy'] = proxy
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            try:
                # Hızlı bilgi çekme
                info_dict = ydl.extract_info(url, download=True)
                
                if not info_dict:
                    logger.error("Video bilgileri alınamadı!")
                    return jsonify({"error": "Video bilgileri alınamadı"}), 400
                
                # İndirilen dosyayı bul
                downloaded_files = [f for f in os.listdir(download_folder) if os.path.isfile(os.path.join(download_folder, f))]
                
                if not downloaded_files:
                    logger.error("Dosya indirilemedi!")
                    return jsonify({"error": "Dosya indirilemedi"}), 404
                
                # İlk dosyayı seç
                file_path = os.path.join(download_folder, downloaded_files[0])
                
                # Dosya adını temizle
                safe_filename = sanitize_filename(os.path.basename(file_path))
                
                logger.info(f"Dosya indirildi: {safe_filename}")
                
                return send_file(
                    file_path, 
                    as_attachment=True, 
                    download_name=safe_filename
                )
            
            except Exception as extract_error:
                logger.error(f"Video bilgileri çıkarma hatası: {str(extract_error)}")
                logger.error(traceback.format_exc())
                return jsonify({"error": f"Video indirme hatası: {str(extract_error)}"}), 500
    
    except Exception as e:
        logger.error(f"İndirme hatası: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"error": str(e)}), 500
    finally:
        # Geçici dosyaları temizle (opsiyonel)
        try:
            if 'download_folder' in locals():
                for file in os.listdir(download_folder):
                    os.remove(os.path.join(download_folder, file))
                os.rmdir(download_folder)
        except Exception as cleanup_error:
            logger.warning(f"Temizleme hatası: {cleanup_error}")

@app.route('/download', methods=['POST'])
def download_video():
    try:
        # Hızlı timeout ayarları
        socket.setdefaulttimeout(30)  # 30 saniye timeout

        data = request.get_json()
        video_url = data.get('url')
        download_type = data.get('type', 'mp3')
        
        # URL doğrulama
        if not validate_youtube_url(video_url):
            logger.error(f"Geçersiz YouTube URL'si: {video_url}")
            return jsonify({"error": "Geçersiz YouTube URL'si"}), 400
        
        # Shorts URL'sini standart URL'ye çevir
        video_url = convert_shorts_to_video_url(video_url)
        
        logger.debug(f"İndirme isteği alındı: URL={video_url}, Tip={download_type}")
        
        return download_youtube_video(video_url, download_type)

    except Exception as e:
        logger.error(f'Genel indirme hatası: {str(e)}')
        logger.error(traceback.format_exc())
        return jsonify({
            'status': 'error', 
            'message': str(e)
        }), 500

@app.route('/file/<filename>', methods=['GET'])
def get_file(filename):
    try:
        file_path = os.path.join(DOWNLOAD_DIR, filename)
        
        # Dosya var mı kontrolü
        if not os.path.exists(file_path):
            logger.warning(f"Dosya bulunamadı: {filename}")
            return jsonify({
                'status': 'error', 
                'message': 'Dosya bulunamadı'
            }), 404

        return send_file(file_path, as_attachment=True)

    except Exception as e:
        logger.error(f'Dosya indirme hatası: {str(e)}')
        return jsonify({
            'status': 'error', 
            'message': str(e)
        }), 500

@app.route('/cleanup', methods=['POST'])
def cleanup_files():
    try:
        # Tüm indirilen dosyaları temizle
        for filename in os.listdir(DOWNLOAD_DIR):
            file_path = os.path.join(DOWNLOAD_DIR, filename)
            try:
                if os.path.isfile(file_path):
                    os.unlink(file_path)
            except Exception as e:
                logger.error(f'Dosya silme hatası: {str(e)}')
        
        return jsonify({
            'status': 'success', 
            'message': 'Tüm dosyalar silindi'
        })

    except Exception as e:
        logger.error(f'Temizleme hatası: {str(e)}')
        return jsonify({
            'status': 'error', 
            'message': str(e)
        }), 500

if __name__ == '__main__':
    # Gerekli klasörleri oluştur
    os.makedirs(DOWNLOAD_DIR, exist_ok=True)
    app.run(debug=True, port=5000) 