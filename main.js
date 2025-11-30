/**
 * LiteFox Core Logic
 * Version: 2.2 (Final)
 */

let requests = []; 
let activeReqId = null; 
// 用于防止 URL <-> Table 循环更新的锁
let isInternalUpdate = false; 

// 记录底部调试抽屉的高度，默认 300
let lastDrawerHeight = 300; 

document.addEventListener('DOMContentLoaded', () => {
    // 1. 初始化主题
    initTheme();
    
    // 2. 从 LocalStorage 加载上次的数据
    loadFromStorage();

    // 3. Tab 选项卡切换逻辑
    document.querySelectorAll('.tab').forEach(t => {
        t.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
            document.querySelectorAll('.panel').forEach(x => x.classList.remove('active'));
            t.classList.add('active');
            document.getElementById(t.dataset.target).classList.add('active');
        });
    });

    // 4. 底部调试面板：折叠/展开 + 动画
    const drawer = document.getElementById('debugDrawer');
    document.getElementById('drawerToggle').addEventListener('click', () => {
        drawer.classList.add('animating'); // 添加过渡动画类
        if (drawer.classList.contains('collapsed')) {
            // 展开
            drawer.classList.remove('collapsed');
            drawer.style.height = lastDrawerHeight + 'px';
        } else {
            // 收起
            drawer.classList.add('collapsed');
        }
        // 动画结束后移除类，避免影响拖拽
        setTimeout(() => drawer.classList.remove('animating'), 300);
    });

    // 初始化拖拽手柄
    initResizeHandle();

    // 5. 绑定主要按钮事件
    document.getElementById('themeBtn').addEventListener('click', toggleTheme);
    document.getElementById('addReqBtn').addEventListener('click', createNewRequest);
    document.getElementById('sendBtn').addEventListener('click', sendRequest);
    // 点击保存：强制刷新侧边栏
    document.getElementById('saveBtn').addEventListener('click', () => saveCurrentRequestData(true)); 
    document.getElementById('importCurlBtn').addEventListener('click', parseCurl);
    
    // 添加参数/Header 按钮
    document.getElementById('addParamBtn').addEventListener('click', () => {
        addKvRow('paramsList');
        syncTableToUrl(); // 添加行后尝试同步 URL
    });
    document.getElementById('addHeaderBtn').addEventListener('click', () => addKvRow('headersList'));

    // 6. 监听 URL 输入 (实现 URL -> Table 解析)
    const urlInput = document.getElementById('url');
    urlInput.addEventListener('input', () => {
        if (isInternalUpdate) return;
        parseUrlToParamsTable(urlInput.value);
        // 静默保存，不刷新侧边栏
        saveCurrentRequestData(false); 
    });

    // 监听 Method 变化
    document.getElementById('method').addEventListener('change', () => {
        saveCurrentRequestData(false);
    });

    // 7. 事件委托：处理动态生成的“删除按钮”和“输入框变化”
    const delegateHandler = (e) => {
        if (e.target.classList.contains('del-btn')) {
            const containerId = e.target.parentElement.parentElement.id;
            e.target.parentElement.remove();
            // 如果删除了 Params 里的行，需要同步回 URL
            if (containerId === 'paramsList') syncTableToUrl();
        }
    };
    const inputHandler = (e) => {
        if (e.target.classList.contains('kv-input')) {
            const containerId = e.target.parentElement.parentElement.id;
            // Params 表格内容变化，同步回 URL
            if (containerId === 'paramsList') syncTableToUrl();
        }
    };

    const pList = document.getElementById('paramsList');
    const hList = document.getElementById('headersList');
    
    pList.addEventListener('click', delegateHandler);
    hList.addEventListener('click', delegateHandler);
    pList.addEventListener('input', inputHandler);

    // 8. 快捷键支持
    document.addEventListener('keydown', (e) => {
        // Ctrl + S (保存)
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveCurrentRequestData(true);
            // 简单视觉反馈
            const saveBtn = document.getElementById('saveBtn');
            const originalText = saveBtn.innerText;
            saveBtn.innerText = '已保存';
            setTimeout(() => saveBtn.innerText = originalText, 1000);
        }
        // Ctrl + Enter (发送)
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            sendRequest();
        }
    });

    // 如果加载完数据还是空的，创建一个默认请求
    if (requests.length === 0) {
        createNewRequest();
    }
});

