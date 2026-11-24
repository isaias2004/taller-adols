
const SUPABASE_URL = 'https://gukcxxqjmtfwtgmomsmw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_XMTtJvCl_yp95piX9uXQww_a8EwEJ7f';
const ROOM_CODE = 'VALIENTE2026';
const STORAGE_KEY = 'vmv_participant';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let serverTimeOffset = 0;
let serverClockSynced = false;

async function syncServerClock() {
  const requestStart = Date.now();

  const { data, error } = await db.rpc('get_server_time');

  const requestEnd = Date.now();

  if (error) throw error;

  const serverTime = new Date(data).getTime();
  const browserMidpoint = (requestStart + requestEnd) / 2;

  serverTimeOffset = serverTime - browserMidpoint;
  serverClockSynced = true;

  console.log('RELOJ SINCRONIZADO:', {
    diferenciaSegundos: (serverTimeOffset / 1000).toFixed(2)
  });
}

function getServerNow() {
  return Date.now() + serverTimeOffset;
}

const $ = (id) => document.getElementById(id);

let participant = null;
let room = null;
let chapter = null;
let roomChannel = null;
let timerInterval = null;
let selectedVote = null;
let voteLocked = false;
let rendering = false;
let renderPending = false;
let activeVotingKey = null;

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.add('hidden');
  });
  $(screenId).classList.remove('hidden');
}

function showMessage(element, text, isError = false) {
  element.textContent = text;
  element.classList.toggle('error', isError);
}

function setParticipantName(name) {
  $('participantName').textContent = name ? `Hola, ${name}` : '';
  $('waitingName').textContent = name || '';
}

async function ensureAuthenticated() {
  const { data, error } = await db.auth.getSession();
  if (error) throw error;

  if (data.session) return data.session;

  const { data: authData, error: authError } = await db.auth.signInAnonymously();
  if (authError) throw authError;

  return authData.session;
}

async function joinRoom(displayName) {
  await ensureAuthenticated();

  const { data, error } = await db.rpc('join_room', {
    p_room_code: ROOM_CODE,
    p_display_name: displayName
  });

  if (error) throw error;

  participant = {
    room_id: data.room_id,
    participant_id: data.participant_id,
    display_name: data.display_name
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(participant));
  setParticipantName(participant.display_name);

  await loadRoom();
  subscribeToRoom();

  if (room.status === 'lobby') {
    showScreen('introScreen');
  } else {
    await renderRoom();
  }
}

async function restoreParticipant() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return;

  try {
    const storedParticipant = JSON.parse(saved);
    const { data } = await db.auth.getSession();

    if (!data.session) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    participant = storedParticipant;
    setParticipantName(participant.display_name);

    await loadRoom();
    subscribeToRoom();
    await renderRoom();
  } catch (error) {
    console.error('No se pudo recuperar la participación:', error);
    showScreen('welcomeScreen');
  }
}

async function loadRoom() {
  const { data, error } = await db
    .from('rooms')
    .select('*')
    .eq('id', participant.room_id)
    .single();

  if (error) throw error;
  room = data;
}

async function loadChapter(number) {
  const { data, error } = await db
    .from('chapters')
    .select('*')
    .eq('chapter_number', number)
    .single();

  if (error) throw error;
  chapter = data;
}


