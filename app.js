const channelListEl = document.getElementById('channel-list');
const searchInput = document.getElementById('search-input');
const screenRadioBtns = document.querySelectorAll('input[name="active-screen"]');
const screen2Container = document.getElementById('screen-2');
const closeScreen2Btn = document.getElementById('close-screen-2'); // Nuevo elemento

let canalesJSON = [];
let pantallaActiva = 1; 

const state = {
    1: {
        hlsInstance: null,
        canalActivo: null,
        els: {
            video: document.getElementById('video-player-1'),
            iframe: document.getElementById('iframe-player-1'),
            placeholder: document.getElementById('player-placeholder-1'),
            name: document.getElementById('current-channel-name-1'),
            status: document.getElementById('current-channel-status-1'),
            badge: document.getElementById('status-badge-1'),
            serverSelect: document.getElementById('server-selector-1')
        }
    },
    2: {
        hlsInstance: null,
        canalActivo: null,
        els: {
            video: document.getElementById('video-player-2'),
            iframe: document.getElementById('iframe-player-2'),
            placeholder: document.getElementById('player-placeholder-2'),
            name: document.getElementById('current-channel-name-2'),
            status: document.getElementById('current-channel-status-2'),
            badge: document.getElementById('status-badge-2'),
            serverSelect: document.getElementById('server-selector-2')
        }
    }
};

async function init() {
    try {
        const response = await fetch('canales.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        canalesJSON = await response.json();
        renderChannels(canalesJSON);
        setupEvents();
    } catch (error) {
        console.error('Error crítico al cargar el archivo canales.json:', error);
        state[1].els.status.textContent = "Error al conectar con la base de datos.";
    }
}

function setupEvents() {
    const toggleSidebarBtn = document.getElementById('toggle-sidebar');
    const sidebarEl = document.getElementById('sidebar');

    toggleSidebarBtn.addEventListener('click', () => {
        sidebarEl.classList.toggle('collapsed');
    });

    searchInput.addEventListener('input', (e) => {
        const termino = e.target.value.toLowerCase().trim();
        const canalesFiltrados = canalesJSON.filter(canal => 
            canal.nombre.toLowerCase().includes(termino) || 
            canal.categoria.toLowerCase().includes(termino)
        );
        renderChannels(canalesFiltrados);
    });

    screenRadioBtns.forEach(radio => {
        radio.addEventListener('change', (e) => {
            pantallaActiva = parseInt(e.target.value);

            if (pantallaActiva === 2) {
                screen2Container.classList.remove('hidden');
                closeScreen2Btn.classList.add('visible');
            }
        });
    });

    closeScreen2Btn.addEventListener('click', () => {

        if (state[2].hlsInstance) {
            state[2].hlsInstance.destroy();
            state[2].hlsInstance = null;
        }
        state[2].els.video.src = "";
        state[2].els.iframe.src = "";
        state[2].canalActivo = null;

        state[2].els.video.classList.remove('visible');
        state[2].els.iframe.classList.remove('visible');
        state[2].els.placeholder.classList.remove('hidden');
        state[2].els.name.textContent = "Pantalla 2: Inactiva";
        state[2].els.status.textContent = "Sistema listo";
        state[2].els.badge.className = "status-badge";
        state[2].els.serverSelect.innerHTML = '<option value="">Selecciona un canal</option>';
        state[2].els.serverSelect.disabled = true;

        screen2Container.classList.add('hidden');
        closeScreen2Btn.classList.remove('visible');

        pantallaActiva = 1;
        document.querySelector('input[name="active-screen"][value="1"]').checked = true;

        renderChannels(canalesJSON);
    });

    [1, 2].forEach(p => {
        state[p].els.serverSelect.addEventListener('change', (e) => {
            if (e.target.value) {
                cambiarFuenteVideo(e.target.value, p);
            }
        });
    });
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

        if ((state[1].canalActivo && state[1].canalActivo.id === canal.id) || 
            (state[2].canalActivo && state[2].canalActivo.id === canal.id)) {
            li.classList.add('active');
        }
        
        li.innerHTML = `
            <div class="channel-item-info">
                <span class="channel-name">${canal.nombre}</span>
                <span class="channel-category">${canal.categoria}</span>
            </div>
            <div class="live-dot"></div>
        `;
        
        li.addEventListener('click', () => {
            cargarCanal(canal, pantallaActiva);
            renderChannels(canalesJSON); 
        });
        
        channelListEl.appendChild(li);
    });
}

function cargarCanal(canal, pId) {
    const s = state[pId];
    s.canalActivo = canal;
    s.els.name.textContent = `Pantalla ${pId}: ${canal.nombre}`;
    s.els.status.textContent = "Conectando al flujo...";
    s.els.badge.className = "status-badge streaming";
    s.els.serverSelect.innerHTML = '';
    s.els.serverSelect.disabled = false;
    
    canal.servidores.forEach(servidor => {
        const option = document.createElement('option');
        option.value = servidor.url;
        option.textContent = servidor.nombre;
        s.els.serverSelect.appendChild(option);
    });

    cambiarFuenteVideo(canal.servidores[0].url, pId);
}

function cambiarFuenteVideo(url, pId) {
    const s = state[pId];
    s.els.placeholder.classList.add('hidden');

    if (s.hlsInstance) {
        s.hlsInstance.destroy();
        s.hlsInstance = null;
    }
    s.els.video.src = "";
    s.els.video.load();
    s.els.iframe.src = "";
    
    s.els.video.classList.remove('visible');
    s.els.iframe.classList.remove('visible');

    const esPaginaWeb = url.includes('.html') || url.includes('?get=') || url.includes('embed') || !url.match(/\.(m3u8|mp4)$/i);

    if (esPaginaWeb) {
        s.els.iframe.classList.add('visible');
        s.els.iframe.src = url;
        s.els.status.textContent = "Transmitiendo mediante Web Player Externo";
    } else {
        s.els.video.classList.add('visible');
        
        if (Hls.isSupported()) {
            s.hlsInstance = new Hls({
                maxMaxBufferLength: 15,
                enableWorker: true
            });
            s.hlsInstance.loadSource(url);
            s.hlsInstance.attachMedia(s.els.video);
            
            s.hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
                s.els.status.textContent = "En Vivo (Directo)";
                s.els.video.play().catch(() => {
                    s.els.status.textContent = "Haga clic en Play para iniciar";
                });
            });

            s.hlsInstance.on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    s.els.status.textContent = "Error en el servidor. Intente otra opción.";
                }
            });
        } 
        else if (s.els.video.canPlayType('application/vnd.apple.mpegurl')) {
            s.els.video.src = url;
            s.els.video.addEventListener('loadedmetadata', () => {
                s.els.status.textContent = "En Vivo (Nativo)";
                s.els.video.play().catch(() => {});
            });
        } 
        else {
            s.els.status.textContent = "Formato no compatible con este navegador.";
        }
    }
}

init();