// ==========================================
// 数据持久化 (LocalStorage)
// ==========================================
function saveToStorage() {
    const data = {
        requests: requests,
        activeReqId: activeReqId,
        lastDrawerHeight: lastDrawerHeight
    };
    localStorage.setItem('litefox_v2_data', JSON.stringify(data));
}

function loadFromStorage() {
    const raw = localStorage.getItem('litefox_v2_data');
    if (raw) {
        try {
            const data = JSON.parse(raw);
            requests = data.requests || [];
            activeReqId = data.activeReqId || null;
            if (data.lastDrawerHeight) lastDrawerHeight = data.lastDrawerHeight;
            
            if (requests.length > 0) {
                renderRequestList();
                // 恢复之前的选中状态
                if (activeReqId) {
                    switchRequest(activeReqId, false);
                } else {
                    switchRequest(requests[0].id, false);
                }
            }
        } catch (e) {
            console.error('Failed to load data', e);
        }
    }
}

// ==========================================
// 底部抽屉拖拽逻辑
// ==========================================
function initResizeHandle() {
    const handle = document.getElementById('resizeHandle');
    const drawer = document.getElementById('debugDrawer');
    let isResizing = false;
    let startY = 0;
    let startHeight = 0;

    handle.addEventListener('mousedown', (e) => {
        isResizing = true;
        startY = e.clientY;
        startHeight = parseInt(getComputedStyle(drawer).height, 10);
        
        // 锁定鼠标样式，防止选中文本
        document.body.style.cursor = 'ns-resize';
        document.body.style.userSelect = 'none';
        handle.classList.add('resizing');
        
        // 如果是折叠状态，拖动时自动展开
        if (drawer.classList.contains('collapsed')) drawer.classList.remove('collapsed');
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        // 向上拖动 clientY 减小，高度增加
        const dy = startY - e.clientY;
        const newHeight = startHeight + dy;
        
        // 限制最大最小高度
        if (newHeight > 35 && newHeight < window.innerHeight - 100) {
            drawer.style.height = `${newHeight}px`;
        }
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            handle.classList.remove('resizing');
            
            // 记住这次的高度
            lastDrawerHeight = parseInt(drawer.style.height, 10);
            saveToStorage(); 
        }
    });
}

// ==========================================
// 主题控制
// ==========================================
function initTheme() {
    const isDark = localStorage.getItem('theme') === 'dark';
    if (isDark) document.body.classList.add('dark-mode');
}

function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

// ==========================================
// 核心：发送网络请求
// ==========================================
async function sendRequest() {
    // 发送前保存当前状态，并刷新侧边栏（更新 Method 颜色等）
    saveCurrentRequestData(true);
    
    const btn = document.getElementById('sendBtn');
    const statusEl = document.getElementById('resStatus');
    const bodyEl = document.getElementById('resBody');
    const debugReqEl = document.getElementById('debugReq');
    const debugResEl = document.getElementById('debugRes');

    const req = requests.find(r => r.id === activeReqId);
    if (!req || !req.url) return;

    // 确保 URL 完整
    let finalUrl = req.url;
    if (!finalUrl.startsWith('http')) finalUrl = 'http://' + finalUrl;
    
    // 构造 Headers 对象
    const headers = {};
    req.headers.forEach(h => headers[h.key] = h.value);

    // 构造 Body
    let body = null;
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.bodyType !== 'none') {
        body = req.bodyContent;
    }

    // 1. 渲染实际请求报文预览
    renderDebugRequest(req.method, finalUrl, headers, body);

    // UI 状态更新
    btn.disabled = true;
    btn.innerText = '...';
    bodyEl.innerHTML = '<div style="padding:10px; color:var(--text-sec)">Loading...</div>';
    statusEl.innerText = 'Sending...';
    debugResEl.innerText = 'Waiting...';

    const t0 = performance.now();

    try {
        // 利用 Chrome Extension 权限发起跨域请求
        const res = await fetch(finalUrl, {
            method: req.method,
            headers: headers,
            body: body
        });
        
        const t1 = performance.now();
        document.getElementById('resTime').innerText = (t1 - t0).toFixed(0) + 'ms';
        
        statusEl.innerText = `${res.status} ${res.statusText}`;
        statusEl.style.color = res.ok ? 'var(--success)' : 'var(--danger)';

        const text = await res.text();
        
        // 2. 渲染响应报文预览
        renderDebugResponse(res, text);

        // 3. 尝试解析 JSON 并高亮
        try {
            const json = JSON.parse(text);
            bodyEl.innerHTML = syntaxHighlight(json);
        } catch {
            // 不是 JSON，显示纯文本
            bodyEl.innerText = text;
        }

    } catch (err) {
        statusEl.innerText = 'Error';
        statusEl.style.color = 'var(--danger)';
        bodyEl.innerText = err.message;
        debugResEl.innerText = `[Network Error]\n${err.message}`;
    } finally {
        btn.disabled = false;
        btn.innerText = '发送';
    }
}

