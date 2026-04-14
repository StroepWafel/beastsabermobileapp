let current = null;

let outDir = null;



const el = (id) => document.getElementById(id);

const FOLDER_PATH_IDS = ['folderPathRelay', 'folderPathReceive', 'folderPathImport'];

function syncFolderPathDisplays() {
  const text = outDir || 'Not set.';
  FOLDER_PATH_IDS.forEach((id) => {
    const node = el(id);
    if (node) node.textContent = text;
  });
}

const STORAGE_LAN_ALLOW_AUTO = 'beastsaber.lanAllowAutoDownload';

const STORAGE_EXTRACT_ZIPS = 'beastsaber.extractZipsAfterDownload';

const STORAGE_DELETE_ZIPS = 'beastsaber.deleteZipsAfterExtract';



function collectSettings() {

  return {

    outDir,

    extractZips: el('chkExtractZips')?.checked === true,

    deleteZipsAfterExtract: el('chkDeleteZipsAfterExtract')?.checked === true,

    lanAllowAutoDownload: el('lanAllowAutoDownload')?.checked === true,

    relayAllowAutoDownload: el('relayAllowAutoDownload')?.checked === true,

    plTitle: el('plTitle')?.value ?? 'My list',

    plAuthor: el('plAuthor')?.value ?? 'BSLink',

    relayUrl: el('relayUrl')?.value ?? ''

  };

}



function saveSettings() {

  if (!window.bs?.setSettings) return;

  window.bs.setSettings(collectSettings());

}



let saveDebounce;

function scheduleSaveSettings() {

  clearTimeout(saveDebounce);

  saveDebounce = setTimeout(saveSettings, 300);

}



/** One-time migration from older localStorage prefs into settings.json */

function migrateLocalStorageOnce() {

  if (localStorage.getItem('beastsaber.settingsMigrated') === '1') return null;

  const patch = {};

  if (localStorage.getItem(STORAGE_LAN_ALLOW_AUTO) === '1') patch.lanAllowAutoDownload = true;

  if (localStorage.getItem(STORAGE_EXTRACT_ZIPS) === '1') patch.extractZips = true;

  if (localStorage.getItem(STORAGE_DELETE_ZIPS) === '1') patch.deleteZipsAfterExtract = true;

  localStorage.setItem('beastsaber.settingsMigrated', '1');

  return Object.keys(patch).length ? patch : null;

}



function applySettingsToUi(s) {

  outDir = s.outDir || null;

  syncFolderPathDisplays();



  const ex = el('chkExtractZips');

  const del = el('chkDeleteZipsAfterExtract');

  if (ex) ex.checked = !!s.extractZips;

  if (del) {

    del.checked = !!s.deleteZipsAfterExtract;

    del.disabled = !ex?.checked;

  }



  const lan = el('lanAllowAutoDownload');

  if (lan) lan.checked = !!s.lanAllowAutoDownload;

  const relayAuto = el('relayAllowAutoDownload');

  if (relayAuto) relayAuto.checked = !!s.relayAllowAutoDownload;



  if (el('plTitle')) el('plTitle').value = s.plTitle || 'My list';

  if (el('plAuthor')) el('plAuthor').value = s.plAuthor || 'BSLink';

  if (el('relayUrl')) el('relayUrl').value = s.relayUrl || 'https://bsrelay.stroepwafel.au';



  refreshButtons();

}



const STORAGE_ACTIVE_TAB = 'beastsaber.activeTab';

