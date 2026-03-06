const state = {
  settings: null,
  status: null,
  mode: "sender",
  view: "sender",
  deviceInfo: null,
  contextMenuOpen: false,
  collab: {
    serverUrl: "",
    username: "",
    token: "",
    ws: null,
    connected: false,
    avatar: "",
    displayName: "",
    roomScope: "-",
    userDirectory: [],
    pinnedUsers: new Set(),
  },
};

const DEFAULT_TARGET_DOMAINS = [
  "chatgpt.com",
  "openai.com",
  "auth0.com",
  "oaistatic.com",
  "oaiusercontent.com",
  "gravatar.com",
  "cloudflare.com",
  "wp.com",
].join(",");

const SOURCE_LABELS = {
  app: "系统",
  sender: "发送服务",
  receiver: "接收服务",
  collab: "账号服务",
  "receiver-singbox": "接收端",
  "receiver-frpc": "映射服务",
};

const el = (id) => document.getElementById(id);

function safeText(value) {
  return String(value || "").trim();
}

function avatarMark(value, fallbackName = "") {
  const avatar = safeText(value);
  if (avatar) return avatar;
  const name = safeText(fallbackName);
  if (!name) return "?";
  return name[0].toUpperCase();
}

function setAvatarNode(node, value, fallbackName = "") {
  if (!node) return;

  const raw = safeText(value);
  node.textContent = "";

  if (raw && (/^https?:\/\//i.test(raw) || /^data:image\//i.test(raw))) {
    const img = document.createElement("img");
    img.src = raw;
    img.alt = "avatar";
    img.onerror = () => {
      node.textContent = avatarMark("", fallbackName);
    };
    node.appendChild(img);
    return;
  }

  node.textContent = avatarMark(raw, fallbackName);
}

function setTopAvatar(value, fallbackName = "") {
  setAvatarNode(el("topCollabAvatar"), value, fallbackName);
}

function setAccountAvatar(value, fallbackName = "") {
  setAvatarNode(el("c_account_avatar"), value, fallbackName);
}

function setRoomScope(scopeText) {
  const roomScope = safeText(scopeText) || "-";
  state.collab.roomScope = roomScope;
  if (el("c_room_scope")) el("c_room_scope").textContent = roomScope;
  if (el("c_room_channel_scope")) el("c_room_channel_scope").textContent = `房间：${roomScope}`;
}

function syncAccountOverview() {
  const username = safeText(state.collab.username);
  const displayName = safeText(state.collab.displayName) || username;
  const nameNode = el("c_account_name");
  const metaNode = el("c_account_meta");
  const noteNode = el("c_account_note");
  const btnProfile = el("btnAccountProfile");
  const btnLogout = el("btnAccountLogout");

  if (!state.collab.token) {
    if (nameNode) nameNode.textContent = "未登录";
    if (metaNode) metaNode.textContent = "登录后可查看账号信息";
    if (noteNode) noteNode.textContent = "登录成功后，可以修改昵称、头像和简介，让联系人更容易识别你。";
    setAccountAvatar("", "");
    if (btnProfile) btnProfile.disabled = true;
    if (btnLogout) btnLogout.disabled = true;
    return;
  }

  const nameText = displayName && displayName !== username ? `${displayName} (${username})` : (displayName || username || "已登录");
  const statusText = safeText(el("c_conn_state")?.textContent) || (state.collab.connected ? "在线" : "连接中");
  const roomText = safeText(state.collab.roomScope) && state.collab.roomScope !== "-" ? `当前房间：${state.collab.roomScope}` : "当前房间：等待同步";

  if (nameNode) nameNode.textContent = nameText;
  if (metaNode) metaNode.textContent = `${statusText} · ${roomText}`;
  if (noteNode) {
    noteNode.textContent = state.collab.connected
      ? "已连接消息服务，可以前往“联系人与聊天”页面继续沟通。"
      : "账号已登录，正在连接消息服务，请稍候。";
  }
  setAccountAvatar(state.collab.avatar, displayName || username);
  if (btnProfile) btnProfile.disabled = false;
  if (btnLogout) btnLogout.disabled = false;
}

function refreshTopIdentity() {
  const identityWrap = el("topCollabIdentity");
  const nameNode = el("topCollabName");
  const subNode = el("topCollabSub");
  const username = safeText(state.collab.username);
  const displayName = safeText(state.collab.displayName) || username;

  if (!state.collab.token) {
    if (identityWrap) identityWrap.classList.remove("active");
    if (nameNode) nameNode.textContent = "未登录";
    if (subNode) subNode.textContent = "登录后可查看账号信息";
    setTopAvatar("", "");
    syncAccountOverview();
    return;
  }

  if (identityWrap) identityWrap.classList.add("active");

  const nameText = displayName && displayName !== username ? `${displayName} (${username})` : (displayName || username || "已登录");
  const connText = safeText(el("c_conn_state")?.textContent) || (state.collab.connected ? "在线" : "连接中");
  const roomText = safeText(state.collab.roomScope) && state.collab.roomScope !== "-" ? ` · ${state.collab.roomScope}` : "";

  if (nameNode) nameNode.textContent = nameText;
  if (subNode) subNode.textContent = `${connText}${roomText}`;
  setTopAvatar(state.collab.avatar, displayName || username);
  syncAccountOverview();
}

function currentChatScope() {
  return safeText(el("c_chat_scope")?.value) || "subnet";
}

function isCollabOnline() {
  return Boolean(state.collab.token && state.collab.connected);
}

function formatTime(ts) {
  if (!ts) return new Date().toLocaleTimeString();
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? new Date().toLocaleTimeString() : d.toLocaleTimeString();
}

function logLine(source, line) {
  const box = el("logBox");
  if (!box) return;
  const ts = new Date().toLocaleTimeString();
  const sourceLabel = SOURCE_LABELS[source] || source || "系统";
  box.textContent += `[${ts}] [${sourceLabel}] ${line}\n`;
  box.scrollTop = box.scrollHeight;
}

function appendToReceiverSplit(source, line) {
  const ts = new Date().toLocaleTimeString();

  if (source === "receiver-singbox") {
    const box = el("receiverSingboxLog");
    if (!box) return;
    box.textContent += `[${ts}] ${line}\n`;
    box.scrollTop = box.scrollHeight;
    return;
  }

  if (source === "receiver-frpc") {
    const box = el("receiverFrpcLog");
    if (!box) return;
    box.textContent += `[${ts}] ${line}\n`;
    box.scrollTop = box.scrollHeight;
  }
}

function getViewMeta(view) {
  const guest = state.mode === "sender" && !state.collab.token;
  const viewMeta = {
    sender: {
      title: "连接设置",
      subtitle: "填写连接信息后，可开启发送端，让需要的网站通过这台设备访问。",
    },
    receiver: {
      title: "接收端设置",
      subtitle: "接收端用于另一台设备上的连接接收和转发，请按服务端提供的信息填写。",
    },
    logs: {
      title: "运行记录",
      subtitle: "这里会显示程序的运行状态，方便确认连接是否已经启动、停止或出现异常。",
    },
    account: guest
      ? {
          title: "账号登录",
          subtitle: "请先登录账号，登录成功后才能进入发送端主界面并使用连接设置、运行记录和消息功能。",
        }
      : {
          title: "账号与信息",
          subtitle: "在这里登录账号、查看当前状态，并管理你的显示资料。",
        },
    chat: {
      title: "联系人与聊天",
      subtitle: "左侧选择当前房间或联系人，右侧查看消息并继续聊天。",
    },
  };

  return viewMeta[view] || viewMeta.sender;
}

function syncTopbarTitle(view) {
  const titleNode = el("topViewTitle");
  const subTitle = el("subTitle");
  const meta = getViewMeta(view);

  if (titleNode) titleNode.textContent = meta.title;
  if (subTitle) subTitle.textContent = meta.subtitle;
}

function getAvailableViews(mode = state.mode) {
  if (mode === "receiver") return ["receiver", "logs"];
  if (!state.collab.token) return ["account"];
  return ["sender", "logs", "account", "chat"];
}

function setActiveView(view) {
  const availableViews = getAvailableViews();
  const nextView = availableViews.includes(view) ? view : availableViews[0];
  state.view = nextView;
  document.body.dataset.view = nextView;

  document.querySelectorAll("[data-view-panel]").forEach((panel) => {
    panel.classList.toggle("active", panel.getAttribute("data-view-panel") === nextView);
  });

  document.querySelectorAll("[data-view-target]").forEach((button) => {
    button.classList.toggle("active", button.getAttribute("data-view-target") === nextView);
  });

  syncTopbarTitle(nextView);
}

function syncAuthLayout() {
  const guest = state.mode === "sender" && !state.collab.token;
  document.body.dataset.auth = guest ? "guest" : "member";

  const preferredView = guest
    ? "account"
    : (getAvailableViews().includes(state.view) ? state.view : (state.mode === "receiver" ? "receiver" : "sender"));

  setActiveView(preferredView);
}

function refreshSenderAccess() {
  const senderPanel = el("senderPanel");
  if (!senderPanel || state.mode === "receiver") return;

  const senderRunning = Boolean(state.status?.senderRunning);
  const canUseSender = isCollabOnline();
  const hint = el("senderAuthHint");
  const senderInputs = senderPanel.querySelectorAll("input, select, textarea");

  for (const input of senderInputs) {
    const isFallbackPort = input.id === "s_fallback_local_port";
    if (input.id === "s_target_domains") {
      input.readOnly = true;
    }
    if (isFallbackPort && el("s_fallback_mode")?.value === "direct") {
      input.disabled = true;
      continue;
    }
    input.disabled = !canUseSender || senderRunning;
  }

  if (el("btnStartSender")) el("btnStartSender").disabled = senderRunning || !canUseSender;
  if (el("btnSaveSender")) el("btnSaveSender").disabled = !canUseSender;
  if (el("btnStopSender")) el("btnStopSender").disabled = !senderRunning;

  if (hint) {
    hint.style.display = canUseSender ? "none" : "block";
  }
}

function setStatus(status) {
  state.status = status;
  const senderRunning = Boolean(status?.senderRunning);
  const receiverRunning = Boolean(status?.receiverFrpcRunning || status?.receiverSingboxRunning);

  if (el("senderState")) el("senderState").textContent = `发送服务：${senderRunning ? "运行中" : "未开启"}`;
  if (el("receiverState")) el("receiverState").textContent = `接收服务：${receiverRunning ? "运行中" : "未开启"}`;

  if (el("senderDot")) el("senderDot").classList.toggle("running", senderRunning);
  if (el("receiverDot")) el("receiverDot").classList.toggle("running", receiverRunning);

  if (el("btnStartReceiver")) el("btnStartReceiver").disabled = receiverRunning;
  if (el("btnStopReceiver")) el("btnStopReceiver").disabled = !receiverRunning;

  refreshSenderAccess();
}

function applyModeLayout(mode) {
  const uiMode = mode === "receiver" ? "receiver" : "sender";
  state.mode = uiMode;
  document.body.dataset.mode = uiMode;
  syncAuthLayout();
}

function getSenderForm() {
  return {
    proxy_server: safeText(el("s_proxy_server")?.value),
    proxy_port: safeText(el("s_proxy_port")?.value),
    proxy_uuid: safeText(el("s_proxy_uuid")?.value),
    socks_listen_port: safeText(el("s_socks_listen_port")?.value),
    fallback_mode: el("s_fallback_mode")?.value,
    fallback_local_port: safeText(el("s_fallback_local_port")?.value),
    target_domains: DEFAULT_TARGET_DOMAINS,
  };
}

function getReceiverForm() {
  return {
    frps_server: safeText(el("r_frps_server")?.value),
    frps_port: safeText(el("r_frps_port")?.value),
    frps_token: safeText(el("r_frps_token")?.value),
    remote_port: safeText(el("r_remote_port")?.value),
    vmess_listen_port: safeText(el("r_vmess_listen_port")?.value),
    vmess_uuid: safeText(el("r_vmess_uuid")?.value),
    forward_proxy_port: safeText(el("r_forward_proxy_port")?.value),
    tls_enable: Boolean(el("r_tls_enable")?.checked),
    use_compression: Boolean(el("r_use_compression")?.checked),
    use_encryption: Boolean(el("r_use_encryption")?.checked),
  };
}

function getCollabForm() {
  return {
    server_url: safeText(el("c_server_url")?.value),
    last_username: safeText(el("c_username")?.value),
    last_avatar: safeText(state.collab.avatar),
    pinned_users: [...state.collab.pinnedUsers],
  };
}

function fillForm(settings) {
  const sender = settings.sender || {};
  const receiver = settings.receiver || {};
  const collab = settings.collab || {};

  if (el("s_proxy_server")) el("s_proxy_server").value = sender.proxy_server || "";
  if (el("s_proxy_port")) el("s_proxy_port").value = sender.proxy_port || "";
  if (el("s_proxy_uuid")) el("s_proxy_uuid").value = sender.proxy_uuid || "";
  if (el("s_socks_listen_port")) el("s_socks_listen_port").value = sender.socks_listen_port || "";
  if (el("s_fallback_mode")) el("s_fallback_mode").value = sender.fallback_mode || "system_proxy";
  if (el("s_fallback_local_port")) el("s_fallback_local_port").value = sender.fallback_local_port || "";
  if (el("s_target_domains")) {
    el("s_target_domains").value = DEFAULT_TARGET_DOMAINS;
    el("s_target_domains").readOnly = true;
  }

  if (el("r_frps_server")) el("r_frps_server").value = receiver.frps_server || "";
  if (el("r_frps_port")) el("r_frps_port").value = receiver.frps_port || "";
  if (el("r_frps_token")) el("r_frps_token").value = receiver.frps_token || "";
  if (el("r_remote_port")) el("r_remote_port").value = receiver.remote_port || "";
  if (el("r_vmess_listen_port")) el("r_vmess_listen_port").value = receiver.vmess_listen_port || "";
  if (el("r_vmess_uuid")) el("r_vmess_uuid").value = receiver.vmess_uuid || "";
  if (el("r_forward_proxy_port")) el("r_forward_proxy_port").value = receiver.forward_proxy_port || "";
  if (el("r_tls_enable")) el("r_tls_enable").checked = Boolean(receiver.tls_enable);
  if (el("r_use_compression")) el("r_use_compression").checked = Boolean(receiver.use_compression);
  if (el("r_use_encryption")) el("r_use_encryption").checked = Boolean(receiver.use_encryption);

  if (el("c_server_url")) el("c_server_url").value = collab.server_url || "";
  if (el("c_username")) el("c_username").value = collab.last_username || "";
  if (el("c_password")) el("c_password").value = "";

  state.collab.avatar = safeText(collab.last_avatar);
  state.collab.pinnedUsers = new Set(Array.isArray(collab.pinned_users) ? collab.pinned_users.map((item) => safeText(item)).filter(Boolean) : []);

  refreshFallbackVisibility();
}

function applyDeviceInfo(deviceInfo) {
  const info = deviceInfo || {};
  const host = safeText(info.hostname) || "local";
  const preferredIp = safeText(info.preferredIpv4) || "127.0.0.1";

  state.deviceInfo = {
    hostname: host,
    preferredIpv4: preferredIp,
    ipv4List: Array.isArray(info.ipv4List) ? info.ipv4List : [],
  };

  if (el("c_local_info")) {
    el("c_local_info").textContent = `${host} / ${preferredIp}`;
  }
}

function normalizeServerOrigin(raw) {
  const text = safeText(raw);
  if (!text) return "";

  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      const protocol = url.protocol === "https:" ? "https:" : "http:";
      const port = url.port || "8088";
      return `${protocol}//${url.hostname}:${port}`;
    } catch {
      return "";
    }
  }

  return `http://${text}:8088`;
}