// ==========================================
// 辅助功能：JSON 语法高亮
// ==========================================
function syntaxHighlight(json) {
    if (typeof json != 'string') {
        json = JSON.stringify(json, undefined, 2);
    }
    // HTML 转义
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    // 正则匹配 JSON 结构并包裹 span
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
        var cls = 'number';
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'key';
            } else {
                cls = 'string';
            }
        } else if (/true|false/.test(match)) {
            cls = 'boolean';
        } else if (/null/.test(match)) {
            cls = 'null';
        }
        return '<span class="' + cls + '">' + match + '</span>';
    });
}

// ==========================================
// 辅助功能：调试面板渲染
// ==========================================
function renderDebugRequest(method, url, headers, body) {
    const urlObj = new URL(url);
    let raw = `${method} ${urlObj.pathname}${urlObj.search} HTTP/1.1\n`;
    raw += `Host: ${urlObj.host}\n`;
    Object.keys(headers).forEach(k => {
        raw += `${k}: ${headers[k]}\n`;
    });
    if (body) raw += `\n${body}`;
    document.getElementById('debugReq').innerText = raw;
}

function renderDebugResponse(res, bodyText) {
    let raw = `HTTP/1.1 ${res.status} ${res.statusText}\n`;
    res.headers.forEach((val, key) => {
        raw += `${key}: ${val}\n`;
    });
    // 截断过长内容，防止渲染卡顿
    const displayBody = bodyText.length > 5000 ? bodyText.substring(0, 5000) + '\n... (truncated for debug view)' : bodyText;
    raw += `\n${displayBody}`;
    document.getElementById('debugRes').innerText = raw;
}

// ==========================================
// 核心逻辑：URL <-> Params 表格双向绑定
// ==========================================
function parseUrlToParamsTable(urlStr) {
    if (!urlStr) return;
    const parts = urlStr.split('?');
    if (parts.length < 2) return;
    
    const queryString = parts[1];
    const searchParams = new URLSearchParams(queryString);
    
    isInternalUpdate = true; // 锁住
    const container = document.getElementById('paramsList');
    container.innerHTML = '';
    searchParams.forEach((value, key) => {
        addKvRow('paramsList', key, value);
    });
    isInternalUpdate = false; // 解锁
}

function syncTableToUrl() {
    if (isInternalUpdate) return;
    
    const urlInput = document.getElementById('url');
    let currentUrl = urlInput.value.trim();
    // 临时基础 URL 用于拼接
    let baseUrl = currentUrl.split('?')[0];
    
    const params = getKvDataArray('paramsList');
    if (params.length > 0) {
        const qs = params.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&');
        urlInput.value = `${baseUrl}?${qs}`;
    } else {
        urlInput.value = baseUrl;
    }
    
    // 同步后静默保存
    saveCurrentRequestData(false);
}

