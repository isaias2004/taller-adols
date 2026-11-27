
const SUPABASE_URL = 'https://gukcxxqjmtfwtgmomsmw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_XMTtJvCl_yp95piX9uXQww_a8EwEJ7f';
const ROOM_CODE = 'VALIENTE2026';

// Los datos del participante duran solamente durante la sesión de esa pestaña.
const SESSION_STORAGE_KEY = 'vmv_participant_session';

// Clave anterior: la eliminamos para dejar de recuperar identidades viejas.
const LEGACY_STORAGE_KEY = 'vmv_participant';

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

// Temporizador automático de resultados.
let resultsAdvanceTimeout = null;
let activeResultsKey = null;

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.add('hidden');
  });

  $(screenId).classList.remove('hidden');
}

function setImage(elementId, src, altText) {
  const image = $(elementId);
  if (!image) return;

  image.onerror = () => {
    image.classList.add('hidden');
    console.error('No se pudo cargar la imagen:', src);
  };

  image.onload = () => image.classList.remove('hidden');

  image.alt = altText || '';
  image.src = src;
}

function setChapterImage(chapterNumber) {
  setImage(
    'chapterImage',
    `assets/portada/cap${chapterNumber}.png`,
    `Imagen del capítulo ${chapterNumber}`
  );
}

function setFinishedImage() {
  setImage(
    'finishedImage',
    'assets/portada/vivirvaliente.png',
    'Viví Modo Valiente'
  );
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

  const { data: authData, error: authError } =
    await db.auth.signInAnonymously();

  if (authError) throw authError;

  return authData.session;
}

// --------------------------------------------------
// REGISTRAR PARTICIPANTE
// --------------------------------------------------

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

  sessionStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify(participant)
  );

  setParticipantName(participant.display_name);

  await loadRoom();
  subscribeToRoom();

  if (room.status === 'lobby') {
    showScreen('introScreen');
  } else {
    await renderRoom();
  }
}

// --------------------------------------------------
// RECUPERAR PARTICIPANTE DE LA MISMA PESTAÑA
// --------------------------------------------------