async function isServerReachable(serverOrigin, timeoutMs = 1200) {
  const origin = normalizeServerOrigin(serverOrigin);
  if (!origin) return false;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${origin}/api/health`, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function applyTestDefaults() {
  if (!safeText(el("c_server_url")?.value)) {
    el("c_server_url").value = "http://47.113.226.118:8088";
  }

  const currentServer = safeText(el("c_server_url")?.value);
  const localServer = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(currentServer);

  if (localServer) {
    const localOk = await isServerReachable(currentServer, 1200);
    if (!localOk) {
      const senderProxyServer = safeText(el("s_proxy_server")?.value);
      const remoteCandidate = normalizeServerOrigin(senderProxyServer);
      if (remoteCandidate) {
        el("c_server_url").value = remoteCandidate;
      }
    }
  }

  if (!safeText(el("c_username")?.value)) {
    el("c_username").value = "demo_user";
  }
  if (!safeText(el("c_password")?.value)) {
    el("c_password").value = "DemoPass123";
  }
}

async function syncWindowMaxButton() {
  const btn = el("btnWinMax");
  if (!btn) return;
  try {
    const maximized = await window.api.isWindowMaximized();
    btn.dataset.maximized = maximized ? "true" : "false";
    btn.title = maximized ? "恢复窗口" : "最大化";
    btn.setAttribute("aria-label", maximized ? "恢复窗口" : "最大化");
  } catch {
    btn.dataset.maximized = "false";
    btn.title = "最大化";
    btn.setAttribute("aria-label", "最大化");
  }
}
function refreshFallbackVisibility() {
  const direct = el("s_fallback_mode")?.value === "direct";
  if (el("fallbackPortWrap")) el("fallbackPortWrap").style.opacity = direct ? "0.5" : "1";
  if (el("s_fallback_local_port")) el("s_fallback_local_port").disabled = direct;
  if (el("s_target_domains")) el("s_target_domains").readOnly = true;
  refreshSenderAccess();
}

async function saveSettings(options = {}) {
  const silent = Boolean(options.silent);
  state.settings = {
    sender: getSenderForm(),
    receiver: getReceiverForm(),
    collab: getCollabForm(),
  };
  await window.api.saveSettings(state.settings);
  if (!silent) {
    logLine("app", "设置已保存");
  }
}

function setCollabState(text) {
  if (el("c_conn_state")) el("c_conn_state").textContent = text;
  if (el("c_chat_status_badge")) el("c_chat_status_badge").textContent = text;
}

function setCollabFeedback(text = "", tone = "") {
  const node = el("c_feedback");
  if (!node) return;

  const message = safeText(text);
  if (!message) {
    node.hidden = true;
    node.textContent = "";
    delete node.dataset.tone;
    return;
  }

  node.hidden = false;
  node.textContent = message;
  if (tone) {
    node.dataset.tone = tone;
  } else {
    delete node.dataset.tone;
  }
}

function setPanelFeedback(id, text = "", tone = "") {
  const node = el(id);
  if (!node) return;

  const message = safeText(text);
  if (!message) {
    node.hidden = true;
    node.textContent = "";
    delete node.dataset.tone;
    return;
  }

  node.hidden = false;
  node.textContent = message;
  if (tone) {
    node.dataset.tone = tone;
  } else {
    delete node.dataset.tone;
  }
}

function focusCollabField(id, select = false) {
  const node = el(id);
  if (!(node instanceof HTMLInputElement)) return;

  window.setTimeout(() => {
    node.focus();
    if (select) {
      node.select();
    }
  }, 0);
}

function setCollabIdentity(text) {
  if (el("c_me")) el("c_me").textContent = text || "-";
  refreshTopIdentity();
}

function hideContextMenu() {
  const menu = el("appContextMenu");
  if (!menu) return;
  menu.hidden = true;
  menu.textContent = "";
  state.contextMenuOpen = false;
}

function showContextMenu(x, y, items = []) {
  const menu = el("appContextMenu");
  if (!menu || !Array.isArray(items) || !items.length) return;

  if (state.contextMenuOpen) {
    hideContextMenu();
  }

  menu.textContent = "";
  for (const item of items) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = safeText(item?.label) || "操作";
    btn.disabled = Boolean(item?.disabled);
    btn.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      hideContextMenu();
      if (typeof item?.onClick === "function") {
        try {
          await item.onClick();
        } catch (err) {
          logLine("collab", `操作未完成：${err.message || err}`);
        }
      }
    });
    menu.appendChild(btn);
  }

  menu.hidden = false;
  state.contextMenuOpen = true;

  menu.style.left = "0px";
  menu.style.top = "0px";
  const maxLeft = Math.max(8, window.innerWidth - menu.offsetWidth - 8);
  const maxTop = Math.max(8, window.innerHeight - menu.offsetHeight - 8);
  const left = Math.min(Math.max(8, x), maxLeft);
  const top = Math.min(Math.max(8, y), maxTop);

  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

function sortUsers(users) {
  const pinned = state.collab.pinnedUsers;
  return [...users].sort((a, b) => {
    const aPinned = pinned.has(a.username) ? 1 : 0;
    const bPinned = pinned.has(b.username) ? 1 : 0;
    if (aPinned !== bPinned) return bPinned - aPinned;

    const aOnline = a.online ? 1 : 0;
    const bOnline = b.online ? 1 : 0;
    if (aOnline !== bOnline) return bOnline - aOnline;

    return String(a.displayName || a.username).localeCompare(String(b.displayName || b.username));
  });
}

function pickPrivateTarget(username) {
  if (el("c_chat_scope")) {
    el("c_chat_scope").value = "private";
  }
  refreshPrivateTargets();
  if (el("c_chat_target")) {
    el("c_chat_target").value = username;
  }
  syncChatConversation();
  setPanelFeedback("chat_feedback", "");
  if (state.mode !== "receiver" && state.collab.token) {
    setActiveView("chat");
  }
}

function pickRoomConversation() {
  if (el("c_chat_scope")) {
    el("c_chat_scope").value = "subnet";
  }
  if (el("c_chat_target")) {
    el("c_chat_target").value = "";
  }
  syncChatConversation();
  setPanelFeedback("chat_feedback", "");
}

function openFriendActionsMenu(user, event) {
  const username = safeText(user?.username);
  if (!username) return;
  const pinned = state.collab.pinnedUsers.has(username);
  const online = Boolean(user?.online);

  showContextMenu(event.clientX, event.clientY, [
    {
      label: pinned ? "取消置顶" : "置顶该好友",
      onClick: () => togglePinUser(username),
    },
    {
      label: "设为私聊对象",
      disabled: !online || username === state.collab.username,
      onClick: () => {
        pickPrivateTarget(username);
      },
    },
  ]);
}

async function togglePinUser(username) {
  const user = safeText(username);
  if (!user) return;

  if (state.collab.pinnedUsers.has(user)) {
    state.collab.pinnedUsers.delete(user);
    logLine("collab", `已取消置顶: ${user}`);
  } else {
    state.collab.pinnedUsers.add(user);
    logLine("collab", `已置顶: ${user}`);
  }

  await saveSettings({ silent: true });
  renderUserDirectory(state.collab.userDirectory);
  refreshPrivateTargets();
}

function renderUserDirectory(users) {
  const list = el("c_online_list");
  if (!list) return;

  list.textContent = "";
  const sorted = sortUsers(users);
  const onlineCount = sorted.filter((item) => item.online).length;

  if (el("c_online_count")) {
    el("c_online_count").textContent = `${onlineCount} 人在线`;
  }

  if (!sorted.length) {
    const li = document.createElement("li");
    li.textContent = "暂时没有联系人";
    list.appendChild(li);
    syncChatConversation();
    return;
  }

  for (const user of sorted) {
    const username = safeText(user.username);
    const displayName = safeText(user.displayName) || username;
    const avatar = avatarMark(user.avatar, displayName);
    const online = Boolean(user.online);
    const pinned = state.collab.pinnedUsers.has(username);
    const self = username === state.collab.username;
    const selected = currentChatScope() === "private" && safeText(el("c_chat_target")?.value) === username;
    const subnet = safeText(user.subnetLabel || user.subnetKey);
    const subtitleBits = [self ? "当前账号" : username];

    if (subnet) {
      subtitleBits.push(subnet);
    }

    const li = document.createElement("li");
    li.className = `${online ? "online" : "offline"}${pinned ? " pinned" : ""}${selected ? " active" : ""}`;
    li.title = `${username}（左键切换聊天，右键查看更多操作）`;
    li.dataset.username = username;

    const main = document.createElement("div");
    main.className = "user-main";

    const avatarNode = document.createElement("span");
    avatarNode.className = "contact-avatar";
    avatarNode.textContent = avatar;

    const copy = document.createElement("div");
    copy.className = "contact-copy";

    const name = document.createElement("strong");
    const pinMark = pinned ? "置顶 · " : "";
    name.textContent = `${pinMark}${displayName}`;

    const meta = document.createElement("span");
    meta.textContent = subtitleBits.join(" · ");

    const badge = document.createElement("span");
    badge.className = `user-badge ${online ? "" : "off"}`;
    badge.textContent = self ? "自己" : (online ? "在线" : "离线");

    copy.appendChild(name);
    copy.appendChild(meta);
    main.appendChild(avatarNode);
    main.appendChild(copy);
    li.appendChild(main);
    li.appendChild(badge);

    li.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (self) {
        setPanelFeedback("chat_feedback", "当前账号就是你自己，不需要给自己发私聊消息。", "error");
        return;
      }
      if (!online) {
        setPanelFeedback("chat_feedback", "对方当前不在线，暂时无法发起私聊。", "error");
        return;
      }
      pickPrivateTarget(username);
    });

    li.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openFriendActionsMenu(user, event);
    });

    list.appendChild(li);
  }

  syncChatConversation();
}

function setUserDirectory(users) {
  const items = Array.isArray(users) ? users : [];
  state.collab.userDirectory = items.map((item) => ({
    username: safeText(item?.username),
    displayName: safeText(item?.displayName) || safeText(item?.username),
    avatar: safeText(item?.avatar),
    online: Boolean(item?.online),
    subnetKey: safeText(item?.subnetKey),
    subnetLabel: safeText(item?.subnetLabel),
  })).filter((item) => item.username);

  renderUserDirectory(state.collab.userDirectory);
  refreshPrivateTargets();
}

function setCollabControls() {
  const connected = Boolean(state.collab.connected);
  const hasToken = Boolean(state.collab.token);
  const hasServerUrl = Boolean(safeText(el("c_server_url")?.value));
  const hasUsername = Boolean(safeText(el("c_username")?.value));
  const canLogin = hasServerUrl && hasUsername;

  if (el("btnCollabLogin")) el("btnCollabLogin").disabled = hasToken || !canLogin;
  if (el("btnCollabLogout")) el("btnCollabLogout").disabled = !hasToken;
  if (el("btnAccountProfile")) el("btnAccountProfile").disabled = !hasToken;
  if (el("btnAccountLogout")) el("btnAccountLogout").disabled = !hasToken;
  if (el("btnChatSend")) el("btnChatSend").disabled = !connected;
  if (el("c_chat_input")) el("c_chat_input").disabled = !connected;
  if (el("c_chat_scope")) el("c_chat_scope").disabled = !connected;
  if (el("c_password")) el("c_password").disabled = hasToken;
  if (el("c_server_url")) el("c_server_url").disabled = hasToken;
  if (el("c_username")) el("c_username").disabled = hasToken;

  if (!hasToken && !connected && !hasServerUrl) {
    setCollabState("请填写服务地址");
  }

  refreshPrivateTargets();
  refreshSenderAccess();
  refreshTopIdentity();
  syncAuthLayout();
}

function clearServiceFeedback(panel) {
  if (panel === "sender") {
    setPanelFeedback("s_feedback", "");
    return;
  }
  if (panel === "receiver") {
    setPanelFeedback("r_feedback", "");
  }
}

function refreshPrivateTargets() {
  const target = el("c_chat_target");
  if (!target) return;

  const oldValue = target.value;
  const scope = currentChatScope();
  const online = sortUsers(state.collab.userDirectory || []).filter((item) => item.online && item.username !== state.collab.username);

  target.textContent = "";

  if (!online.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "当前没有可聊天的联系人";
    target.appendChild(option);
  } else {
    const first = document.createElement("option");
    first.value = "";
    first.textContent = "请选择联系人";
    target.appendChild(first);

    for (const item of online) {
      const option = document.createElement("option");
      option.value = item.username;
      option.textContent = `${avatarMark(item.avatar, item.displayName)} ${item.displayName}`;
      target.appendChild(option);
    }
  }

  if (oldValue && online.some((item) => item.username === oldValue)) {
    target.value = oldValue;
  }

  target.disabled = !isCollabOnline() || scope !== "private";
  syncChatConversation();
}

function syncChatConversation() {
  const scope = currentChatScope();
  const targetUsername = safeText(el("c_chat_target")?.value);
  const selectedUser = (state.collab.userDirectory || []).find((item) => item.username === targetUsername);
  const titleNode = el("c_chat_title");
  const subNode = el("c_chat_subtitle");
  const roomButton = el("c_room_channel");
  const inRoom = scope !== "private";

  if (roomButton) {
    roomButton.classList.toggle("active", inRoom);
  }

  document.querySelectorAll("#c_online_list li[data-username]").forEach((item) => {
    item.classList.toggle("active", !inRoom && item.getAttribute("data-username") === targetUsername);
  });

  if (inRoom) {
    const roomScope = safeText(state.collab.roomScope);
    if (titleNode) titleNode.textContent = "当前房间";
    if (subNode) {
      subNode.textContent = roomScope && roomScope !== "-"
        ? `发送给房间 ${roomScope} 内的所有在线联系人`
        : "发送给当前房间内的所有在线联系人";
    }
    return;
  }

  if (!targetUsername) {
    if (titleNode) titleNode.textContent = "请选择联系人";
    if (subNode) subNode.textContent = "从左侧联系人列表中选择一个在线联系人后，就可以开始私聊。";
    return;
  }

  if (!selectedUser) {
    if (titleNode) titleNode.textContent = targetUsername;
    if (subNode) subNode.textContent = "对方当前不在线，暂时不能继续私聊。";
    return;
  }

  const subnet = safeText(selectedUser.subnetLabel || selectedUser.subnetKey);
  const detailBits = [
    selectedUser.online ? "在线" : "离线",
    selectedUser.username,
  ];
  if (subnet) {
    detailBits.push(subnet);
  }

  if (titleNode) titleNode.textContent = safeText(selectedUser.displayName) || selectedUser.username;
  if (subNode) subNode.textContent = detailBits.join(" · ");
}

function appendChatMessage(payload) {
  const box = el("c_chat_box");
  if (!box) return;

  const row = document.createElement("div");
  const username = safeText(payload?.username || payload?.from) || "系统通知";
  const displayName = safeText(payload?.displayName) || username;
  const avatar = avatarMark(payload?.avatar, displayName);
  const rawFrom = safeText(payload?.from || payload?.username);
  const isSystem = username === "系统通知";
  const isSelf = !isSystem && rawFrom && rawFrom === state.collab.username;
  row.className = `chat-item${isSelf ? " self" : ""}${isSystem ? " system" : ""}`;

  const avatarNode = document.createElement("div");
  avatarNode.className = "chat-avatar";
  avatarNode.textContent = avatar;

  const wrap = document.createElement("div");
  wrap.className = "chat-bubble-wrap";

  const meta = document.createElement("div");
  meta.className = "meta";
  const scope = safeText(payload?.scope) === "private" ? "私聊消息" : "房间消息";
  const target = safeText(payload?.to);
  const toText = target ? ` -> ${target}` : "";
  const whoText = isSystem ? "系统通知" : (isSelf ? `我${toText}` : `${displayName}${toText}`);
  meta.textContent = `${formatTime(payload?.timestamp)} · ${scope} · ${whoText}`;

  const bubble = document.createElement("div");
  bubble.className = "chat-bubble";
  bubble.textContent = safeText(payload?.text);

  wrap.appendChild(meta);
  wrap.appendChild(bubble);
  row.appendChild(avatarNode);
  row.appendChild(wrap);
  box.appendChild(row);
  box.scrollTop = box.scrollHeight;
}

function renderHistory(messages) {
  const box = el("c_chat_box");
  if (!box) return;
  box.textContent = "";
  const items = Array.isArray(messages) ? messages : [];
  for (const msg of items) {
    appendChatMessage(msg);
  }
}

function closeCollabSocket() {
  if (state.collab.ws) {
    try {
      state.collab.ws.onopen = null;
      state.collab.ws.onmessage = null;
      state.collab.ws.onerror = null;
      state.collab.ws.onclose = null;
      state.collab.ws.close();
    } catch {
      // ignore
    }
  }
  state.collab.ws = null;
  state.collab.connected = false;
  setRoomScope("-");
}

function toWsUrl(httpUrl) {
  const raw = safeText(httpUrl);
  const normalized = raw.replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(normalized)) {
    throw new Error("服务地址需要以 http:// 或 https:// 开头");
  }
  if (normalized.startsWith("https://")) {
    return `wss://${normalized.slice("https://".length)}/ws`;
  }
  return `ws://${normalized.slice("http://".length)}/ws`;
}