function subscribeToRoom() {
  if (roomChannel || !participant) return;

  console.log('Conectando Realtime para la sala:', participant.room_id);

  roomChannel = db
    .channel(`participant-room-${participant.room_id}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'rooms',
        filter: `id=eq.${participant.room_id}`
      },
      async (payload) => {
        console.log('REALTIME: llegó una actualización:', payload);

        room = { ...room, ...payload.new };

        console.log('Nuevo estado de la sala:', room.status);

        await renderRoom();
      }
    )
    .subscribe((status, error) => {
      console.log('Estado de conexión Realtime:', status);

      if (error) {
        console.error('Error de conexión Realtime:', error);
      }
    });
}



async function renderRoom() {
  if (!room) return;

  if (rendering) {
    renderPending = true;
    return;
  }

  rendering = true;

  try {
    // Solo detenemos el temporizador cuando salimos de la votación.
    if (room.status !== 'voting') {
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }

      activeVotingKey = null;
    }

    if (room.status === 'lobby') {
      showScreen('waitingScreen');
    } else if (room.status === 'voting') {
      await renderVoting();
    } else if (room.status === 'results') {
      await renderResults();
    } else if (room.status === 'consequence') {
      await renderConsequence();
    } else if (room.status === 'final') {
      await renderFinal();
    } else if (room.status === 'survey') {
      showScreen('surveyScreen');
    } else if (room.status === 'finished') {
      showScreen('finishedScreen');
    }

  } catch (error) {
    console.error('Error al actualizar la sala:', error);
    showScreen('waitingScreen');

  } finally {
    rendering = false;

    if (renderPending) {
      renderPending = false;
      Promise.resolve().then(() => renderRoom());
    }
  }
}



async function renderVoting() {

  if (!serverClockSynced) {
  await syncServerClock();
}
  const votingKey = `${room.current_chapter}:${room.voting_ends_at}`;
  const isNewVoting = activeVotingKey !== votingKey;

  await loadChapter(room.current_chapter);

  // Evitamos dibujar una votación que ya terminó mientras cargábamos.
  if (
    !room ||
    room.status !== 'voting' ||
    `${room.current_chapter}:${room.voting_ends_at}` !== votingKey
  ) {
    return;
  }
  

  showScreen('gameScreen');

  $('chapterLabel').textContent = `CAPÍTULO ${chapter.chapter_number}`;
  $('chapterTitle').textContent = chapter.title;
  $('chapterSituation').textContent = chapter.situation;
  $('optionAText').textContent = chapter.option_a;
  $('optionBText').textContent = chapter.option_b;

  $('votingArea').classList.remove('hidden');
  $('waitingResults').classList.add('hidden');

  if (isNewVoting) {
    activeVotingKey = votingKey;
    selectedVote = null;
    voteLocked = false;

    $('optionA').classList.remove('selected');
    $('optionB').classList.remove('selected');

    $('optionA').disabled = false;
    $('optionB').disabled = false;

    showMessage(
      $('voteMessage'),
      'Podés cambiar tu voto mientras el tiempo siga corriendo.'
    );
  }

  updateTimer();

  if (!timerInterval && !voteLocked) {
    timerInterval = setInterval(updateTimer, 250);
  }
}

function updateTimer() {
  if (!room || room.status !== 'voting') return;

  const end = new Date(room.voting_ends_at).getTime();

  const remaining = Math.max(
    0,
    Math.ceil((end - getServerNow()) / 1000)
  );

  $('timer').textContent = remaining;

  if (remaining <= 0) {
    voteLocked = true;
    $('optionA').disabled = true;
    $('optionB').disabled = true;

    showMessage(
      $('voteMessage'),
      '¡Tiempo terminado! Esperando los resultados...'
    );

    clearInterval(timerInterval);
    timerInterval = null;
  }
}

async function castVote(choice) {
  if (voteLocked || !room || room.status !== 'voting') return;

  const end = new Date(room.voting_ends_at).getTime();
  if (getServerNow() >= end) {
    updateTimer();
    return;
  }

  selectedVote = choice;

  $('optionA').classList.toggle('selected', choice === 'A');
  $('optionB').classList.toggle('selected', choice === 'B');

  showMessage($('voteMessage'), 'Registrando tu voto...');

  const { error } = await db.rpc('cast_vote', {
    p_chapter_number: room.current_chapter,
    p_choice: choice
  });

  if (error) {
    showMessage($('voteMessage'), error.message, true);
    return;
  }

  showMessage(
    $('voteMessage'),
    `Votaste la opción ${choice}. Podés cambiar tu elección antes de que termine el tiempo.`
  );
}

async function renderResults() {
  await loadChapter(room.current_chapter);
  showScreen('gameScreen');

  $('chapterLabel').textContent = `CAPÍTULO ${chapter.chapter_number}`;
  $('chapterTitle').textContent = chapter.title;
  $('chapterSituation').textContent = chapter.situation;

  $('votingArea').classList.add('hidden');
  $('waitingResults').classList.remove('hidden');
  $('waitingResults').innerHTML = '';

  const title = document.createElement('strong');
  title.textContent = '¡Votación cerrada!';

  const description = document.createElement('p');
  description.textContent = 'El coordinador está preparando el resultado y la consecuencia.';

  $('waitingResults').append(title, description);
}

async function renderConsequence() {
  await loadChapter(room.current_chapter);
  showScreen('consequenceScreen');

  const winner = room.winning_choice;

  $('consequenceChapter').textContent = `CONSECUENCIA · CAPÍTULO ${chapter.chapter_number}`;
  $('consequenceTitle').textContent = winner === 'A'
    ? 'La decisión del grupo'
    : 'La decisión del grupo';

  $('consequenceText').textContent = winner === 'A'
    ? chapter.consequence_a
    : chapter.consequence_b;
}

async function renderFinal() {
  await loadChapter(7);
  showScreen('finalScreen');

  const winner = room.winning_choice;

  $('finalTitle').textContent = winner === 'A'
    ? 'UNA VIDA TRANSFORMADA'
    : 'MUCHAS VIDAS TRANSFORMADAS';

  $('finalText').textContent = winner === 'A'
    ? chapter.consequence_a
    : chapter.consequence_b;
}

$('joinForm').addEventListener('submit', async (event) => {
  event.preventDefault();

  const name = $('displayName').value.trim();
  if (name.length < 2) {
    showMessage($('joinMessage'), 'Ingresá un nombre de al menos 2 caracteres.', true);
    return;
  }

  $('joinButton').disabled = true;
  $('joinButton').textContent = 'INGRESANDO...';
  showMessage($('joinMessage'), '');

  try {
    await joinRoom(name);
  } catch (error) {
    showMessage($('joinMessage'), error.message, true);
  } finally {
    $('joinButton').disabled = false;
    $('joinButton').textContent = 'INGRESAR A LA HISTORIA';
  }
});

$('charactersButton').addEventListener('click', () => {
  showScreen('charactersScreen');
});

$('readyButton').addEventListener('click', () => {
  showScreen('waitingScreen');
});

$('optionA').addEventListener('click', () => castVote('A'));
$('optionB').addEventListener('click', () => castVote('B'));

$('surveyForm').addEventListener('submit', async (event) => {
  event.preventDefault();

  const selected = document.querySelector('input[name="rating"]:checked');
  if (!selected) {
    showMessage($('surveyMessage'), 'Elegí una valoración para continuar.', true);
    return;
  }

  $('surveyButton').disabled = true;
  $('surveyButton').textContent = 'ENVIANDO...';

  try {
    const rating = Number(selected.value);
    const comment = $('surveyComment').value.trim();

    const { error } = await db.rpc('submit_survey', {
      p_rating: rating,
      p_comment: comment || null
    });

    if (error) throw error;

    showScreen('finishedScreen');
  } catch (error) {
    showMessage($('surveyMessage'), error.message, true);
  } finally {
    $('surveyButton').disabled = false;
    $('surveyButton').textContent = 'ENVIAR RESPUESTA';
  }
});

async function startApp() {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (saved) {
    await restoreParticipant();

    if (participant) return;
  }

  showScreen('welcomeScreen');
}

startApp();
