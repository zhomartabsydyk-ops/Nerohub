const chat = document.getElementById('chat');
const form = document.getElementById('inputBar');
const input = document.getElementById('textInput');
const modelSelect = document.getElementById('modelSelect');

function addMsg(text, who, imgUrl){
  const div = document.createElement('div');
  div.className = 'msg ' + who;
  div.textContent = text || '';
  if(imgUrl){
    const img = document.createElement('img');
    img.src = imgUrl;
    div.appendChild(img);
  }
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  return div;
}

function keys(){
  return {
    openai: localStorage.getItem('key_openai') || '',
    claude: localStorage.getItem('key_claude') || '',
    gemini: localStorage.getItem('key_gemini') || '',
  };
}

// ---------- Настройки / ключи ----------
const settingsModal = document.getElementById('settingsModal');
document.getElementById('settingsBtn').onclick = () => {
  document.getElementById('keyOpenAI').value = keys().openai;
  document.getElementById('keyClaude').value = keys().claude;
  document.getElementById('keyGemini').value = keys().gemini;
  settingsModal.classList.remove('hidden');
};
document.getElementById('closeSettings').onclick = () => settingsModal.classList.add('hidden');
document.getElementById('saveKeys').onclick = () => {
  localStorage.setItem('key_openai', document.getElementById('keyOpenAI').value.trim());
  localStorage.setItem('key_claude', document.getElementById('keyClaude').value.trim());
  localStorage.setItem('key_gemini', document.getElementById('keyGemini').value.trim());
  settingsModal.classList.add('hidden');
};

// ---------- Камера ----------
const camWrap = document.getElementById('cameraWrap');
const camVideo = document.getElementById('cam');
const camCanvas = document.getElementById('camCanvas');
let camStream = null;

document.getElementById('camBtn').onclick = async () => {
  try{
    camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    camVideo.srcObject = camStream;
    camWrap.classList.remove('hidden');
  }catch(e){
    addMsg('Не удалось открыть камеру: ' + e.message, 'bot');
  }
};
document.getElementById('camClose').onclick = () => {
  if(camStream) camStream.getTracks().forEach(t => t.stop());
  camWrap.classList.add('hidden');
};
document.getElementById('camShot').onclick = () => {
  camCanvas.width = camVideo.videoWidth;
  camCanvas.height = camVideo.videoHeight;
  camCanvas.getContext('2d').drawImage(camVideo, 0, 0);
  const dataUrl = camCanvas.toDataURL('image/jpeg', 0.85);
  addMsg('', 'user', dataUrl);
  if(camStream) camStream.getTracks().forEach(t => t.stop());
  camWrap.classList.add('hidden');
};

// ---------- Отправка сообщений ----------
form.onsubmit = async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if(!text) return;
  addMsg(text, 'user');
  input.value = '';
  const model = modelSelect.value;
  const thinking = addMsg('...', 'bot');
  try{
    let reply;
    if(model === 'image'){
      const url = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(text);
      thinking.textContent = '';
      const img = document.createElement('img');
      img.src = url;
      thinking.appendChild(img);
      return;
    } else if(model === 'free'){
      reply = await callFreeModel(text);
    } else if(model === 'openai'){
      reply = await callOpenAI(text);
    } else if(model === 'claude'){
      reply = await callClaude(text);
    } else if(model === 'gemini'){
      reply = await callGemini(text);
    }
    thinking.textContent = reply;
  }catch(err){
    thinking.textContent = 'Ошибка: ' + err.message;
  }
};

// Бесплатная модель без ключа (Pollinations text API)
async function callFreeModel(text){
  const res = await fetch('https://text.pollinations.ai/' + encodeURIComponent(text));
  if(!res.ok) throw new Error('сервис недоступен');
  return await res.text();
}

async function callOpenAI(text){
  const k = keys().openai;
  if(!k) throw new Error('добавь OpenAI ключ в настройках ⚙️');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'Authorization':'Bearer ' + k },
    body: JSON.stringify({ model:'gpt-4o-mini', messages:[{role:'user', content:text}] })
  });
  const data = await res.json();
  if(data.error) throw new Error(data.error.message);
  return data.choices[0].message.content;
}

async function callClaude(text){
  const k = keys().claude;
  if(!k) throw new Error('добавь Anthropic ключ в настройках ⚙️');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':'application/json',
      'x-api-key': k,
      'anthropic-version':'2023-06-01',
      'anthropic-dangerous-direct-browser-access':'true'
    },
    body: JSON.stringify({ model:'claude-sonnet-4-6', max_tokens:1000, messages:[{role:'user', content:text}] })
  });
  const data = await res.json();
  if(data.error) throw new Error(data.error.message);
  return data.content.map(c => c.text || '').join('\n');
}

async function callGemini(text){
  const k = keys().gemini;
  if(!k) throw new Error('добавь Gemini ключ в настройках ⚙️');
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + k, {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ contents:[{ parts:[{ text }] }] })
  });
  const data = await res.json();
  if(data.error) throw new Error(data.error.message);
  return data.candidates[0].content.parts[0].text;
}