function initTabs() {
  const tabRelay = el('tab-relay');
  const tabReceive = el('tab-receive');
  const tabImport = el('tab-import');
  const panelRelay = el('panel-relay');
  const panelReceive = el('panel-receive');
  const panelImport = el('panel-import');
  if (!tabRelay || !tabReceive || !tabImport || !panelRelay || !panelReceive || !panelImport) return;

  const tabs = [tabRelay, tabReceive, tabImport];
  const panels = [panelRelay, panelReceive, panelImport];
  const TAB_KEYS = ['relay', 'receive', 'import'];

  function switchTab(index) {
    const i = ((index % 3) + 3) % 3;
    tabs.forEach((t, j) => {
      const active = j === i;
      t.classList.toggle('is-active', active);
      t.setAttribute('aria-selected', active ? 'true' : 'false');
      t.tabIndex = active ? 0 : -1;
    });
    panels.forEach((p, j) => {
      if (j === i) p.removeAttribute('hidden');
      else p.setAttribute('hidden', '');
    });
    try {
      localStorage.setItem(STORAGE_ACTIVE_TAB, TAB_KEYS[i]);
    } catch (_) {
      /* ignore */
    }
  }

  tabRelay.addEventListener('click', () => switchTab(0));
  tabReceive.addEventListener('click', () => switchTab(1));
  tabImport.addEventListener('click', () => switchTab(2));

  let saved;
  try {
    saved = localStorage.getItem(STORAGE_ACTIVE_TAB);
  } catch (_) {
    saved = null;
  }
  const keyToIndex = { relay: 0, receive: 1, import: 2 };
  /** Default: Internet relay when never set, undefined, or not a known tab id */
  const initial =
    saved === undefined || saved === null || saved === ''
      ? 0
      : Object.prototype.hasOwnProperty.call(keyToIndex, saved)
        ? keyToIndex[saved]
        : 0;
  switchTab(initial);

  const tablist = tabRelay.closest('[role="tablist"]');
  if (tablist) {
    tablist.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const cur = tabs.findIndex((t) => t.classList.contains('is-active'));
      const next = e.key === 'ArrowRight' ? (cur + 1) % 3 : (cur - 1 + 3) % 3;
      switchTab(next);
      tabs[next].focus();
    });
  }
}

function wirePersistListeners() {

  const ex = el('chkExtractZips');

  const del = el('chkDeleteZipsAfterExtract');

  if (ex) {

    ex.addEventListener('change', () => {

      if (!ex.checked && del) {

        del.checked = false;

    }

      if (del) del.disabled = !ex.checked;

      saveSettings();

    });

  }

  if (del) del.addEventListener('change', saveSettings);



  const lan = el('lanAllowAutoDownload');

  if (lan) lan.addEventListener('change', saveSettings);

  const relayAuto = el('relayAllowAutoDownload');

  if (relayAuto) relayAuto.addEventListener('change', saveSettings);



  const pt = el('plTitle');

  const pa = el('plAuthor');

  if (pt) {
    pt.addEventListener('input', scheduleSaveSettings);
    pt.addEventListener('blur', saveSettings);
  }

  if (pa) {
    pa.addEventListener('input', scheduleSaveSettings);
    pa.addEventListener('blur', saveSettings);
  }

  const relay = el('relayUrl');
  if (relay) {
    relay.addEventListener('input', scheduleSaveSettings);
    relay.addEventListener('blur', saveSettings);
  }

}



(async function bootstrap() {

  if (!window.bs?.getSettings) return;

  let s = await window.bs.getSettings();

  const mig = migrateLocalStorageOnce();

  if (mig) {

    await window.bs.setSettings({ ...s, ...mig });

    s = { ...s, ...mig };

  }

  applySettingsToUi(s);

  wirePersistListeners();

  initTabs();

})();



function setSummary(data) {

  current = data;

  const n = data.maps?.length ?? 0;

  el('listSummary').textContent = n ? `Loaded ${n} map(s).` : 'No list loaded.';

  const ul = el('mapPreview');

  ul.innerHTML = '';

  (data.maps || []).slice(0, 50).forEach((m) => {

    const li = document.createElement('li');

    li.textContent = `${m.songName} — ${m.key}`;

    ul.appendChild(li);

  });

  if (n > 50) {

    const li = document.createElement('li');

    li.textContent = `… and ${n - 50} more`;

    ul.appendChild(li);

  }

  refreshButtons();

}



function refreshButtons() {

  const ok = current && current.maps && current.maps.length > 0;

  const dl = el('btnDownload');

  const bp = el('btnBplist');

  if (dl) dl.disabled = !ok || !outDir;

  if (bp) bp.disabled = !ok || !outDir;

}



/**

 * @param {{ lanInfoIntro?: string, phoneInfoTarget?: 'lan' | 'relay' }} opts - If lanInfoIntro set (phone auto-download), result is shown in lanInfo or relayInfo.

 */

