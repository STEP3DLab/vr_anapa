const allowedNames = new Set([
  'mobot-photo-archive-20261114.zip',
  'mobot-research-sources.zip'
]);
const maxPartBytes = 7340032;
const $ = id => document.getElementById(id);
const number = new Intl.NumberFormat('ru-RU', {maximumFractionDigits: 1});
const size = bytes => number.format(bytes / 1000000) + ' МБ';
const validHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
let preparedURL = null;
let controller = null;
let busy = false;

class DownloadError extends Error {}

function validateFile(file) {
  if (!file || !allowedNames.has(file.name) || typeof file.label !== 'string' ||
      typeof file.description !== 'string' || !Number.isSafeInteger(file.bytes) ||
      file.bytes < 1 || file.bytes > 100000000 || !validHash(file.sha256) ||
      !Array.isArray(file.parts) || !file.parts.length || file.parts.length > 32) {
    throw new DownloadError('Список материалов повреждён. Обновите страницу и повторите попытку.');
  }
  let total = 0;
  for (const [index, part] of file.parts.entries()) {
    const expectedName = file.name + '.part' + String(index + 1).padStart(2, '0');
    if (part.name !== expectedName || !Number.isSafeInteger(part.bytes) ||
        part.bytes < 1 || part.bytes > maxPartBytes || !validHash(part.sha256)) {
      throw new DownloadError('Список материалов повреждён. Обновите страницу и повторите попытку.');
    }
    total += part.bytes;
  }
  if (total !== file.bytes) {
    throw new DownloadError('Размер ZIP не совпадает с описанием. Обновите страницу и повторите попытку.');
  }
  return file;
}

