let _emotionBuilderBaseDataUrl = '';
let _emotionBuilderNeutralAUrl = '';

function setEmotionBuilderStatus(text) {
  const el = document.getElementById('status');
  if (el) el.textContent = text;
}

function showPreview(elId, url, label = '') {
  const el = document.getElementById(elId);
  if (!el) return;
  if (!url) {
    el.innerHTML = label || 'None';
    return;
  }
  el.innerHTML = `<img src="${url}" alt="">`;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function handleBaseUpload() {
  const file = document.getElementById('baseFile')?.files?.[0];
  if (!file) {
    setEmotionBuilderStatus('기본 이미지를 먼저 골라주세요.');
    return;
  }
  _emotionBuilderBaseDataUrl = await readFileAsDataUrl(file);
  showPreview('basePreview', _emotionBuilderBaseDataUrl);
  setEmotionBuilderStatus('기본 이미지를 불러왔습니다. neutral_a 생성 준비 완료.');
}

async function createNeutralA() {
  if (!_emotionBuilderBaseDataUrl) {
    setEmotionBuilderStatus('먼저 base image를 업로드해주세요.');
    return;
  }
  const pid = (document.getElementById('pidInput')?.value || '').trim() || 'p_unknown';
  const fname = `${pid}_neutral_a.jpg`;
  setEmotionBuilderStatus('neutral_a용 업로드를 R2로 보내는 중...');
  const url = await uploadToR2(_emotionBuilderBaseDataUrl, `img_profile/${pid}`, fname);
  _emotionBuilderNeutralAUrl = url;
  showPreview('neutralPreview', url);
  setEmotionBuilderStatus(`neutral_a 준비 완료: ${fname}`);
}

async function requestGrokEmotionImage(promptText, imageUrl, pid) {
  const wUrl = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '').replace(/\/+$/, '');
  if (!wUrl) throw new Error('WORKER_URL이 없습니다.');
  const res = await fetch(wUrl + '/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'grok-imagine-image-pro',
      prompt: promptText,
      images: imageUrl ? [imageUrl] : [],
      participant_pids: pid ? [pid] : [],
      aspect_ratio: '1:1',
    })
  });
  const data = await res.json();
  if (data.result !== 'success') throw new Error(data.error || 'image generation failed');
  return data.reply || '';
}

async function generateEmotionBatch() {
  if (!_emotionBuilderNeutralAUrl) {
    setEmotionBuilderStatus('먼저 neutral_a를 만들어주세요.');
    return;
  }
  const pid = (document.getElementById('pidInput')?.value || '').trim() || 'p_unknown';
  const prompt = (document.getElementById('promptInput')?.value || '').trim() || 'neutral';
  setEmotionBuilderStatus('Grok 이미지 생성 요청 중...');
  const reply = await requestGrokEmotionImage(prompt, _emotionBuilderNeutralAUrl, pid);
  const match = reply.match(/!\[.*?\]\((https?:\/\/[^)\s]+)\)/);
  const url = match ? match[1] : '';
  if (url) {
    showPreview('resultPreview', url);
    setEmotionBuilderStatus('Grok 이미지 생성 완료');
  } else {
    setEmotionBuilderStatus('결과 URL을 찾지 못했습니다.');
  }
}

window.handleBaseUpload = handleBaseUpload;
window.createNeutralA = createNeutralA;
window.generateEmotionBatch = generateEmotionBatch;
