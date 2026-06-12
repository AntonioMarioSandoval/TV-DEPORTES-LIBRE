const channelListEl = document.getElementById('channel-list');
const videoPlayer = document.getElementById('video-player');
const iframePlayer = document.getElementById('iframe-player');
const playerPlaceholder = document.getElementById('player-placeholder');
const channelNameEl = document.getElementById('current-channel-name');
const channelStatusEl = document.getElementById('current-channel-status');
const statusBadge = document.getElementById('status-badge');
const serverSelector = document.getElementById('server-selector');
const searchInput = document.getElementById('search-input');

let canalesJSON = [];
let hlsInstance = null;
let canalActivo = null;

async function init() {
    try {
        const response = await fetch('canales.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        canalesJSON = await response.json();
        renderChannels(canalesJSON);
        setupSearch();
    } catch (error) {
        console.error('Error crítico al cargar el archivo canales.json:', error);
        channelStatusEl.textContent = "Error al conectar con la base de datos de canales.";
    }
}

function renderChannels(lista) {
    channelListEl.innerHTML = '';
    
    if (lista.length === 0) {
        channelListEl.innerHTML = '<li style="padding: 16px; color: var(--text-muted); font-size: 0.9rem; text-align: center;">No se encontraron canales</li>';
        return;
    }

    lista.forEach(canal => {
        const li = document.createElement('li');
        li.className = 'channel-item';
        if (canalActivo && canalActivo.id === canal.id) li.classList.add('active');
        
        li.innerHTML = `
            <div class="channel-item-info">
                <span class="channel-name">${canal.nombre}</span>
                <span class="channel-category">${canal.categoria}</span>
            </div>
            <div class="live-dot"></div>
        `;
        
        li.addEventListener('click', () => {
            document.querySelectorAll('.channel-item').forEach(el => el.classList.remove('active'));
            li.classList.add('active');
            cargarCanal(canal);
        });
        
        channelListEl.appendChild(li);
    });
}

function setupSearch() {
    searchInput.addEventListener('input', (e) => {
        const termino = e.target.value.toLowerCase().trim();
        const canalesFiltrados = canalesJSON.filter(canal => 
            canal.nombre.toLowerCase().includes(termino) || 
            canal.categoria.toLowerCase().includes(termino)
        );
        renderChannels(canalesFiltrados);
    });
}

function cargarCanal(canal) {
    canalActivo = canal;
    channelNameEl.textContent = canal.nombre;
    channelStatusEl.textContent = "Conectando al flujo...";
    statusBadge.className = "status-badge streaming";
    serverSelector.innerHTML = '';
    serverSelector.disabled = false;
    
    canal.servidores.forEach(servidor => {
        const option = document.createElement('option');
        option.value = servidor.url;
        option.textContent = servidor.nombre;
        serverSelector.appendChild(option);
    });

    cambiarFuenteVideo(canal.servidores[0].url);
}

function cambiarFuenteVideo(url) {
    playerPlaceholder.classList.add('hidden');

    if (hlsInstance) {
        hlsInstance.destroy();
        hlsInstance = null;
    }
    videoPlayer.src = "";
    videoPlayer.load();
    iframePlayer.src = "";
    
    videoPlayer.classList.remove('visible');
    iframePlayer.classList.remove('visible');

    const esPaginaWeb = url.includes('.html') || url.includes('?get=') || url.includes('embed') || !url.match(/\.(m3u8|mp4)$/i);

    if (esPaginaWeb) {
        iframePlayer.classList.add('visible');
        iframePlayer.src = url;
        channelStatusEl.textContent = "Transmitiendo mediante Web Player Externo";
    } else {
        videoPlayer.classList.add('visible');
        
        if (Hls.isSupported()) {
            hlsInstance = new Hls({
                maxMaxBufferLength: 15,
                enableWorker: true
            });
            hlsInstance.loadSource(url);
            hlsInstance.attachMedia(videoPlayer);
            
            hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
                channelStatusEl.textContent = "En Vivo (Directo)";
                videoPlayer.play().catch(() => {
                    channelStatusEl.textContent = "Haga clic en Play para iniciar";
                });
            });

            hlsInstance.on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    channelStatusEl.textContent = "Error en el servidor. Intente otra opción.";
                }
            });
        } 
        else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
            videoPlayer.src = url;
            videoPlayer.addEventListener('loadedmetadata', () => {
                channelStatusEl.textContent = "En Vivo (Nativo)";
                videoPlayer.play().catch(() => {});
            });
        } 
        else {
            channelStatusEl.textContent = "Formato no compatible con este navegador.";
        }
    }
}

serverSelector.addEventListener('change', (e) => {
    if (e.target.value) {
        cambiarFuenteVideo(e.target.value);
    }
});

init();