async function fetchWithFriendlyError(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error(`连接超时：${url}`);
    }

    const message = String(err?.message || err || "");
    if (/failed to fetch/i.test(message)) {
      if (/127\.0\.0\.1|localhost/i.test(url)) {
        throw new Error(`无法连接到服务地址：${url}。如果这里填的是本机地址，请先确认本机服务已经启动；如果服务在其他电脑上，请改成那台电脑的地址和端口。`);
      }
      throw new Error(`无法连接到服务地址：${url}。请确认服务已经启动，地址和端口填写正确，并且网络可以访问。`);
    }

    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function refreshUserDirectory() {
  if (!state.collab.serverUrl || !state.collab.token) return;
  try {
    const response = await fetchWithFriendlyError(`${state.collab.serverUrl}/api/users`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${state.collab.token}`,
      },
    }, 6000);

    if (!response.ok) return;
    const payload = await response.json();
    setUserDirectory(payload.users || []);
  } catch (err) {
    logLine("collab", `刷新在线联系人失败：${err.message || err}`);
  }
}

async function collabLogout(notifyServer) {
  const serverUrl = state.collab.serverUrl;
  const token = state.collab.token;

  closeCollabSocket();

  if (notifyServer && serverUrl && token) {
    try {
      await fetchWithFriendlyError(`${serverUrl}/api/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }, 5000);
    } catch {
      // ignore
    }
  }

  state.collab.token = "";
  state.collab.username = "";
  state.collab.displayName = "";
  state.collab.avatar = "";
  state.collab.connected = false;
  if (el("c_chat_scope")) el("c_chat_scope").value = "subnet";
  if (el("c_chat_target")) el("c_chat_target").value = "";
  setCollabState("未登录");
  setCollabFeedback("");
  setPanelFeedback("chat_feedback", "");
  setCollabIdentity("-");
  setUserDirectory([]);
  setCollabControls();
  hideContextMenu();
}