async function digest(bytes) {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

function setStatus(message, error = false) {
  $('downloadStatus').textContent = message;
  $('downloadStatus').classList.toggle('error', error);
}

async function readPart(part, signal, received) {
  // Every name has been checked against the selected manifest entry. No URL
  // supplied by the query string can become a fetch destination.
  const response = await fetch(new URL(part.name, import.meta.url), {signal, cache: 'no-store'});
  if (!response.ok) {
    throw new DownloadError('Не удалось получить файл. Проверьте соединение и повторите загрузку.');
  }
  const bytes = new Uint8Array(part.bytes);
  let offset = 0;
  if (response.body?.getReader) {
    const reader = response.body.getReader();
    let completed = false;
    try {
      while (true) {
        const {done, value} = await reader.read();
        if (done) { completed = true; break; }
        if (offset + value.byteLength > bytes.byteLength) {
          throw new DownloadError('Размер полученного файла не совпал с ожидаемым. Повторите загрузку.');
        }
        bytes.set(value, offset);
        offset += value.byteLength;
        received(value.byteLength);
      }
    } finally {
      if (!completed) await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  } else {
    const data = new Uint8Array(await response.arrayBuffer());
    if (data.byteLength !== bytes.byteLength) {
      throw new DownloadError('Размер полученного файла не совпал с ожидаемым. Повторите загрузку.');
    }
    bytes.set(data); offset = data.byteLength; received(offset);
  }
  if (offset !== part.bytes || await digest(bytes) !== part.sha256) {
    throw new DownloadError('Проверка целостности не пройдена. Повторите загрузку при устойчивом соединении.');
  }
  return bytes;
}

async function download(file) {
  if (busy) return;
  if (preparedURL) { $('save').click(); return; }
  if (!globalThis.crypto?.subtle) {
    setStatus('Для проверки ZIP откройте эту страницу по защищённой HTTPS-ссылке в современном браузере.', true);
    return;
  }
  busy = true;
  controller = new AbortController();
  const activeController = controller;
  const button = $('download');
  button.disabled = true; button.textContent = 'Загружается…';
  $('progressArea').hidden = false; $('saveHint').hidden = true;
  $('progress').max = file.bytes; $('progress').value = 0;
  $('progressCopy').textContent = 'Получено 0 из ' + size(file.bytes);
  setStatus('Загружается ZIP. Проверка целостности выполнится автоматически.');
  let receivedBytes = 0, lastPaint = 0, nextPart = 0;
  const buffers = new Array(file.parts.length);
  const received = count => {
    receivedBytes += count;
    const now = performance.now();
    if (now - lastPaint < 120 && receivedBytes < file.bytes) return;
    lastPaint = now;
    $('progress').value = receivedBytes;
    $('progressCopy').textContent = 'Получено ' + size(receivedBytes) + ' из ' + size(file.bytes);
  };
  const worker = async () => {
    while (!activeController.signal.aborted) {
      const index = nextPart++;
      if (index >= file.parts.length) return;
      buffers[index] = await readPart(file.parts[index], activeController.signal, received);
    }
  };
  const workers = [worker(), worker()];
  try {
    try { await Promise.all(workers); }
    catch (error) {
      activeController.abort();
      await Promise.allSettled(workers);
      throw error;
    }
    if (activeController.signal.aborted) return;
    button.textContent = 'Проверяется ZIP…';
    setStatus('Проверяется целостность полного ZIP…');
    const whole = new Uint8Array(file.bytes);
    let offset = 0;
    for (let index = 0; index < buffers.length; index++) {
      const bytes = buffers[index];
      whole.set(bytes, offset); offset += bytes.byteLength; buffers[index] = null;
    }
    if (offset !== file.bytes || await digest(whole) !== file.sha256) {
      throw new DownloadError('Проверка целостности ZIP не пройдена. Повторите загрузку.');
    }
    if (activeController.signal.aborted) return;
    preparedURL = URL.createObjectURL(new Blob([whole], {type: 'application/zip'}));
    const save = $('save');
    save.href = preparedURL; save.download = file.name; save.hidden = false;
    $('progress').value = file.bytes;
    $('progressCopy').textContent = size(file.bytes) + ' · целостность подтверждена';
    button.textContent = 'Скачать ZIP ещё раз';
    setStatus('ZIP проверен и подготовлен к сохранению.');
    $('saveHint').hidden = false;
    save.click();
  } catch (error) {
    setStatus(error instanceof DownloadError ? error.message :
      'Загрузка прервалась. Проверьте соединение и нажмите «Повторить загрузку».', true);
    button.textContent = 'Повторить загрузку';
  } finally {
    buffers.fill(null);
    busy = false; button.disabled = false;
    if (controller === activeController) controller = null;
  }
}

function showChoices(files) {
  const host = $('choices');
  for (const file of files) {
    const anchor = document.createElement('a');
    anchor.href = './?file=' + encodeURIComponent(file.name);
    const title = document.createElement('strong'); title.textContent = file.label;
    const meta = document.createElement('span'); meta.textContent = 'ZIP · ' + size(file.bytes);
    anchor.append(title, meta); host.append(anchor);
  }
  host.hidden = false;
}

async function initialise() {
  try {
    const response = await fetch(new URL('./manifest.json', import.meta.url), {cache: 'no-store'});
    if (!response.ok) throw new Error('manifest');
    const manifest = await response.json();
    if (!Array.isArray(manifest.files)) throw new Error('manifest');
    const files = manifest.files.map(validateFile);
    if (new Set(files.map(file => file.name)).size !== files.length) throw new Error('manifest');
    const requested = new URLSearchParams(location.search).get('file');
    const file = allowedNames.has(requested) ? files.find(item => item.name === requested) : null;
    if (!file) {
      $('pageStatus').textContent = requested ? 'Этот комплект не найден. Выберите один из доступных материалов.' : 'Выберите комплект для скачивания.';
      showChoices(files);
      return;
    }
    document.title = file.label + ' — материалы «Мобот»';
    $('pageTitle').textContent = file.label;
    $('description').textContent = file.description;
    $('fileSize').textContent = 'ZIP · ' + size(file.bytes);
    $('fileCard').hidden = false; $('pageStatus').hidden = true;
    $('download').disabled = false;
    $('download').onclick = () => download(file);
  } catch (error) {
    $('pageStatus').classList.add('error');
    $('pageStatus').textContent = error instanceof DownloadError ? error.message :
      'Не удалось загрузить список материалов. Проверьте соединение и обновите страницу.';
  }
}

window.addEventListener('pagehide', () => {
  controller?.abort();
  if (preparedURL) { URL.revokeObjectURL(preparedURL); preparedURL = null; }
  $('save').hidden = true; $('save').removeAttribute('href'); $('saveHint').hidden = true;
  if (!busy) $('download').textContent = 'Скачать ZIP';
});
initialise();