async function runDownload(opts = {}) {

  if (!current?.maps?.length || !outDir) return;

  const extractZips = el('chkExtractZips')?.checked === true;

  const deleteZipsAfterExtract = el('chkDeleteZipsAfterExtract')?.checked === true;

  el('dlStatus').textContent = extractZips ? 'Downloading and extracting…' : 'Downloading…';

  const res = await window.bs.downloadMaps({

    outDir,

    maps: current.maps,

    concurrency: 4,

    extractZips,

    deleteZipsAfterExtract

  });

  const failed = res.filter((r) => !r.ok);

  const extractFailed = res.filter((r) => r.ok && r.extractError);

  const extracted = res.filter((r) => r.ok && r.extractedTo).length;

  const zipsRemoved = res.filter((r) => r.ok && r.zipDeleted).length;

  let msg =

    failed.length === 0

      ? `Done. ${res.length} download(s).`

      : `Finished with ${failed.length} download error(s).`;

  if (extractZips && extracted > 0) {

    msg += ` Extracted ${extracted} folder(s).`;

  }

  if (deleteZipsAfterExtract && zipsRemoved > 0) {

    msg += ` Removed ${zipsRemoved} ZIP(s).`;

  }

  if (extractFailed.length > 0) {

    msg += ` ${extractFailed.length} extract error(s) — ZIPs kept on disk.`;

  }

  el('dlStatus').textContent = msg;

  if (opts.lanInfoIntro != null) {

    const box = opts.phoneInfoTarget === 'relay' ? el('relayInfo') : el('lanInfo');

    if (box) box.textContent = `${opts.lanInfoIntro}\n\n${msg}`;

  }

}



el('btnImport').onclick = async () => {

  const data = await window.bs.importJsonPath();

  if (data) setSummary(data);

};



function wireFolderPicker() {
  const open = async () => {
    const p = await window.bs.selectFolder();
    if (p) {
      outDir = p;
      syncFolderPathDisplays();
      refreshButtons();
      saveSettings();
    }
  };
  ['btnFolderRelay', 'btnFolderReceive', 'btnFolderImport'].forEach((id) => {
    const b = el(id);
    if (b) b.onclick = open;
  });
}

wireFolderPicker();



el('btnDownload').onclick = () => runDownload();



el('btnBplist').onclick = async () => {

  el('bpStatus').textContent = 'Writing…';

  const dest = await window.bs.writeBplist({

    outDir,

    maps: current.maps,

    title: el('plTitle').value || 'My list',

    author: el('plAuthor').value || 'BSLink'

  });

  el('bpStatus').textContent = `Wrote ${dest}`;

};



async function showRelayQr(pairingUrl) {

  const wrap = el('relayQrWrap');

  const img = el('relayQr');

  const box = el('relayInfo');

  if (!wrap || !img || !pairingUrl) {

    if (wrap) wrap.hidden = true;

    return;

  }

  try {

    if (!window.bs?.qrDataUrl) throw new Error('QR bridge missing');

    const dataUrl = await window.bs.qrDataUrl(String(pairingUrl));

    img.src = dataUrl;

    wrap.hidden = false;

    if (box) {

      box.textContent = `Pairing URL (any network):\n${pairingUrl}`;

    }

  } catch (e) {

    wrap.hidden = true;

    if (box) {

      box.textContent = `Relay started. QR failed: ${e?.message || e}\n\n${pairingUrl}`;

    }

  }

}



async function showLanQr(info) {

  const wrap = el('lanQrWrap');

  const img = el('lanQr');

  const base = info?.baseUrl || info?.url;

  if (!base || !info?.token) {

    wrap.hidden = true;

    return;

  }

  const qrUrl = `${base.replace(/\/$/, '')}/?token=${encodeURIComponent(info.token)}`;

  try {

    if (!window.bs?.qrDataUrl) {

      throw new Error('QR bridge missing');

    }

    const dataUrl = await window.bs.qrDataUrl(qrUrl);

    if (!dataUrl || typeof dataUrl !== 'string') {

      throw new Error('QR generator returned empty');

    }

    img.src = dataUrl;

    wrap.hidden = false;

  } catch (e) {

    wrap.hidden = true;

    const prev = el('lanInfo').textContent || '';

    const hint = `\n\nQR could not be generated: ${e?.message || e}. URL for manual entry: ${qrUrl}`;

    if (!prev.includes('QR could not be generated')) {

      el('lanInfo').textContent = prev + hint;

    }

  }

}