function connectCollabWebSocket() {
  const wsUrl = `${toWsUrl(state.collab.serverUrl)}?token=${encodeURIComponent(state.collab.token)}`;
  const ws = new WebSocket(wsUrl);
  state.collab.ws = ws;
  setCollabState("连接中");

  ws.onopen = () => {
    state.collab.connected = true;
    setCollabState("在线");
    setCollabControls();
    refreshTopIdentity();
    refreshUserDirectory();
    logLine("collab", "账号连接已建立");
  };

  ws.onmessage = (event) => {
    let payload;
    try {
      payload = JSON.parse(String(event.data || "{}"));
    } catch {
      return;
    }

    if (payload.type === "presence") {
      if (payload.roomScope) {
        setRoomScope(payload.roomScope);
      }
      refreshUserDirectory();
      return;
    }

    if (payload.type === "history") {
      renderHistory(payload.messages || []);
      if (payload.roomScope) {
        setRoomScope(payload.roomScope);
      }
      return;
    }

    if (payload.type === "session") {
      const me = safeText(payload.username);
      if (me) {
        state.collab.username = me;
      }
      const displayName = safeText(payload.displayName);
      state.collab.displayName = displayName || state.collab.username;
      state.collab.avatar = safeText(payload.avatar) || state.collab.avatar;
      if (payload.roomScope) {
        setRoomScope(payload.roomScope);
      }
      setCollabIdentity(state.collab.displayName || state.collab.username);
      refreshTopIdentity();
      return;
    }

    if (payload.type === "chat") {
      appendChatMessage(payload);
      return;
    }

    if (payload.type === "system") {
      appendChatMessage({ username: "系统通知", text: payload.text, timestamp: payload.timestamp, scope: payload.scope || "subnet" });
      return;
    }

    if (payload.type === "error") {
      appendChatMessage({ username: "系统通知", text: payload.text, timestamp: payload.timestamp, scope: "private" });
    }
  };

  ws.onerror = () => {
    logLine("collab", "账号连接异常");
  };

  ws.onclose = () => {
    state.collab.connected = false;
    if (state.collab.token) {
      setCollabState("连接断开");
    } else {
      setCollabState("未登录");
    }
    setCollabControls();
    refreshTopIdentity();
    logLine("collab", "账号连接已关闭");
  };
}