async function restoreParticipant() {
  const saved = sessionStorage.getItem(SESSION_STORAGE_KEY);

  if (!saved) return false;

  try {
    const storedParticipant = JSON.parse(saved);

    if (!storedParticipant.display_name) {
      throw new Error('No se encontró el nombre del participante.');
    }

    await ensureAuthenticated();

    const { data, error } = await db.rpc('join_room', {
      p_room_code: ROOM_CODE,
      p_display_name: storedParticipant.display_name
    });

    if (error) throw error;

    participant = {
      room_id: data.room_id,
      participant_id: data.participant_id,
      display_name: data.display_name
    };

    sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify(participant)
    );

    setParticipantName(participant.display_name);

    await loadRoom();
    subscribeToRoom();
    await renderRoom();

    console.log('PARTICIPANTE RECUPERADO Y REGISTRADO:', participant);

    return true;

  } catch (error) {
    console.error('No se pudo recuperar la participación:', error);

    sessionStorage.removeItem(SESSION_STORAGE_KEY);

    participant = null;

    return false;
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

// --------------------------------------------------
// REALTIME
// --------------------------------------------------

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

// --------------------------------------------------
// AVANCE AUTOMÁTICO DESPUÉS DE LOS RESULTADOS
// --------------------------------------------------

function clearResultsAdvanceTimer() {
  if (resultsAdvanceTimeout) {
    clearTimeout(resultsAdvanceTimeout);
    resultsAdvanceTimeout = null;
  }

  activeResultsKey = null;
}

async function scheduleAutomaticAdvance() {
  if (
    !room ||
    room.status !== 'results' ||
    !room.winning_choice
  ) {
    return;
  }

  if (!serverClockSynced) {
    await syncServerClock();
  }

  // Verificar nuevamente después de sincronizar el reloj.
  if (
    !room ||
    room.status !== 'results' ||
    !room.winning_choice
  ) {
    return;
  }

  const resultsKey =
    `${room.current_chapter}:${room.winning_choice}:${room.updated_at}`;

  // Si ya existe un temporizador para estos mismos resultados,
  // no lo reiniciamos.
  if (activeResultsKey === resultsKey) return;

  if (resultsAdvanceTimeout) {
    clearTimeout(resultsAdvanceTimeout);
    resultsAdvanceTimeout = null;
  }

  activeResultsKey = resultsKey;

  const resultsUpdatedAt = new Date(room.updated_at).getTime();
  const advanceAt = resultsUpdatedAt + 5000;
  const delay = Math.max(0, advanceAt - getServerNow());

  console.log('AVANCE AUTOMÁTICO PROGRAMADO:', {
    capitulo: room.current_chapter,
    ganador: room.winning_choice,
    esperaMilisegundos: delay
  });

  resultsAdvanceTimeout = setTimeout(() => {
    attemptAutomaticAdvance(resultsKey);
  }, delay);
}

async function attemptAutomaticAdvance(resultsKey) {
  if (
    activeResultsKey !== resultsKey ||
    !room ||
    room.status !== 'results' ||
    !room.winning_choice
  ) {
    return;
  }

  resultsAdvanceTimeout = null;

  try {
    const { data, error } = await db.rpc('auto_advance_after_results');

    if (error) throw error;

    console.log('RESPUESTA DEL AVANCE AUTOMÁTICO:', data);

    // Si Supabase indica que todavía faltan unos instantes,
    // volvemos a intentarlo.
    if (data?.waiting) {
      resultsAdvanceTimeout = setTimeout(() => {
        attemptAutomaticAdvance(resultsKey);
      }, 750);

      return;
    }

    // Si hay empate, esperamos la actualización del coordinador.
    if (data?.tie) {
      return;
    }

    // Actualizamos la sala para reflejar el nuevo estado.
    await loadRoom();
    await renderRoom();

  } catch (error) {
    console.error('ERROR EN EL AVANCE AUTOMÁTICO:', error);
  }
}

// --------------------------------------------------
// RENDERIZADO DE PANTALLAS
// --------------------------------------------------

async function renderRoom() {
  if (!room) return;

  if (rendering) {
    renderPending = true;
    return;
  }

  rendering = true;

  try {
    if (room.status !== 'voting') {
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }

      activeVotingKey = null;
    }

    if (room.status !== 'results') {
      clearResultsAdvanceTimer();
    }

    if (room.status === 'lobby') {
      showScreen('waitingScreen');

    } else if (room.status === 'characters') {
      showScreen('charactersScreen');

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
      setFinishedImage();
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

// --------------------------------------------------
// VOTACIÓN
// --------------------------------------------------

async function renderVoting() {
  if (!serverClockSynced) {
    await syncServerClock();
  }

  const votingKey = `${room.current_chapter}:${room.voting_ends_at}`;
  const isNewVoting = activeVotingKey !== votingKey;

  await loadChapter(room.current_chapter);

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

  setChapterImage(chapter.chapter_number);

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

// --------------------------------------------------
// RESULTADOS
// --------------------------------------------------

async function renderResults() {
  await loadChapter(room.current_chapter);

  if (!room || room.status !== 'results') return;

  showScreen('gameScreen');

  $('chapterLabel').textContent = `CAPÍTULO ${chapter.chapter_number}`;
  $('chapterTitle').textContent = chapter.title;
  $('chapterSituation').textContent = chapter.situation;

  setChapterImage(chapter.chapter_number);

  $('votingArea').classList.add('hidden');
  $('waitingResults').classList.remove('hidden');
  $('waitingResults').innerHTML = '';

  const title = document.createElement('strong');
  title.textContent = '¡Votación cerrada!';

  const description = document.createElement('p');

  if (room.winning_choice) {
    description.textContent =
      `El grupo eligió la opción ${room.winning_choice}. ¡En unos segundos descubrirán qué sucede!`;
  } else {
    description.textContent =
      '¡Hay un empate! El coordinador está definiendo cómo continúa la historia.';
  }

  $('waitingResults').append(title, description);

  // Solo programamos el avance cuando hay una opción ganadora.
  await scheduleAutomaticAdvance();
}

// --------------------------------------------------
// CONSECUENCIAS
// --------------------------------------------------

async function renderConsequence() {
  await loadChapter(room.current_chapter);

  showScreen('consequenceScreen');

  const winner = room.winning_choice;

  setChapterImage(chapter.chapter_number);

  $('consequenceChapter').textContent =
    `CONSECUENCIA · CAPÍTULO ${chapter.chapter_number}`;

  $('consequenceTitle').textContent = 'La decisión del grupo';

  $('consequenceText').textContent = winner === 'A'
    ? chapter.consequence_a
    : chapter.consequence_b;
}

// --------------------------------------------------
// FINAL
// --------------------------------------------------

async function renderFinal() {
  await loadChapter(7);

  showScreen('finalScreen');

  const winner = room.winning_choice;

  if (winner === 'A' || winner === 'B') {
    setImage(
      'finalImage',
      `assets/portada/final${winner}.png`,
      `Final de la opción ${winner}`
    );
  } else {
    $('finalImage').classList.add('hidden');
  }

  $('finalTitle').textContent = winner === 'A'
    ? 'UNA VIDA TRANSFORMADA'
    : 'MUCHAS VIDAS TRANSFORMADAS';

  $('finalText').textContent = winner === 'A'
    ? chapter.consequence_a
    : chapter.consequence_b;
}

// --------------------------------------------------
// INGRESO
// --------------------------------------------------

$('joinForm').addEventListener('submit', async (event) => {
  event.preventDefault();

  const name = $('displayName').value.trim();

  if (name.length < 2) {
    showMessage(
      $('joinMessage'),
      'Ingresá un nombre de al menos 2 caracteres.',
      true
    );

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

// --------------------------------------------------
// BOTONES
// --------------------------------------------------

$('charactersButton').addEventListener('click', () => {
  showScreen('charactersScreen');
});

$('readyButton').addEventListener('click', () => {
  showScreen('waitingScreen');
});

$('optionA').addEventListener('click', () => castVote('A'));
$('optionB').addEventListener('click', () => castVote('B'));

// --------------------------------------------------
// ENCUESTA
// --------------------------------------------------

$('surveyForm').addEventListener('submit', async (event) => {
  event.preventDefault();

  const selected = document.querySelector(
    'input[name="rating"]:checked'
  );

  if (!selected) {
    showMessage(
      $('surveyMessage'),
      'Elegí una valoración para continuar.',
      true
    );

    return;
  }

  $('surveyButton').disabled = true;
  $('surveyButton').textContent = 'ENVIANDO...';

  try {
    const rating = Number(selected.value);

    const { error } = await db.rpc('submit_survey', {
      p_rating: rating,
      p_comment: null
    });

    if (error) throw error;

    showScreen('finishedScreen');
    setFinishedImage();

  } catch (error) {
    showMessage($('surveyMessage'), error.message, true);

  } finally {
    $('surveyButton').disabled = false;
    $('surveyButton').textContent = 'ENVIAR RESPUESTA';
  }
});

// --------------------------------------------------
// INICIO DE LA APLICACIÓN
// --------------------------------------------------

async function startApp() {
  localStorage.removeItem(LEGACY_STORAGE_KEY);

  try {
    const restored = await restoreParticipant();

    if (restored) return;

  } catch (error) {
    console.error('Error al iniciar la aplicación:', error);
  }

  participant = null;

  setParticipantName('');

  showScreen('welcomeScreen');
}

startApp();