// ==========================================
// UI 操作：添加表格行
// ==========================================
function addKvRow(containerId, key = '', value = '') {
    const container = document.getElementById(containerId);
    const div = document.createElement('div');
    div.className = 'kv-row';
    div.innerHTML = `
        <input type="text" class="kv-input key" placeholder="Key" value="${key}">
        <input type="text" class="kv-input value" placeholder="Value" value="${value}">
        <button class="del-btn" title="删除">×</button>
    `;
    container.appendChild(div);
}

// ==========================================
// 请求管理 (CRUD)
// ==========================================
function createNewRequest() {
    // 切换前保存
    if (activeReqId) saveCurrentRequestData(true);

    const id = Date.now();
    const newReq = {
        id: id, name: 'New Request', method: 'GET', url: '',
        params: [], headers: [], bodyType: 'none', bodyContent: '',
    };
    requests.push(newReq);
    
    saveToStorage(); // 立即持久化
    renderRequestList();
    switchRequest(id, false); 
}

function renderRequestList() {
    const list = document.getElementById('requestList');
    list.innerHTML = ''; 
    requests.forEach(req => {
        const item = document.createElement('div');
        item.className = `req-item ${req.id === activeReqId ? 'active' : ''}`;
        item.dataset.id = req.id; 
        
        item.addEventListener('click', () => switchRequest(req.id, true));
        
        // 显示逻辑：优先显示 URL，没有则显示默认名
        let displayUrl = req.url ? req.url.split('?')[0].replace(/^https?:\/\//, '') : 'New Request';
        if (!displayUrl) displayUrl = 'New Request';
        if(displayUrl.length > 20) displayUrl = displayUrl.substring(0, 20) + '...';

        item.innerHTML = `
            <span class="req-method ${req.method}">${req.method}</span>
            <span class="req-name" title="${req.url || ''}">${displayUrl}</span>
        `;
        
        const delSpan = document.createElement('span');
        delSpan.innerHTML = '×';
        delSpan.style.marginLeft = 'auto';
        delSpan.onclick = (e) => { 
            e.stopPropagation(); 
            deleteRequest(req.id); 
        };
        item.appendChild(delSpan);
        list.appendChild(item);
    });
}

function deleteRequest(id) {
    if (requests.length <= 1) return; // 至少保留一个
    requests = requests.filter(r => r.id !== id);
    if (id === activeReqId) {
        switchRequest(requests[0].id, false);
    } else {
        renderRequestList();
    }
    saveToStorage();
}

function switchRequest(id, shouldSaveCurrent = true) {
    if (shouldSaveCurrent && activeReqId) saveCurrentRequestData(true);
    
    activeReqId = id;
    const req = requests.find(r => r.id === id);
    if(!req) return;

    renderRequestList();
    
    isInternalUpdate = true;
    fillFormFromData(req, true); // 填充表单
    isInternalUpdate = false;
    
    saveToStorage(); // 记住当前激活项
}

// 将内存数据填充到 UI
function fillFormFromData(req, clearCurlBox = true) {
    document.getElementById('method').value = req.method;
    document.getElementById('url').value = req.url;
    
    // 填充 Params
    const pList = document.getElementById('paramsList');
    pList.innerHTML = '';
    req.params.forEach(p => addKvRow('paramsList', p.key, p.value));
    if(req.params.length === 0) addKvRow('paramsList');

    // 填充 Headers
    const hList = document.getElementById('headersList');
    hList.innerHTML = '';
    req.headers.forEach(h => addKvRow('headersList', h.key, h.value));
    if(req.headers.length === 0) addKvRow('headersList');

    // 填充 Body
    const radios = document.getElementsByName('bodyType');
    radios.forEach(r => r.checked = (r.value === req.bodyType));
    document.getElementById('bodyContent').value = req.bodyContent || '';
    
    // 切换请求时，通常清空 cURL 框
    if (clearCurlBox) document.getElementById('curlInput').value = ''; 

    // 重置响应区
    document.getElementById('resStatus').innerText = '---';
    document.getElementById('resTime').innerText = '0ms';
    document.getElementById('resBody').innerText = '';
    document.getElementById('debugReq').innerText = 'Waiting...';
    document.getElementById('debugRes').innerText = 'Waiting...';
}

// 将 UI 数据保存到内存
function saveCurrentRequestData(rerenderList = true) {
    if (!activeReqId) return;
    const req = requests.find(r => r.id === activeReqId);
    if (!req) return;

    req.method = document.getElementById('method').value;
    req.url = document.getElementById('url').value;
    req.params = getKvDataArray('paramsList');
    req.headers = getKvDataArray('headersList');
    
    document.getElementsByName('bodyType').forEach(r => { 
        if(r.checked) req.bodyType = r.value; 
    });
    req.bodyContent = document.getElementById('bodyContent').value;
    
    if (rerenderList) renderRequestList();
    
    saveToStorage(); // 实时保存
}

function getKvDataArray(containerId) {
    const arr = [];
    document.querySelectorAll(`#${containerId} .kv-row`).forEach(row => {
        const k = row.querySelector('.key').value.trim();
        const v = row.querySelector('.value').value.trim();
        if (k) arr.push({ key: k, value: v });
    });
    return arr;
}

// ==========================================
// 工具：cURL 解析
// ==========================================
function parseCurl() {
    const rawCurl = document.getElementById('curlInput').value.trim();
    if (!rawCurl) return; 
    // 处理换行
    let curl = rawCurl.replace(/\\\n/g, ' ').replace(/[\r\n]+/g, ' ');

    try {
        const req = requests.find(r => r.id === activeReqId);
        
        // 解析 URL
        let urlMatch = curl.match(/(['"])(https?:\/\/.*?)\1/) || curl.match(/(https?:\/\/[^\s]+)/); 
        if (urlMatch) {
            const fullUrlStr = urlMatch[2] || urlMatch[1];
            try {
                const urlObj = new URL(fullUrlStr);
                req.url = fullUrlStr; 
                req.params = [];
                urlObj.searchParams.forEach((val, key) => req.params.push({ key, value: val }));
            } catch(e) { req.url = fullUrlStr; }
        }

        // 解析 Method
        const methodMatch = curl.match(/-X\s+([A-Z]+)/) || curl.match(/--request\s+([A-Z]+)/);
        if (methodMatch) req.method = methodMatch[1];
        else if (curl.includes('--data') || curl.includes('-d ')) req.method = 'POST';
        else req.method = 'GET';

        // 解析 Headers
        req.headers = [];
        const headerRegex = /(?:-H|--header)\s+(['"])(.*?)\1/g;
        let hMatch;
        while ((hMatch = headerRegex.exec(curl)) !== null) {
            const headerContent = hMatch[2]; 
            const splitIndex = headerContent.indexOf(':');
            if (splitIndex > 0) req.headers.push({ key: headerContent.substring(0, splitIndex).trim(), value: headerContent.substring(splitIndex + 1).trim() });
        }

        // 解析 Body
        const bodyRegex = /(?:--data-raw|--data|-d)\s+(['"])([\s\S]*?)\1/;
        const dataMatch = curl.match(bodyRegex);
        if (dataMatch) {
            const bodyStr = dataMatch[2];
            req.bodyContent = bodyStr;
            try { 
                JSON.parse(bodyStr); 
                req.bodyType = 'json'; 
                if (!req.headers.some(h => h.key.toLowerCase() === 'content-type')) {
                    req.headers.push({ key: 'Content-Type', value: 'application/json' }); 
                }
            } catch { 
                req.bodyType = 'raw'; 
            }
        }

        // 解析后更新界面，但不清空 curl 框
        isInternalUpdate = true;
        fillFormFromData(req, false); 
        isInternalUpdate = false;
        
        // 自动切回 Params tab
        document.querySelector('.tab[data-target="tab-params"]').click();
        
        saveToStorage(); // 解析也是一种修改，保存
    } catch (e) { 
        console.error("解析失败", e); 
    }
}