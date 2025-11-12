import InputValidator from './inputValidator.js';

const USE_MOCK = true;
const BACKEND_URL = window.BACKEND_URL || '/fcgi-bin/app.jar';
const STORAGE_KEY = 'results_v1';

class NotificationManager {
    show(message, opts = {}) {
        if (window.Toastify) {
            Toastify({ text: message, duration: opts.duration || 2200 }).showToast();
        } else {
            console.log('NOTIFY:', message);
        }
    }
}
const notificationManager = new NotificationManager();

function safeParseJSON(s) { try { return JSON.parse(s); } catch (e) { return null; } }
function isValidNumber(n) { return typeof n === 'number' && isFinite(n); }

function normalizeNumber(n) {
    if (typeof n !== 'number' || !isFinite(n)) return n;
    let s = n.toString();
    if (s.includes('e') || !s.includes('.')) {
        return Number(s);
    }
    s = s.replace(/(\.\d*?[1-9])0+$/,'$1');
    s = s.replace(/\.0+$/,'');
    return Number(s);
}

function sanitizeNumericStringUnlimited(s) {
    if (typeof s !== 'string') return '';
    const m = s.match(/-?\d*\.?\d*/);
    return m ? m[0] : '';
}

/* ---------- measureExecutionTimeNs (همان تابع بالا) ---------- */
function measureExecutionTimeNs(fn, opts = {}) {
    const warmup = Number.isFinite(opts.warmup) ? Math.max(0, opts.warmup) : 100;
    const minMs = Number.isFinite(opts.minMs) ? Math.max(5, opts.minMs) : 40;
    const batch = Number.isFinite(opts.batch) ? Math.max(1, Math.floor(opts.batch)) : 256;
    const maxIterations = Number.isFinite(opts.maxIterations) ? opts.maxIterations : 5e7;

    for (let i = 0; i < warmup; i++) fn();

    let iterations = 0;
    let funcTotalMs = 0;
    while (funcTotalMs < minMs && iterations < maxIterations) {
        const toRun = Math.min(batch, maxIterations - iterations);
        const t0 = performance.now();
        for (let i = 0; i < toRun; i++) fn();
        const t1 = performance.now();
        funcTotalMs += (t1 - t0);
        iterations += toRun;
        if (iterations >= 1_000_000 && funcTotalMs > 1000) break;
    }

    if (iterations === 0) return 0;

    let overheadMs = 0;
    let done = 0;
    while (done < iterations) {
        const toRun = Math.min(batch, iterations - done);
        const t0 = performance.now();
        for (let i = 0; i < toRun; i++) { /* noop */ }
        const t1 = performance.now();
        overheadMs += (t1 - t0);
        done += toRun;
    }

    let netMs = funcTotalMs - overheadMs;
    if (!isFinite(netMs) || netMs <= 0) {
        netMs = funcTotalMs;
    }
    const avgMs = netMs / iterations;
    const avgNs = avgMs * 1_000_000;
    return avgNs;
}
/* ---------- end measureExecutionTimeNs ---------- */

function displayMessage(message) {
    const errorBox = document.getElementById('error');
    if (!errorBox) return;
    if (!message) {
        errorBox.style.display = 'none';
        errorBox.textContent = '';
        return;
    }
    errorBox.textContent = message;
    errorBox.style.display = 'block';
}

function isPointInArea(x, y, R) {
    if (!isFinite(x) || !isFinite(y) || !isFinite(R) || R <= 0) return false;
    const eps = 1e-9;
    const isRect = (x >= -eps) && (x <= R + eps) && (y >= -eps) && (y <= R / 2 + eps);
    if (isRect && (x >= -eps && y >= -eps)) return true;
    const isTriangle = (x >= -eps) && (x <= R + eps) && (y <= eps) && (y >= (-R + x) - eps);
    if (isTriangle && (x >= -eps && y <= eps)) return true;
    const isCircle = (x <= eps) && (y <= eps) && ((x * x + y * y) <= (R * R + eps));
    if (isCircle && (x <= eps && y <= eps)) return true;
    return false;
}

function formatNs(ns) {
    if (!isFinite(ns)) return 'N/A';
    const n = Number(ns);
    if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(3) + ' s';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(3) + ' ms';
    if (n >= 1000) return (n / 1000).toFixed(3) + ' µs';
    return Math.round(n) + ' ns';
}

