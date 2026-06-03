//                                                    | |       | |       (_)      
//                                                  __| |  ___  | |_  ___  _   ___ 
//                                                 / _` | / _ \ | __|/ __|| | / __|
//                                              _ | (_| || (_) || |_ \__ \| || (__ 
//                                             (_) \__,_| \___/  \__||___/|_| \___|
let appConfig = {
    sizes: [],
    babyLookTriggers: [],
    noiseWords: [],
    specialChars: []
};

async function loadConfig() {
    const btn = document.getElementById('btnProcessar');
    
    try {
        const response = await fetch('config.json');
        if (!response.ok) throw new Error("Não foi possível carregar o config.json");
        
        appConfig = await response.json();
        console.log("Configurações carregadas com sucesso!");
        
        if(btn) {
            btn.disabled = false;
            btn.innerText = "Processar Lista";
        }
    } catch (err) {
        console.error("Erro ao carregar configurações, usando fallback:", err);
        appConfig = {
            sizes: ["6M", "T1", "T2", "T4", "T6", "T8", "T10", "T12", "T14", "PP", "P", "M", "G", "GG", "XG", "XGG", "S1"],
            babyLookTriggers: ["BBL", "BL", "BABY", "BABYLOOK", "LOOK", "BB"],
            noiseWords: ["T", "TAM", "TAMANHO", "TM", "PARA", "DE", "QUER", "UN", "CAMISA", "CAMISETA", "UNIDADE", "TAM.", "*", "."],
            specialChars: [".", "_", "-", "@", "#", "$"]
        };
        if(btn) btn.disabled = false;
    }
}

loadConfig();

function processList() {
    const rawInput = document.getElementById('inputList').value;
    const lines = rawInput.split('\n').filter(l => l.trim() !== "");
    const container = document.getElementById('tableBody');
    
    if (lines.length === 0) return alert("Insira uma lista para processar.");
    container.innerHTML = "";

    lines.forEach(line => {
        let words = line.trim().split(/\s+/);
        let detectedSize = "", detectedModel = "Padrão", nameParts = [];

        words.forEach(word => {
            let cleanWord = word.toUpperCase().replace(/[,:;]/g, "");
            
            const num = parseInt(cleanWord);
            if (!isNaN(cleanWord) && cleanWord !== "" && num > 0 && num <= 14) {
                cleanWord = "T" + num;
            }

            if (appConfig.sizes.includes(cleanWord)) {
                if (!detectedSize) detectedSize = cleanWord;
            } else if (appConfig.babyLookTriggers.includes(cleanWord)) {
                detectedModel = "Baby Look";
            } else if (!appConfig.noiseWords.includes(cleanWord)) {
                nameParts.push(word);
            }
        });

        const finalName = nameParts.join(" ").replace(/^[\s\-]+|[\s\-]+$/g, "");
        renderRow(line, finalName, detectedSize, detectedModel);
    });

    updateCounter();
}

function renderRow(originalLine, name, size, model) {
    const container = document.getElementById('tableBody');
    
    const hasSpecial = new RegExp(`[${appConfig.specialChars.map(c => '\\' + c).join('')}]`).test(name);
    const needsReview = (!size || name === "" || hasSpecial);
    
    const statusLabel = needsReview ? "REVISÃO" : "OK";
    const statusClass = needsReview ? "status-rev" : "status-ok";
    const warningClass = needsReview ? "input-warning" : "";
    const modelClass = model === "Baby Look" ? "mode-baby" : "";

    const html = `
        <div class="order-row">
            <div class="col-original" title="${originalLine}">${originalLine}</div>
            <div><input type="text" class="edit-name ${warningClass}" value="${name}" onkeyup="revalidateRow(this)"></div>
            <div>
                <select class="sel-size" onchange="revalidateRow(this)">
                    <option value="">?</option>
                    ${appConfig.sizes.map(s => `<option value="${s}" ${size === s ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
            </div>
            <div>
                <select class="sel-mod ${modelClass}" onchange="updateModelStyle(this)">
                    <option value="Padrão" ${model === 'Padrão' ? 'selected' : ''}>PADRÃO</option>
                    <option value="Baby Look" ${model === 'Baby Look' ? 'selected' : ''}>BABY LOOK</option>
                </select>
            </div>
            <div><span class="status-pill ${statusClass}">${statusLabel}</span></div>
        </div>`;
        
    container.insertAdjacentHTML('beforeend', html);
}

function updateModelStyle(el) {
    el.className = 'sel-mod ' + (el.value === 'Baby Look' ? 'mode-baby' : '');
}

function revalidateRow(el) {
    const row = el.closest('.order-row');
    const input = row.querySelector('.edit-name');
    const sizeSelect = row.querySelector('.sel-size');
    const badge = row.querySelector('.status-pill');
    
    const name = input.value;
    const size = sizeSelect.value;
    const hasSpecial = new RegExp(`[${appConfig.specialChars.map(c => '\\' + c).join('')}]`).test(name);
    const needsReview = (name === "" || size === "" || hasSpecial);

    if (needsReview) {
        input.classList.add('input-warning');
        badge.textContent = "REVISÃO";
        badge.className = "status-pill status-rev";
    } else {
        input.classList.remove('input-warning');
        badge.textContent = "OK";
        badge.className = "status-pill status-ok";
    }
}

function exportToExcel() {
    const rows = document.querySelectorAll('.order-row');
    if (rows.length === 0) return alert("Processe uma lista primeiro!");

    let standard = [], babyLook = [], review = [];

    rows.forEach(row => {
        const name = row.querySelector('.edit-name').value;
        const size = row.querySelector('.sel-size').value;
        const model = row.querySelector('.sel-mod').value;
        const status = row.querySelector('.status-pill').textContent;
        
        const item = [name, size];
        if (status === "REVISÃO") review.push(item);
        else if (model === "Baby Look") babyLook.push(item);
        else standard.push(item);
    });

    const sortByConfig = (a, b) => {
        const idxA = appConfig.sizes.indexOf(a[1]);
        const idxB = appConfig.sizes.indexOf(b[1]);
        return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
    };

    standard.sort(sortByConfig);
    babyLook.sort(sortByConfig);

    const data = [
        ["BÁSICAS", "", "", "BABY LOOK", "", "", "REVISÃO"],
        ["NOME", "TAMANHO", "", "NOME", "TAMANHO", "", "NOME", "TAMANHO"]
    ];

    const maxLines = Math.max(standard.length, babyLook.length, review.length);
    for (let i = 0; i < maxLines; i++) {
        data.push([
            standard[i]?.[0] || "", standard[i]?.[1] || "", "",
            babyLook[i]?.[0] || "", babyLook[i]?.[1] || "", "",
            review[i]?.[0] || "", review[i]?.[1] || ""
        ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Liste de Nomes");
    XLSX.writeFile(wb, "Lista_de_Nomes.xlsx");
}

function updateCounter() {
    const count = document.querySelectorAll('.order-row:not([style*="display: none"])').length;
    const counterEl = document.getElementById('itemCounter');
    if(counterEl) counterEl.textContent = `${count} pedido(s) visível(is)`;
}

function filterTable() {
    const term = document.getElementById('searchInput').value.toUpperCase();
    document.querySelectorAll('.order-row').forEach(row => {
        row.style.display = row.innerText.toUpperCase().includes(term) ? "grid" : "none";
    });
    updateCounter();
}