el('btnLanStart').onclick = async () => {

  if (!window.bs?.lanStart) {

    el('lanInfo').textContent =

      'Internal error: app bridge missing. Reinstall or run from source (npm start in pc/).';

    return;

  }

  el('lanInfo').textContent = 'Starting…';

  try {

    const info = await window.bs.lanStart();

    el('btnLanStop').disabled = false;

    el('lanInfo').textContent = JSON.stringify(info, null, 2);

    await showLanQr(info);

  } catch (err) {

    el('btnLanStop').disabled = true;

    el('lanQrWrap').hidden = true;

    el('lanInfo').textContent = `Could not start receiver:\n${err?.message || err}`;

  }

};



el('btnRelayStart').onclick = async () => {

  if (!window.bs?.relayStart) {

    el('relayInfo').textContent = 'Internal error: relay bridge missing.';

    return;

  }

  const relayUrl = el('relayUrl')?.value?.trim() || '';

  el('relayInfo').textContent = 'Starting relay session…';

  try {

    const info = await window.bs.relayStart(relayUrl);

    el('btnRelayStop').disabled = false;

    el('relayInfo').textContent = `Polling relay for imports.\n\n${JSON.stringify(info, null, 2)}`;

    await showRelayQr(info.pairingUrl);

  } catch (err) {

    el('btnRelayStop').disabled = true;

    el('relayQrWrap').hidden = true;

    el('relayInfo').textContent = `Relay error:\n${err?.message || err}`;

  }

};



el('btnRelayStop').onclick = async () => {

  await window.bs.relayStop();

  el('btnRelayStop').disabled = true;

  el('relayQrWrap').hidden = true;

  el('relayInfo').textContent = 'Relay session stopped.';

};



el('btnLanStop').onclick = async () => {

  await window.bs.lanStop();

  el('btnLanStop').disabled = true;

  el('lanInfo').textContent = 'Stopped.';

  el('lanQrWrap').hidden = true;

};



window.bs.onLanEvent((ev) => {

  if (ev.type === 'import' && ev.data) {

    const fromRelay = ev.source === 'relay';

    const infoEl = fromRelay ? el('relayInfo') : el('lanInfo');

    setSummary(ev.data);

    let msg = `Received list from phone. ${ev.data.maps?.length ?? 0} map(s).`;

    if (ev.autoDownload) {

      const allowOnPc = fromRelay
        ? el('relayAllowAutoDownload')?.checked === true
        : el('lanAllowAutoDownload')?.checked === true;

      if (outDir && allowOnPc) {

        const intro = `Received list from phone. ${ev.data.maps?.length ?? 0} map(s).`;

        if (infoEl) infoEl.textContent = `${intro}\nStarting download…`;

        runDownload({ lanInfoIntro: intro, phoneInfoTarget: fromRelay ? 'relay' : 'lan' });

      } else if (!outDir) {

        msg +=

          '\nAuto-download skipped: choose a download folder first (Receive over LAN tab), then send again or download manually.';

        if (infoEl) infoEl.textContent = msg;

      } else if (!allowOnPc) {

        msg += fromRelay

          ? '\nAuto-download skipped: enable “Allow automatic downloads when the phone requests it” on the Internet relay tab (PC safety).'

          : '\nAuto-download skipped: enable “Allow automatic downloads when the phone requests it” above (PC safety).';

        if (infoEl) infoEl.textContent = msg;

      }

    } else if (infoEl) {

      infoEl.textContent = msg;

    }

  }

  if (ev.type === 'started') {

    el('btnLanStop').disabled = false;

    el('lanInfo').textContent =

      `POST JSON to:\n${ev.baseUrl}/import?token=${ev.token}\n\nToken: ${ev.token}`;

    showLanQr(ev);

  }

  if (ev.type === 'start-failed') {

    el('btnLanStop').disabled = true;

    el('lanQrWrap').hidden = true;

    el('lanInfo').textContent = `Could not start receiver:\n${ev.message || 'Unknown error'}`;

  }

  if (ev.type === 'relay-stopped') {

    el('btnRelayStop').disabled = true;

    el('relayQrWrap').hidden = true;

  }

});