/* بقیه توابع load/save/add/graph بدون تغییر خاص (همانند قبلی) */
function loadStoredResults() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = safeParseJSON(raw);
    if (!Array.isArray(parsed)) return [];
    const good = parsed.map(r => {
        const x = Number(r.x);
        const y = Number(r.y);
        const rr = Number(r.r ?? r.R ?? r.radius);
        const isIn = !!(r.isInArea || r.inArea);
        const currentTime = r.currentTime || r.time || new Date().toLocaleString();
        const executionTime = isFinite(Number(r.executionTime)) ? Number(r.executionTime) : 0;
        return { x, y, r: rr, isInArea: Boolean(isIn), currentTime, executionTime };
    }).filter(item => isValidNumber(item.x) && isValidNumber(item.y) && isValidNumber(item.r))
      .map(item => ({
        x: normalizeNumber(item.x),
        y: normalizeNumber(item.y),
        r: normalizeNumber(item.r),
        isInArea: !!item.isInArea,
        currentTime: item.currentTime,
        executionTime: Number(item.executionTime) || 0
      }));
    return good;
}

function saveResultsToStorage(arr) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); } catch (e) { console.error('Error saving to localStorage', e); }
}

function getSVGVisualMetrics() {
    const svg = document.querySelector('svg');
    const svgW = Number(svg?.getAttribute('width')) || svg?.clientWidth || 300;
    const svgH = Number(svg?.getAttribute('height')) || svg?.clientHeight || 300;
    const centerX = svgW / 2;
    const centerY = svgH / 2;
    return { centerX, centerY, pixelR: 100 };
}

function clearGraphPoints() {
    try {
        const svg = document.querySelector('svg');
        if (svg) {
            const added = svg.querySelectorAll('.point-group, .point-in, .point-out, .point-label');
            added.forEach(n => n.remove());
        }
    } catch (e) { console.warn('clearGraphPoints svg error', e); }
}

function addPointToGraph(x, y, r, isInArea) {
    const svg = document.querySelector('svg');
    const metrics = getSVGVisualMetrics();
    const pixelR = metrics.pixelR;
    const centerX = metrics.centerX;
    const centerY = metrics.centerY;
    const rInput = (isFinite(r) && Math.abs(r) > 1e-12) ? r : 1;
    const scale = pixelR / Math.abs(rInput);
    const svgX = centerX + (x * scale);
    const svgY = centerY - (y * scale);
    if (svg) {
        try {
            const ns = 'http://www.w3.org/2000/svg';
            const g = document.createElementNS(ns, 'g'); g.classList.add('point-group');
            const circle = document.createElementNS(ns, 'circle');
            circle.setAttribute('cx', svgX); circle.setAttribute('cy', svgY); circle.setAttribute('r', '4');
            circle.setAttribute('class', isInArea ? 'point-in' : 'point-out');
            circle.style.fill = isInArea ? 'rgba(0,200,120,0.95)' : 'rgba(220,40,60,0.95)';
            circle.style.stroke = '#0a0a0a';
            circle.style.strokeWidth = '1px';
            circle.setAttribute('opacity', '0'); circle.style.transition = 'opacity .35s ease-in-out';
            g.appendChild(circle);
            svg.appendChild(g);
            setTimeout(() => circle.setAttribute('opacity', '1'), 40);
        } catch (e) { console.warn('addPointToGraph svg error', e); }
    }
}

function renderResultsTable(results) {
    const tbody = document.getElementById('output');
    if (!tbody) return;
    if (!Array.isArray(results) || results.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#666">Нет сохраненных результатов</td></tr>';
        return;
    }
    const rows = results.slice().reverse().map(r => {
        const execDisplay = formatNs(r.executionTime);
        const time = r.currentTime || '';
        const resultClass = (r.isInArea) ? 'result-cell-in' : 'result-cell-out';
        const resultText = r.isInArea ? 'Попал!' : 'Не попал!';
        return `<tr>
<td>${r.x}</td>
<td>${r.y}</td>
<td>${r.r}</td>
<td><span class="${resultClass}">${resultText}</span></td>
<td>${time}</td>
<td>${execDisplay}</td>
</tr>`;
    }).join('');
    tbody.innerHTML = rows;
}

function pushResultAndRender(result) {
    const normalized = {
        x: normalizeNumber(Number(result.x)),
        y: normalizeNumber(Number(result.y)),
        r: normalizeNumber(Number(result.r)),
        isInArea: !!result.isInArea,
        currentTime: result.currentTime || new Date().toLocaleString(),
        executionTime: isFinite(Number(result.executionTime)) ? Number(result.executionTime) : 0
    };
    const arr = loadStoredResults();
    arr.push(normalized);
    saveResultsToStorage(arr);
    renderResultsTable(arr);
    try { addPointToGraph(normalized.x, normalized.y, normalized.r, normalized.isInArea); } catch (e) { console.warn(e); }
}