async function collabLogin() {
  const serverUrl = safeText(el("c_server_url")?.value).replace(/\/+$/, "");
  const username = safeText(el("c_username")?.value);
  const password = String(el("c_password")?.value || "");

  if (!serverUrl || !username || !password) {
    throw new Error("请先填写完整的服务地址、账号和密码");
  }

  if (!/^https?:\/\//i.test(serverUrl)) {
    throw new Error("服务地址需要以 http:// 或 https:// 开头");
  }

  setCollabState("登录中");

  const response = await fetchWithFriendlyError(`${serverUrl}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  }, 10000);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `登录失败（${response.status}）`);
  }

  const payload = await response.json();
  if (!payload?.token) {
    throw new Error("登录未成功，请稍后重试");
  }

  state.collab.serverUrl = serverUrl;
  state.collab.username = username;
  state.collab.token = payload.token;
  state.collab.avatar = safeText(payload?.profile?.avatar) || state.collab.avatar;
  state.collab.displayName = safeText(payload?.profile?.displayName) || username;
  setRoomScope(payload?.roomScope);

  setCollabIdentity(state.collab.displayName || username);
  refreshTopIdentity();

  await saveSettings({ silent: true });
  renderHistory(payload.history || []);
  setUserDirectory(payload.users || payload.onlineUsers || []);
  setCollabFeedback("登录成功，可以开始使用主界面了。", "success");
  state.view = "sender";
  setCollabControls();
  connectCollabWebSocket();
}

function sendChatMessage() {
  if (!state.collab.connected || !state.collab.ws || state.collab.ws.readyState !== WebSocket.OPEN) {
    setPanelFeedback("chat_feedback", "当前还没有连上消息服务，请稍后再试。", "error");
    return;
  }

  const input = el("c_chat_input");
  const text = safeText(input?.value);
  if (!text) return;

  const scope = currentChatScope();
  const target = safeText(el("c_chat_target")?.value);
  if (scope === "private" && !target) {
    setPanelFeedback("chat_feedback", "请先从左侧联系人列表中选择一个在线联系人。", "error");
    return;
  }

  state.collab.ws.send(
    JSON.stringify({
      type: "chat",
      scope,
      to: scope === "private" ? target : "",
      text,
    }),
  );

  if (input) input.value = "";
  setPanelFeedback("chat_feedback", "");
}

async function openProfileEditor() {
  if (!state.collab.token) {
    setCollabFeedback("请先登录账号，再打开个人资料。", "error");
    return;
  }

  await window.api.openProfileEditor({
    serverUrl: state.collab.serverUrl,
    token: state.collab.token,
    username: state.collab.username,
  });
}

async function handleProfileUpdated(payload) {
  const profile = payload?.profile || {};
  const username = safeText(profile.username) || state.collab.username;
  if (username && username === state.collab.username) {
    state.collab.displayName = safeText(profile.displayName) || username;
    state.collab.avatar = safeText(profile.avatar) || state.collab.avatar;
    setCollabIdentity(state.collab.displayName);
    refreshTopIdentity();
    await saveSettings({ silent: true });
  }
  await refreshUserDirectory();
}

async function main() {
  window.api.onLog(({ source, line }) => {
    if (!line) return;
    String(line)
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((item) => {
        logLine(source, item);
        appendToReceiverSplit(source, item);
      });
  });

  window.api.onStatus((status) => setStatus(status));
  window.api.onProfileUpdated((payload) => {
    handleProfileUpdated(payload).catch((err) => {
      logLine("collab", `个人资料刷新失败：${err.message || err}`);
    });
  });

  document.querySelectorAll("[data-view-target]").forEach((button) => {
    button.addEventListener("click", () => {
      setActiveView(button.getAttribute("data-view-target") || "");
    });
  });

  if (el("s_fallback_mode")) {
    el("s_fallback_mode").addEventListener("change", refreshFallbackVisibility);
  }

  if (el("senderPanel")) {
    el("senderPanel").querySelectorAll("input, select, textarea").forEach((node) => {
      node.addEventListener("input", () => clearServiceFeedback("sender"));
      node.addEventListener("change", () => clearServiceFeedback("sender"));
    });
  }

  if (el("receiverPanel")) {
    el("receiverPanel").querySelectorAll("input, select, textarea").forEach((node) => {
      node.addEventListener("input", () => clearServiceFeedback("receiver"));
      node.addEventListener("change", () => clearServiceFeedback("receiver"));
    });
  }

  if (el("btnSaveSender")) {
    el("btnSaveSender").addEventListener("click", async () => {
      if (!isCollabOnline()) {
        setPanelFeedback("s_feedback", "请先登录账号，并保持在线后再保存连接设置。", "error");
        return;
      }
      await saveSettings();
      setPanelFeedback("s_feedback", "连接设置已保存。", "success");
    });
  }

  if (el("btnSaveReceiver")) {
    el("btnSaveReceiver").addEventListener("click", async () => {
      await saveSettings();
      setPanelFeedback("r_feedback", "接收端设置已保存。", "success");
    });
  }

  if (el("btnStartSender")) {
    el("btnStartSender").addEventListener("click", async () => {
      try {
        if (!isCollabOnline()) {
          throw new Error("请先登录账号，再开启发送服务");
        }
        await saveSettings();
        await window.api.startSender(getSenderForm());
        logLine("sender", "发送服务已开启。");
        setPanelFeedback("s_feedback", "发送服务已开启。", "success");
      } catch (err) {
        logLine("sender", `开启失败：${err.message || err}`);
        setPanelFeedback("s_feedback", err.message || String(err), "error");
      }
    });
  }

  if (el("btnStopSender")) {
    el("btnStopSender").addEventListener("click", async () => {
      await window.api.stopSender();
      logLine("sender", "已发送停止指令");
      setPanelFeedback("s_feedback", "已发送停止指令，请稍候查看状态是否更新。", "success");
    });
  }

  if (el("btnStartReceiver")) {
    el("btnStartReceiver").addEventListener("click", async () => {
      try {
        await saveSettings();
        await window.api.startReceiver(getReceiverForm());
        logLine("receiver", "接收服务已开启。");
        setPanelFeedback("r_feedback", "接收服务已开启。", "success");
      } catch (err) {
        logLine("receiver", `开启失败：${err.message || err}`);
        setPanelFeedback("r_feedback", err.message || String(err), "error");
      }
    });
  }

  if (el("btnStopReceiver")) {
    el("btnStopReceiver").addEventListener("click", async () => {
      await window.api.stopReceiver();
      logLine("receiver", "已发送停止指令");
      setPanelFeedback("r_feedback", "已发送停止指令，请稍候查看状态是否更新。", "success");
    });
  }

  if (el("btnClearLog")) {
    el("btnClearLog").addEventListener("click", () => {
      if (el("logBox")) el("logBox").textContent = "";
      if (el("receiverSingboxLog")) el("receiverSingboxLog").textContent = "";
      if (el("receiverFrpcLog")) el("receiverFrpcLog").textContent = "";
      if (el("c_chat_box")) el("c_chat_box").textContent = "";
    });
  }

  if (el("btnCollabLogin")) {
    el("btnCollabLogin").addEventListener("click", async () => {
      try {
        await collabLogin();
        logLine("collab", "登录成功");
        if (el("c_password")) el("c_password").value = "";
      } catch (err) {
        const message = err.message || String(err);
        setCollabState("登录失败");
        setCollabControls();
        setCollabFeedback(message, "error");
        logLine("collab", `登录失败：${message}`);
        focusCollabField("c_password", true);
      }
    });
  }

  ["c_server_url", "c_username", "c_password"].forEach((id) => {
    const input = el(id);
    if (!input) return;
    input.addEventListener("input", () => {
      if (!state.collab.token && !state.collab.connected && !safeText(el("c_server_url")?.value)) {
        setCollabState("请填写服务地址");
      }
      if (!state.collab.token) {
        setCollabFeedback("");
      }
      setCollabControls();
    });
  });

  if (el("topCollabIdentity")) {
    el("topCollabIdentity").addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      showContextMenu(event.clientX, event.clientY, [
        {
          label: "修改个人资料",
          disabled: !state.collab.token,
          onClick: () => openProfileEditor(),
        },
        {
          label: "退出登录",
          disabled: !state.collab.token,
          onClick: async () => {
            await collabLogout(true);
            logLine("collab", "已退出登录");
          },
        },
      ]);
    });
  }

  if (el("btnCollabLogout")) {
    el("btnCollabLogout").addEventListener("click", async () => {
      await collabLogout(true);
      logLine("collab", "已退出登录");
    });
  }

  if (el("btnAccountProfile")) {
    el("btnAccountProfile").addEventListener("click", () => {
      openProfileEditor().catch((err) => {
        setCollabFeedback(err.message || String(err), "error");
      });
    });
  }

  if (el("btnAccountLogout")) {
    el("btnAccountLogout").addEventListener("click", async () => {
      await collabLogout(true);
      logLine("collab", "已退出登录");
    });
  }

  document.addEventListener("click", () => {
    if (state.contextMenuOpen) hideContextMenu();
  });

  document.addEventListener("contextmenu", (event) => {
    if (!state.contextMenuOpen) return;
    const target = event.target;
    const insideMenu = target instanceof Element && Boolean(target.closest("#appContextMenu"));
    const fromUserItem = target instanceof Element && Boolean(target.closest("#c_online_list li"));
    const fromTopIdentity = target instanceof Element && Boolean(target.closest("#topCollabIdentity"));
    if (!insideMenu && !fromUserItem && !fromTopIdentity) {
      hideContextMenu();
    }
  });

  document.addEventListener("scroll", () => {
    if (state.contextMenuOpen) hideContextMenu();
  }, true);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.contextMenuOpen) {
      hideContextMenu();
    }
  });

  window.addEventListener("blur", () => {
    if (state.contextMenuOpen) hideContextMenu();
  });

  window.addEventListener("resize", () => {
    if (state.contextMenuOpen) hideContextMenu();
  });

  if (el("c_chat_scope")) {
    el("c_chat_scope").addEventListener("change", () => {
      refreshPrivateTargets();
      setPanelFeedback("chat_feedback", "");
    });
  }

  if (el("c_room_channel")) {
    el("c_room_channel").addEventListener("click", () => {
      pickRoomConversation();
    });
  }

  if (el("btnChatSend")) {
    el("btnChatSend").addEventListener("click", sendChatMessage);
  }

  if (el("c_chat_input")) {
    el("c_chat_input").addEventListener("input", () => {
      setPanelFeedback("chat_feedback", "");
    });
    el("c_chat_input").addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        sendChatMessage();
      }
    });
  }

  if (el("btnWinMin")) {
    el("btnWinMin").addEventListener("click", () => {
      window.api.minimizeWindow();
    });
  }

  if (el("btnWinMax")) {
    el("btnWinMax").addEventListener("click", async () => {
      await window.api.toggleMaximizeWindow();
      await syncWindowMaxButton();
    });
  }

  if (el("btnWinClose")) {
    el("btnWinClose").addEventListener("click", () => {
      window.api.closeWindow();
    });
  }

  const mode = await window.api.getMode();
  applyModeLayout(mode || "sender");
  await syncWindowMaxButton();

  const settings = await window.api.loadSettings();
  state.settings = settings;
  fillForm(settings);

  const deviceInfo = await window.api.getDeviceInfo();
  applyDeviceInfo(deviceInfo);
  await applyTestDefaults();

  state.collab.serverUrl = safeText(el("c_server_url")?.value).replace(/\/+$/, "");
  state.collab.username = safeText(el("c_username")?.value);
  setCollabState(state.collab.serverUrl ? "未登录" : "请填写服务地址");
  setRoomScope("-");
  setCollabIdentity("-");
  refreshTopIdentity();
  setUserDirectory([]);
  setCollabControls();

  await window.api.getPaths();
  logLine("app", "程序已准备好，可以开始使用。");

  const status = await window.api.getStatus();
  setStatus(status);
}

main().catch((err) => {
  logLine("app", `程序启动失败：${err.message || err}`);
});