function clearAllResultsUIAndStorage() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('session');
    clearGraphPoints();
    renderResultsTable([]);
    notificationManager.show('Все данные удалены');
}

function setupUIHandlers() {
    const validator = new InputValidator();

    const xInput = document.getElementById('x');
    if (xInput) {
        xInput.addEventListener('input', function (e) {
            const sanitized = sanitizeNumericStringUnlimited(e.target.value);
            if (e.target.value !== sanitized) e.target.value = sanitized;
            e.target.classList.toggle('input-invalid', e.target.value.trim() === '');
        });
        xInput.addEventListener('blur', function (e) {
            e.target.classList.toggle('input-invalid', !validator.validateXInput(e.target.value));
        });
    }

    const rInput = document.getElementById('r');
    if (rInput) {
        const handleRChange = (event) => {
            let value = sanitizeNumericStringUnlimited(event.target.value);
            if (event.target.value !== value) event.target.value = value;
            const isValid = validator.validateRInput(value);
            event.target.classList.toggle('input-invalid', !isValid);
        };
        rInput.addEventListener('input', handleRChange);
        rInput.addEventListener('blur', handleRChange);
    }

    const deleteBtn = document.getElementById('delete-btn');
    if (deleteBtn) deleteBtn.addEventListener('click', () => {
        if (window.confirm('Вы уверены, что хотите удалить все данные?')) clearAllResultsUIAndStorage();
    });

    const form = document.getElementById('data-form');
    if (form) {
        form.addEventListener('submit', async (ev) => {
            ev.preventDefault(); ev.stopPropagation();
            displayMessage('');
            if (window._lastSubmit && (Date.now() - window._lastSubmit) < 600) return;
            window._lastSubmit = Date.now();
            const submitBtn = document.getElementById('check-btn') || ev.submitter || document.querySelector('input[type="submit"]');
            if (submitBtn) { submitBtn.disabled = true; submitBtn.value = 'Отправка...'; }

            const xEl = document.getElementById('x');
            const yRadio = document.querySelector('input[name="yVal"]:checked');
            const rEl = document.getElementById('r');

            const xStr = (xEl.value || '').trim();
            const rStr = (rEl.value || '').trim();

            let errorMessage = '';
            if (!yRadio) { errorMessage = 'Пожалуйста, выберите значение для Y.'; }
            if (!errorMessage && !validator.validateXInput(xStr)) { errorMessage = validator.getMessage(); }
            if (!errorMessage && !validator.validateRInput(rStr)) { errorMessage = validator.getMessage(); }
            if (errorMessage) {
                displayMessage(errorMessage);
                if (submitBtn) { submitBtn.disabled = false; submitBtn.value = 'Проверить'; }
                return;
            }

            const yStr = yRadio.value;
            const xVal = parseFloat(xStr);
            const yVal = parseFloat(yStr);
            const rVal = parseFloat(rStr);

            // استفاده از measureExecutionTimeNs برای محاسبه دقیق (ns)
            const execNs = Math.round(measureExecutionTimeNs(() => {
                return isPointInArea(xVal, yVal, rVal);
            }, { warmup: 100, minMs: 40, batch: 256 }));

            const resultObj = {
                x: normalizeNumber(xVal),
                y: normalizeNumber(yVal),
                r: normalizeNumber(rVal),
                isInArea: !!isPointInArea(xVal, yVal, rVal),
                currentTime: new Date().toLocaleString(),
                executionTime: execNs
            };

            pushResultAndRender(resultObj);

            if (!USE_MOCK) {
                try {
                    const params = new URLSearchParams();
                    params.append('xVal', resultObj.x);
                    params.append('yVal', resultObj.y);
                    params.append('rVal', resultObj.r);
                    params.append('sessionId', localStorage.getItem('sessionId') || (function(){
                        const sid = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                        localStorage.setItem('sessionId', sid); return sid;
                    })());
                    // optionally send client's exec time too
                    params.append('clientExecNs', String(resultObj.executionTime));

                    const resp = await fetch(BACKEND_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: params.toString()
                    });
                    if (resp.ok) { notificationManager.show('Результат ارسال شد'); }
                } catch (err) { console.warn('Error sending to backend', err); }
            }

            if (submitBtn) { submitBtn.disabled = false; submitBtn.value = 'Проверить'; }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const arr = loadStoredResults();
    clearGraphPoints();
    renderResultsTable(arr);
    arr.forEach(r => { try { addPointToGraph(r.x, r.y, r.r, r.isInArea); } catch (err) { console.warn(err); } });
    setupUIHandlers();
});
