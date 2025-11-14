// ========================================================================================
// Cubo di Rubik 3D interattivo con navigazione Design Thinking
// Combina le funzionalità del cubo di Rubik con la navigazione tra le pagine
// ========================================================================================

let scene, camera, renderer, raycaster, mouse;
let world, cubeRoot;
let isOpening = false;
let isDragging = false;
let dragStarted = false;
let previousMousePosition = { x: 0, y: 0 };
let particleSystem = null;
let cubelets = [];

//Mobile
let touchStartX = 0;
let touchStartY = 0;
let isTouching = false;
let touchMoved = false;

// Colori per le facce del cubo di Rubik (Design Thinking phases)
const COLORS = {
  U: 0x00B5D8, 
  D: 0x9C27B0, 
  L: 0xE91E63, 
  R: 0xFF6D00, 
  F: 0xFFC107, 
  B: 0xFF0000, 
  BODY: 0x0b0f18, 
  EDGE: 0x263046   
};

let phaseContents = {};

// Variabili per rotazione automatica
let inactivityTimer = null;
let autoRotateAnimation = null;
const INACTIVITY_DELAY = 2000;

// Variabili per il cubo
const cubieSize = 0.96, gap = 0.96, stickerSize = 0.8, stickerLift = 0.01;

init();
animate();
loadPhasesFromWordPress();


function init() {
  // Scena
  scene = new THREE.Scene();

  // Camera - FOV adattivo per device
  const isMobile = window.innerWidth < 800;
  const aspect = window.innerWidth / window.innerHeight;
  
  camera = new THREE.PerspectiveCamera(
    isMobile ? 30 : 40,  // FOV più stretto su mobile per cubo più piccolo
    aspect,
    0.1,
    100
  );
  
  // Posizionamento camera responsive
  if (isMobile) {
    // Su mobile, camera ancora più lontana per cubo più piccolo
    const distance = aspect < 0.6 ? 18 : (aspect < 0.75 ? 16 : 15);
    camera.position.set(0, 0, distance);
    camera.lookAt(0, 0, 0);
  } else {
    // Desktop - posizione classica
    camera.position.set(6.2, 5.4, 7.8);
    camera.lookAt(0, 0, 0);
  }

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  // Use the actual container size so the drawing buffer matches displayed canvas
  const container = document.getElementById('three-container');
  const width = container ? container.clientWidth : window.innerWidth;
  const height = container ? container.clientHeight : window.innerHeight;
  renderer.setSize(width, height, false);
  // Make the canvas scale to the container element
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  if (container) {
    container.appendChild(renderer.domElement);
  } else {
    console.error('Container #three-container non trovato!');
    document.body.appendChild(renderer.domElement);
  }
  // Luci
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const key = new THREE.DirectionalLight(0xffffff, 1.05);
  key.position.set(4, 7, 6);
  scene.add(key);
  const rim = new THREE.PointLight(0x88baff, 0.35);
  rim.position.set(-6, 3, -4);
  scene.add(rim);

  // Mondo
  world = new THREE.Group();
  scene.add(world);

  // Cubo di Rubik
  cubeRoot = new THREE.Group();
  world.add(cubeRoot);

  buildRubikCube();

  // Raycaster e mouse
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  // Eventi
  window.addEventListener("resize", onWindowResize);
  window.addEventListener("click", onClick);
  window.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
  window.addEventListener("touchstart", onTouchStart, { passive: false });
  window.addEventListener("touchmove", onTouchMove, { passive: false });
  window.addEventListener("touchend", onTouchEnd);

  // Avvia il timer di inattività
  resetInactivityTimer();
}

// Crea un cubo con angoli arrotondati
function createRoundedBox(width, height, depth, radius, smoothness) {
  const shape = new THREE.Shape();
  const eps = 0.00001;
  const radius0 = radius - eps;

  shape.absarc(eps, eps, eps, -Math.PI / 2, -Math.PI, true);
  shape.absarc(eps, height - radius * 2, eps, Math.PI, Math.PI / 2, true);
  shape.absarc(width - radius * 2, height - radius * 2, eps, Math.PI / 2, 0, true);
  shape.absarc(width - radius * 2, eps, eps, 0, -Math.PI / 2, true);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: depth - radius * 2,
    bevelEnabled: true,
    bevelSegments: smoothness,
    steps: 1,
    bevelSize: radius0,
    bevelThickness: radius,
    curveSegments: smoothness
  });

  geometry.center();
  return geometry;
}

// Crea uno sticker arrotondato con bordo bianco
function makeSticker(color, faceType, gridX, gridY) {
  const shape = new THREE.Shape();
  const radius = 0.08;
  const size = stickerSize;
  const x = -size / 2, y = -size / 2;

  shape.moveTo(x + radius, y);
  shape.lineTo(x + size - radius, y);
  shape.quadraticCurveTo(x + size, y, x + size, y + radius);
  shape.lineTo(x + size, y + size - radius);
  shape.quadraticCurveTo(x + size, y + size, x + size - radius, y + size);
  shape.lineTo(x + radius, y + size);
  shape.quadraticCurveTo(x, y + size, x, y + size - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);

  const g = new THREE.ShapeGeometry(shape);
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
    color,
    side: THREE.DoubleSide
  }));

  // Aggiunge bordo bianco
  const points = shape.getPoints(50);
  const borderGeometry = new THREE.BufferGeometry().setFromPoints(points);
  const borderMaterial = new THREE.LineBasicMaterial({ 
    color: 0xffffff, 
    linewidth: 2
  });
  const border = new THREE.LineLoop(borderGeometry, borderMaterial);
  mesh.add(border);

  return mesh;
}

// Crea il testo per la faccia centrale
function createTextForFace(faceType) {
  const texts = {
    'U': 'EMPATIA',
    'L': 'DEFINIZIONE',
    'F': 'IDEAZIONE',
    'R': 'PROTOTIPAZIONE',
    'D': 'TEST',
    'B': 'HOME'
  };

  const text = texts[faceType];
  if (!text) return null;

  // Parole lunghe hanno testo più piccolo
  const isLongWord = (faceType === 'L' || faceType === 'R');
  const fontSize = isLongWord ? 50 : 70;
  const baseScale = isLongWord ? 0.9 : 0.8;

  // Crea DUE texture: una normale e una speculare
  function createTexture(flip = false) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (flip) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 15;
    ctx.shadowOffsetX = flip ? -3 : 3;
    ctx.shadowOffsetY = 3;
    
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    
    return new THREE.CanvasTexture(canvas);
  }

  const normalTexture = createTexture(false);
  const flippedTexture = createTexture(true);

  // Crea il plane
  const geometry = new THREE.PlaneGeometry(stickerSize * baseScale, stickerSize * baseScale);
  const material = new THREE.MeshBasicMaterial({
    map: normalTexture,
    transparent: true,
    side: THREE.DoubleSide,  // CRITICO: visibile da entrambi i lati
    depthWrite: false,
    opacity: 1.0
  });
  
  const mesh = new THREE.Mesh(geometry, material);
  mesh.scale.set(3.5, 3.5, 1);
  mesh.renderOrder = 999;
  
  // Salva entrambe le texture per lo switch dinamico
  mesh.userData.normalTexture = normalTexture;
  mesh.userData.flippedTexture = flippedTexture;
  mesh.userData.baseScale = baseScale;
  
  return mesh;
}

// Aggiunge gli sticker al cubetto in base alla sua posizione
function addStickers(mesh, x, y, z) {
  const off = cubieSize / 2 + stickerLift;
  if (x === +1) {
    const s = makeSticker(COLORS.R, 'R', y, z); // Griglia per faccia destra
    s.position.x = +off;
    s.rotation.y = -Math.PI / 2;
    s.userData.face = 'R';
    mesh.add(s);
    
    // Aggiunge testo separatamente se è il cubetto centrale
    if (y === 0 && z === 0) {
      const textMesh = createTextForFace('R');
      textMesh.position.x = +off + 0.01;
      textMesh.rotation.y = -Math.PI / 2;
      mesh.add(textMesh);
    }
  }
  if (x === -1) {
    const s = makeSticker(COLORS.L, 'L', -y, z); // Griglia per faccia sinistra
    s.position.x = -off;
    s.rotation.y = +Math.PI / 2;
    s.userData.face = 'L';
    mesh.add(s);
    
    if (y === 0 && z === 0) {
      const textMesh = createTextForFace('L');
      textMesh.position.x = -off - 0.01;
      textMesh.rotation.y = +Math.PI / 2;
      mesh.add(textMesh);
    }
  }
  if (y === +1) {
    const s = makeSticker(COLORS.U, 'U', x, -z); // Griglia per faccia sopra
    s.position.y = +off;
    s.rotation.x = -Math.PI / 2;
    s.userData.face = 'U';
    mesh.add(s);
    
    if (x === 0 && z === 0) {
      const textMesh = createTextForFace('U');
      textMesh.position.y = +off + 0.01;
      textMesh.rotation.x = -Math.PI / 2;
      mesh.add(textMesh);
    }
  }
  if (y === -1) {
    const s = makeSticker(COLORS.D, 'D', x, z); // Griglia per faccia sotto
    s.position.y = -off;
    s.rotation.x = +Math.PI / 2;
    s.userData.face = 'D';
    mesh.add(s);
    
    if (x === 0 && z === 0) {
      const textMesh = createTextForFace('D');
      textMesh.position.y = -off - 0.01;
      textMesh.rotation.x = +Math.PI / 2;
      mesh.add(textMesh);
    }
  }
  if (z === +1) {
    const s = makeSticker(COLORS.F, 'F', x, y); // Griglia per faccia davanti
    s.position.z = +off;
    s.userData.face = 'F';
    mesh.add(s);
    
    if (x === 0 && y === 0) {
      const textMesh = createTextForFace('F');
      textMesh.position.z = +off + 0.01;
      mesh.add(textMesh);
    }
  }
  if (z === -1) {
    const s = makeSticker(COLORS.B, 'B', -x, y); // Griglia per faccia dietro
    s.position.z = -off;
    s.rotation.y = Math.PI;
    s.userData.face = 'B';
    mesh.add(s);
    
    if (x === 0 && y === 0) {
      const textMesh = createTextForFace('B');
      textMesh.position.z = -off - 0.01;
      textMesh.rotation.y = Math.PI;
      mesh.add(textMesh);
    }
  }
}

// Costruisce il cubo di Rubik
function buildRubikCube() {
  while (cubeRoot.children.length) cubeRoot.remove(cubeRoot.children[0]);
  cubelets.length = 0;

  const bodyGeom = createRoundedBox(cubieSize, cubieSize, cubieSize, 0.08, 3);
  const bodyMat = new THREE.MeshStandardMaterial({ color: COLORS.BODY, roughness: .7, metalness: .1 });

  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        const body = new THREE.Mesh(bodyGeom, bodyMat.clone());
        body.position.set(x * gap, y * gap, z * gap);
        
        body.add(new THREE.LineSegments(
          new THREE.EdgesGeometry(bodyGeom),
          new THREE.LineBasicMaterial({ color: COLORS.EDGE })
        ));
        
        addStickers(body, x, y, z);
        cubeRoot.add(body);
        cubelets.push({ mesh: body });
      }
    }
  }
}

// Gestione eventi
function onWindowResize() {
  const isMobile = window.innerWidth < 800;
  // Prefer the #three-container size so canvas drawing matches displayed size
  const container = document.getElementById('three-container');
  const width = container ? container.clientWidth : window.innerWidth;
  const height = container ? container.clientHeight : window.innerHeight;
  const aspect = width / height;

  camera.aspect = aspect;

  // Aggiorna FOV in base al device
  camera.fov = isMobile ? 30 : 40;

  // Riposiziona camera se necessario
  if (isMobile && !isOpening) {
    const distance = aspect < 0.6 ? 18 : (aspect < 0.75 ? 16 : 15);
    camera.position.set(0, 0, distance);
    camera.lookAt(0, 0, 0);
  } else if (!isMobile && !isOpening) {
    camera.position.set(6.2, 5.4, 7.8);
    camera.lookAt(0, 0, 0);
  }

  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

// Drag per ruotare il cubo
function onMouseDown(event) {
  resetInactivityTimer();
  isDragging = false;
  dragStarted = true;
  previousMousePosition = {
    x: event.clientX,
    y: event.clientY,
  };
}

// Drag per ruotare il cubo
function onMouseMove(event) {
  if (dragStarted && !isOpening) {
    resetInactivityTimer();
    const deltaX = event.clientX - previousMousePosition.x;
    const deltaY = event.clientY - previousMousePosition.y;

    if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
      isDragging = true;
      world.rotation.y += deltaX * 0.005;
      world.rotation.x += deltaY * 0.003;
    }

    previousMousePosition = {
      x: event.clientX,
      y: event.clientY,
    };
  }
}

// Drag per ruotare il cubo
function onMouseUp() {
  dragStarted = false;
  setTimeout(() => {
    isDragging = false;
  }, 50);
}

function onTouchStart(event) {
  // Se è un tap sulla card laterale, non interferire
  if (event.target.closest('.phase-card')) {
    return;
  }
  
  // Previeni scroll durante drag
  if (event.touches.length === 1) {
    event.preventDefault();
  }
  
  resetInactivityTimer();
  isTouching = true;
  touchMoved = false;
  isDragging = false;
  dragStarted = true;
  
  const touch = event.touches[0];
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
  
  previousMousePosition = {
    x: touch.clientX,
    y: touch.clientY,
  };
}

function onTouchMove(event) {
  if (!isTouching || isOpening) return;
  
  // Previeni scroll durante drag
  if (event.touches.length === 1) {
    event.preventDefault();
  }
  
  resetInactivityTimer();
  
  const touch = event.touches[0];
  const deltaX = touch.clientX - previousMousePosition.x;
  const deltaY = touch.clientY - previousMousePosition.y;

  // Se si muove più di 5px, è un drag non un tap
  if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
    touchMoved = true;
    isDragging = true;
    
    // Rotazione più sensibile su mobile
    world.rotation.y += deltaX * 0.008;
    world.rotation.x += deltaY * 0.006;
  }

  previousMousePosition = {
    x: touch.clientX,
    y: touch.clientY,
  };
}

function onTouchEnd(event) {
  isTouching = false;
  dragStarted = false;
  
  // Se non si è mosso, è un tap (click)
  if (!touchMoved && event.changedTouches.length > 0) {
    const touch = event.changedTouches[0];
    
    // Simula un click
    const clickEvent = new MouseEvent('click', {
      clientX: touch.clientX,
      clientY: touch.clientY,
      bubbles: true,
    });
    
    // Piccolo delay per distinguere tap da drag
    setTimeout(() => {
      if (!isDragging) {
        onClick(clickEvent);
      }
      isDragging = false;
    }, 50);
  } else {
    setTimeout(() => {
      isDragging = false;
    }, 50);
  }
}


// Gestione click sugli sticker
function onClick(event) {
  resetInactivityTimer();

  if (isOpening || isDragging || animating) return; // Blocca click durante animazione

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  
  // Cerca intersezioni con gli sticker (ora sono gruppi, quindi cerca ricorsivamente)
  const allStickers = [];
  cubeRoot.children.forEach(cubelet => {
    cubelet.children.forEach(child => {
      if (child.userData.face) {
        allStickers.push(child);
      }
    });
  });

  const intersects = raycaster.intersectObjects(allStickers, false);

  if (intersects.length > 0) {
    const clickedSticker = intersects[0].object;
    const face = clickedSticker.userData.face;
    
    console.log(`Cliccato sulla faccia: ${face}`);
    
    // Determina quale fase in base alla faccia
    const faceToPhaseIndex = {
      'U': 0,  // EMPATIA
      'L': 1,  // DEFINIZIONE  
      'F': 2,  // IDEAZIONE
      'R': 3,  // PROTOTIPAZIONE
      'D': 4,  // TEST
      'B': 5   // HOME
    };
    
    const phaseIndex = faceToPhaseIndex[face];
    const faceColor = clickedSticker.material.color.getHexString();

    if (phaseIndex === 5) {
      // HOME - ANIMAZIONE SPETTACOLARE CON PARTICELLE!
      stopAutoRotate();
      closePhaseCard();
      clearTimeout(inactivityTimer);
      animating = true;
      
      // Crea particelle solo per HOME
      const stickerPos = new THREE.Vector3();
      clickedSticker.getWorldPosition(stickerPos);
      
      const normal = new THREE.Vector3();
      clickedSticker.getWorldDirection(normal);
      
      createParticlesFromFaceWithColor(
        clickedSticker,
        `#${faceColor}`,
        stickerPos,
        normal,
        true
      );
      
      playHomeAnimation();
    } else {
      // Altre fasi - NO PARTICELLE, solo card + animazione scramble
      stopAutoRotate();
      clearTimeout(inactivityTimer);
      // NON impostare animating = true qui, lo farà startScrambleAndSolve()
      
      // Rimuovo lo spostamento fisso e userò un centramento dinamico

      // Effetto bounce del cubo
      gsap.to(world.scale, {
        x: 1.15,
        y: 1.15,
        z: 1.15,
        duration: 0.15,
        yoyo: true,
        repeat: 1,
        ease: "power2.inOut",
      });

      // Mostra la card con un leggero ritardo
      setTimeout(() => {
        showPhaseCard(phaseIndex);
      }, 400);
      
      // Avvia l'animazione di scramble e risoluzione
      setTimeout(() => {
        startScrambleAndSolve();
      }, 800);
    }
  }
}

// ANIMAZIONE PER HOME
async function playHomeAnimation() {
  // Step 0: Nascondi tutti i testi SOLO durante l'animazione
  const allTexts = [];
  cubeRoot.children.forEach(cubelet => {
    cubelet.children.forEach(child => {
      if (child.userData && child.userData.baseScale) {
        allTexts.push(child);
        child.visible = false;
      }
    });
  });

  // Step 1: Forza camera e cubo FRONTALMENTE in modo ISTANTANEO
  camera.position.set(0, 0, 8);
  camera.up.set(0, 1, 0);
  camera.lookAt(0, 0, 0);
  if (camera.rotation && camera.rotation.set) {
    camera.rotation.set(0, 0, 0);
  }
  cubeRoot.rotation.set(0, 0, 0);

  // Ora puoi animare se vuoi effetto smooth, ma la vista parte già frontale
  await new Promise(resolve => {
    gsap.to(camera.position, {
      x: 0,
      y: 0,
      z: 8,
      duration: 0.8,
      ease: "power2.inOut"
    });
    gsap.to(camera.rotation, {
      x: 0,
      y: 0,
      z: 0,
      duration: 0.8,
      ease: "power2.inOut"
    });
    gsap.to(cubeRoot.rotation, {
      x: 0,
      y: 0,
      z: 0,
      duration: 0.8,
      ease: "power2.inOut",
      onComplete: resolve
    });
  });
  
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Step 2: Applica sticker rossi su TUTTE le 6 facce di OGNI cubetto
  const cubeletArray = cubeRoot.children;
  cubeletArray.forEach(cubelet => {
    const off = cubieSize / 2 + stickerLift;
    
    // Rimuovi tutti gli sticker esistenti (ma non i testi che hanno userData.baseScale!)
    const toRemove = [];
    cubelet.children.forEach(child => {
      if (child.material && !child.userData.baseScale) {
        toRemove.push(child);
      }
    });
    toRemove.forEach(child => cubelet.remove(child));
    
    // Aggiungi 6 sticker rossi (uno per faccia)
    const faces = [
      { pos: { x: +off, y: 0, z: 0 }, rot: { x: 0, y: -Math.PI/2, z: 0 } }, // Right
      { pos: { x: -off, y: 0, z: 0 }, rot: { x: 0, y: +Math.PI/2, z: 0 } }, // Left
      { pos: { x: 0, y: +off, z: 0 }, rot: { x: -Math.PI/2, y: 0, z: 0 } }, // Up
      { pos: { x: 0, y: -off, z: 0 }, rot: { x: +Math.PI/2, y: 0, z: 0 } }, // Down
      { pos: { x: 0, y: 0, z: +off }, rot: { x: 0, y: 0, z: 0 } },          // Front
      { pos: { x: 0, y: 0, z: -off }, rot: { x: 0, y: Math.PI, z: 0 } }     // Back
    ];
    
    faces.forEach(face => {
      const s = makeSticker(COLORS.B, 'B', 0, 0); // Rosso
      s.position.set(face.pos.x, face.pos.y, face.pos.z);
      s.rotation.set(face.rot.x, face.rot.y, face.rot.z);
      cubelet.add(s);
    });
  });
  
  // Step 3: Allinea tutti i cubetti in una griglia 3x9 (foglio)
  const gridPositions = [];
  
  // Crea griglia 3x9
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 9; col++) {
      gridPositions.push({
        x: (col - 4) * 1.2,
        y: (1 - row) * 1.2,
        z: 0
      });
    }
  }
  
  // Anima verso la griglia
  await new Promise(resolve => {
    cubeletArray.forEach((cubelet, i) => {
      if (i < gridPositions.length) {
        gsap.to(cubelet.position, {
          x: gridPositions[i].x,
          y: gridPositions[i].y,
          z: gridPositions[i].z,
          duration: 1.2,
          ease: "power2.inOut",
          delay: i * 0.02
        });
        
        gsap.to(cubelet.rotation, {
          x: 0,
          y: 0,
          z: 0,
          duration: 1.2,
          ease: "power2.inOut",
          delay: i * 0.02
        });
      }
    });
    setTimeout(resolve, 1200 + cubeletArray.length * 20);
  });
  
  // Step 4: Effetto wave - ogni cubetto si avvicina e ruota
  await new Promise(resolve => {
    cubeletArray.forEach((cubelet, i) => {
      const row = Math.floor(i / 9);
      const col = i % 9;
      const delay = (row + col) * 0.08;
      
      // Wave: avvicinamento
      gsap.to(cubelet.position, {
        z: 1.5,
        duration: 0.3,
        delay: delay,
        ease: "power2.out",
        onComplete: () => {
          gsap.to(cubelet.position, {
            z: 0,
            duration: 0.3,
            ease: "power2.in"
          });
        }
      });
      
      // Rotazione 180°
      gsap.to(cubelet.rotation, {
        y: Math.PI,
        duration: 0.6,
        delay: delay,
        ease: "power2.inOut"
      });
    });
    
    setTimeout(resolve, 2000);
  });
  
  // Step 5: Zoom out e vai alla home
  await new Promise(resolve => {
    gsap.to(world.scale, {
      x: 0,
      y: 0,
      z: 0,
      duration: 0.8,
      ease: "power2.in",
      onComplete: resolve
    });
  });
  
  setTimeout(() => {
    window.location.href = "./pages/_HOME_/home.html";
  }, 200);
}

async function loadPhasesFromWordPress() {
    try {
       const response = await fetch('/wp-json/wp/v2/cube-phases?per_page=6');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const phases = await response.json();
        
        if (!phases || phases.length === 0) {
            console.warn('Nessuna fase trovata, uso fallback');
            useFallbackContent();
            return;
        }
        
        // Mappa le fasi in base all'ordine
        const phaseMap = {
            1: 'EMPATIA',
            2: 'DEFINIZIONE',
            3: 'IDEAZIONE',
            4: 'PROTOTIPAZIONE',
            5: 'TEST',
            6: 'HOME'
        };
        
        phases.sort((a, b) => {
            const orderA = parseInt(a.phase_order) || 999;
            const orderB = parseInt(b.phase_order) || 999;
            return orderA - orderB;
        });

        phases.forEach(phase => {
            const order = parseInt(phase.phase_order) || 0;
            const phaseName = phaseMap[order];
            
            if (phaseName) {
                phaseContents[phaseName] = {
                    title: phase.title.rendered || phaseName,
                    color: phase.phase_color || getDefaultColor(phaseName),
                    content: buildPhaseContent(phase)
                };
            }
        });
        
        console.log('Fasi caricate da WordPress:', Object.keys(phaseContents));
        
    } catch (error) {
        console.error('Errore caricamento fasi WordPress:', error);
        useFallbackContent();
    }
}

// Costruisce il contenuto HTML della fase
function buildPhaseContent(phase) {
    let content = '';
    
    // Immagine in evidenza
    if (phase.featured_image_url) {
        content += `
            <img 
                src="${phase.featured_image_url}" 
                alt="${phase.title.rendered}"
                style="
                    width: 100%; 
                    max-height: 400px; 
                    object-fit: cover; 
                    border-radius: 16px; 
                    margin-bottom: 30px;
                    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
                "
            >
        `;
    }
    
    // Contenuto della fase
    content += phase.content.rendered || '<p>Contenuto non disponibile</p>';
    
    return content;
}

// Colori di default per ogni fase
function getDefaultColor(phaseName) {
    const colors = {
        'EMPATIA': '#00B5D8',
        'DEFINIZIONE': '#E91E63',
        'IDEAZIONE': '#FFC107',
        'PROTOTIPAZIONE': '#FF6D00',
        'TEST': '#9C27B0',
        'HOME': '#FF0000'
    };
    return colors[phaseName] || '#3498db';
}

// Contenuto di fallback se WordPress non risponde
function useFallbackContent() {
    phaseContents = {
        'EMPATIA': {
            title: 'EMPATIA',
            color: '#00B5D8',
            content: `
                <h3>Comprendere gli utenti</h3>
                <p>La fase di empatia consiste nel comprendere profondamente le esigenze, i desideri e le sfide degli utenti.</p>
                <h4>Obiettivi:</h4>
                <ul>
                    <li>Osservare gli utenti nel loro contesto</li>
                    <li>Condurre interviste approfondite</li>
                    <li>Identificare i punti di dolore</li>
                </ul>
            `
        },
        'DEFINIZIONE': {
            title: 'DEFINIZIONE',
            color: '#E91E63',
            content: `
                <h3>Definire il problema</h3>
                <p>Sintetizza le informazioni raccolte per definire chiaramente il problema da risolvere.</p>
            `
        },
        'IDEAZIONE': {
            title: 'IDEAZIONE',
            color: '#FFC107',
            content: `
                <h3>Generare idee</h3>
                <p>Brainstorming creativo per generare quante più soluzioni possibili.</p>
            `
        },
        'PROTOTIPAZIONE': {
            title: 'PROTOTIPAZIONE',
            color: '#FF6D00',
            content: `
                <h3>Creare prototipi</h3>
                <p>Trasforma le idee in prototipi tangibili da testare.</p>
            `
        },
        'TEST': {
            title: 'TEST',
            color: '#9C27B0',
            content: `
                <h3>Testare le soluzioni</h3>
                <p>Valida i prototipi con utenti reali e raccogli feedback.</p>
            `
        },
        'HOME': {
            title: 'HOME',
            color: '#FF0000',
            content: `<p>Torna alla homepage</p>`
        }
    };
    
    console.log('⚠️ Uso contenuto di fallback');
}



// CREA PARTICELLE DALLA FACCIA CLICCATA
function createParticlesFromFaceWithColor(faceMesh, color, intersectionPoint, faceNormal, shouldAnimateToRight = false) {
  if (particleSystem) {
    scene.remove(particleSystem);
    particleSystem.geometry.dispose();
    particleSystem.material.dispose();
    particleSystem = null;
  }

  const particleCount = 2000;
  const positions = new Float32Array(particleCount * 3);
  const velocities = [];

  const tempVec = new THREE.Vector3(1, 0, 0);
  if (Math.abs(faceNormal.dot(tempVec)) > 0.9) {
    tempVec.set(0, 1, 0);
  }

  const tangent1 = new THREE.Vector3().crossVectors(faceNormal, tempVec).normalize();
  const tangent2 = new THREE.Vector3().crossVectors(faceNormal, tangent1).normalize();

  for (let i = 0; i < particleCount; i++) {
    const u = (Math.random() - 0.5) * 0.9;
    const v = (Math.random() - 0.5) * 0.9;

    const offset = new THREE.Vector3()
      .addScaledVector(tangent1, u)
      .addScaledVector(tangent2, v)
      .addScaledVector(faceNormal, 0.01);

    positions[i * 3] = offset.x;
    positions[i * 3 + 1] = offset.y;
    positions[i * 3 + 2] = offset.z;

    velocities.push({
      x: (Math.random() - 0.5) * 0.02,
      y: (Math.random() - 0.5) * 0.02,
      z: (Math.random() - 0.5) * 0.02
    });
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: new THREE.Color(color),
    size: 0.02,
    transparent: true,
    opacity: 0.8
  });

  particleSystem = new THREE.Points(geometry, material);
  particleSystem.position.copy(intersectionPoint);
  particleSystem.userData.velocities = velocities;
  particleSystem.userData.shouldAnimateToRight = shouldAnimateToRight;

  if (shouldAnimateToRight) {
    particleSystem.userData.targetX = 3;
    particleSystem.userData.startTime = Date.now();
  }

  scene.add(particleSystem);

  setTimeout(() => {
    if (particleSystem) {
      scene.remove(particleSystem);
      particleSystem.geometry.dispose();
      particleSystem.material.dispose();
      particleSystem = null;
    }
  }, 3000);
}

// Aggiorna l'orientamento dei testi per essere sempre leggibili
function animateParticles() {
  if (particleSystem) {
    const positions = particleSystem.geometry.attributes.position.array;
    const velocities = particleSystem.userData.velocities;
    const shouldAnimateToRight = particleSystem.userData.shouldAnimateToRight;

    if (shouldAnimateToRight) {
      const elapsed = (Date.now() - particleSystem.userData.startTime) / 1000;
      const targetX = particleSystem.userData.targetX;
      const acceleration = Math.min(elapsed * 2, 3);

      for (let i = 0; i < positions.length; i += 3) {
        const currentX = particleSystem.position.x + positions[i];
        const currentY = particleSystem.position.y + positions[i + 1];
        const currentZ = particleSystem.position.z + positions[i + 2];

        const targetWorldX = targetX;
        const targetWorldY = 0;
        const targetWorldZ = camera.position.z;

        const dirX = targetWorldX - currentX;
        const dirY = targetWorldY - currentY;
        const dirZ = targetWorldZ - currentZ;

        const length = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ);
        if (length > 0.1) {
          positions[i] += (dirX / length) * 0.05 * acceleration;
          positions[i + 1] += (dirY / length) * 0.05 * acceleration;
          positions[i + 2] += (dirZ / length) * 0.05 * acceleration;
        }

        positions[i] += velocities[i / 3].x * 0.3;
        positions[i + 1] += velocities[i / 3].y * 0.3;
        positions[i + 2] += velocities[i / 3].z * 0.3;
      }
    }

    particleSystem.geometry.attributes.position.needsUpdate = true;
  }
}

// Mostra la card della fase caricando il contenuto HTML
function showPhaseCard(faceIndex) {
  const card = document.getElementById('phase-card');
  const top = document.getElementById('phase-card-top');
  const header = document.getElementById('card-header');
  const content = document.getElementById('card-content');

  // Mappa l'indice alla fase corrispondente
  const phaseNames = ['EMPATIA', 'DEFINIZIONE', 'IDEAZIONE', 'PROTOTIPAZIONE', 'TEST', 'HOME'];
  const phaseName = phaseNames[faceIndex];
  const phase = phaseContents[phaseName];

  if (phase) {
    // Imposta header
    header.textContent = phase.title;
    header.style.color = phase.color;
    
    // Imposta contenuto (già con immagini e HTML da WordPress)
    content.innerHTML = phase.content;
    
    // Scroll automatico in alto
    content.scrollTop = 0;

    setTimeout(() => {
      card.classList.add('active');
      // Dopo che la card è attiva, centra il cubo nella zona rimasta visibile
      setTimeout(() => {
        gsap.to(world.position, {
          x: -8.5,
          y: -2,
          duration: 0.8,
          ease: "power2.inOut"
        });
      }, 420);
    }, 100);
  } else {
    console.error('❌ Fase non trovata:', phaseName, 'Index:', faceIndex);
  }
}

// Chiude la card della fase
function closePhaseCard() {
  const card = document.getElementById('phase-card');
  card.classList.remove('active');

  if (world) {
    gsap.to(world.position, {
      x: 0,
      y: 0,
      duration: 0.8,
      ease: "power2.inOut"
    });
  }
  
  // Resetta lo stato di animating per permettere nuovi click
  animating = false;
  
  // Riavvia il timer di inattività
  resetInactivityTimer();
}

// Starta l'animazione di movimento automatico
function startAutoRotate() {
  if (!isOpening && world) {
    autoRotateAnimation = gsap.to(world.rotation, {
      y: "+=6.28319",
      duration: 20,
      ease: "none",
      repeat: -1
    });
  }
}

// Ferma l'animazione di movimento automatico
function stopAutoRotate() {
  if (autoRotateAnimation) {
    autoRotateAnimation.kill();
    autoRotateAnimation = null;
  }
}

// Timer di inattività per avviare l'animazione automatica
function resetInactivityTimer() {
  stopAutoRotate();

  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
  }

  if (!isOpening) {
    inactivityTimer = setTimeout(() => {
      startAutoRotate();
    }, INACTIVITY_DELAY);
  }
}

// Loop di animazione principale
function animate() {
  requestAnimationFrame(animate);
  
  // Aggiorna orientamento testi in base alla camera
  updateTextOrientation();
  
  animateParticles();
  renderer.render(scene, camera);
}

// ========================================================================================
// Sistema di animazione automatica: Scramble e Solve
// ========================================================================================

let queue = [];
let animating = false;
let lastScramble = [];

const AXIS = { U: 'y', D: 'y', L: 'x', R: 'x', F: 'z', B: 'z' };
const LAYER = { U: +1, D: -1, L: -1, R: +1, F: +1, B: -1 };
const BASE = { U: -1, D: +1, L: +1, R: -1, F: -1, B: +1 };
const VEC = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };

const idx = (v) => Math.round(v / gap);

function onLayer(m, axis, layer) {
  return idx(m.position[axis]) === layer;
}

function selectLayer(axis, layer) {
  return cubelets.filter(c => onLayer(c.mesh, axis, layer));
}

function moveSpec(tok) {
  const f = tok[0], axis = AXIS[f], layer = LAYER[f];
  const mult = tok.endsWith("2") ? 2 : 1;
  const prime = tok.endsWith("'") ? -1 : 1;
  const angle = BASE[f] * prime * (Math.PI / 2) * mult;
  return { axis, layer, angle };
}

function snapCubie(m) {
  m.position.set(idx(m.position.x) * gap, idx(m.position.y) * gap, idx(m.position.z) * gap);
  const q = Math.PI / 2;
  m.rotation.x = Math.round(m.rotation.x / q) * q;
  m.rotation.y = Math.round(m.rotation.y / q) * q;
  m.rotation.z = Math.round(m.rotation.z / q) * q;
}

function applyMove(token, duration) {
  return new Promise(resolve => {
    const { axis, layer, angle } = moveSpec(token);
    const parts = selectLayer(axis, layer);
    const g = new THREE.Group();
    cubeRoot.add(g);
    parts.forEach(p => g.attach(p.mesh));

    const axisVec = VEC[axis];
    const start = performance.now();
    const baseRot = g.rotation.clone();

    (function anim(now) {
      const t = Math.min(1, (now - start) / duration);
      const e = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      g.rotation.copy(baseRot);
      g.rotateOnAxis(axisVec, angle * e);
      renderer.render(scene, camera);
      if (t < 1) return requestAnimationFrame(anim);

      while (g.children.length) {
        const m = g.children[0];
        cubeRoot.attach(m);
        snapCubie(m);
      }
      cubeRoot.remove(g);
      resolve();
    })(performance.now());
  });
}

async function runQueue() {
  while (queue.length) {
    const mv = queue.shift();
    await applyMove(mv, 120);
  }
}

function pushMoves(toks) {
  queue.push(...toks);
}

function inverseMoves(arr) {
  return arr.slice().reverse().map(t => t.endsWith("2") ? t : (t.endsWith("'") ? t.slice(0, -1) : t + "'"));
}

function randomScramble(n = 22) {
  const FACES = ["U", "D", "L", "R", "F", "B"];
  const AX_OF = { U: 'y', D: 'y', L: 'x', R: 'x', F: 'z', B: 'z' };
  const out = [];
  let prev = null;
  for (let i = 0; i < n; i++) {
    let f;
    do {
      f = FACES[(Math.random() * FACES.length) | 0];
    } while (AX_OF[f] === prev);
    prev = AX_OF[f];
    const suf = Math.random() < 0.5 ? "" : (Math.random() < 0.5 ? "'" : "2");
    out.push(f + suf);
  }
  return out;
}

async function uploadQRCode() {
  if (animating) return;
}

async function startAutoAnimation() {
  if (animating) return;
  
  animating = true;
  console.log("Inizio animazione...");
  
  // Reset del cubo (già risolto)
  buildRubikCube();
  
  // Testi partono già grandi (cubo risolto)
  scaleAllTexts(3.5);
  
  // Attendi 1 secondo per mostrare il cubo risolto
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Genera scramble
  const scramble = randomScramble(22);
  lastScramble = scramble.slice();
  
  console.log("Scramble:", scramble.join(" "));
  
  // Avvia CONTEMPORANEAMENTE lo scramble E l'animazione del testo
  const scramblePromise = (async () => {
    pushMoves(scramble);
    await runQueue();
  })();
  
  const textAnimationPromise = animateTextsToSmall();
  
  // Aspetta che entrambi finiscano
  await Promise.all([scramblePromise, textAnimationPromise]);
  
  console.log("Scramble completato");
  
  // Attendi 1 secondo
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Genera e esegui solve
  const solve = inverseMoves(lastScramble);
  console.log("Solve:", solve.join(" "));
  
  pushMoves(solve);
  await runQueue();
  
  console.log("Solve completato");
  
  // Animazione di ingrandimento testo (ritornano grandi)
  console.log("Ingrandimento testi...");
  await animateTextScale();
  
  animating = false;
  console.log("Animazione completata");
}

// ========================================================================================
// ANIMAZIONE DI ASSEMBLAGGIO - Cubetti si uniscono per formare il cubo
// ========================================================================================
async function startAssemblyAnimation() {
  if (animating) return;
  
  animating = true;
  console.log("Inizio animazione di assemblaggio...");
  
  // Salva le posizioni finali di ogni cubetto
  const finalPositions = [];
  cubeRoot.children.forEach((cubelet, i) => {
    finalPositions.push({
      x: cubelet.position.x,
      y: cubelet.position.y,
      z: cubelet.position.z
    });
  });
  
  // Dispersi i cubetti in posizioni casuali lontane
  cubeRoot.children.forEach((cubelet, i) => {
    const randomX = (Math.random() - 0.5) * 15;
    const randomY = (Math.random() - 0.5) * 15;
    const randomZ = (Math.random() - 0.5) * 15;
    
    cubelet.position.set(randomX, randomY, randomZ);
    
    // Rotazione casuale iniziale
    cubelet.rotation.x = Math.random() * Math.PI * 2;
    cubelet.rotation.y = Math.random() * Math.PI * 2;
    cubelet.rotation.z = Math.random() * Math.PI * 2;
    
    // Scala iniziale ridotta
    cubelet.scale.set(0.3, 0.3, 0.3);
  });
  
  // Testi partono invisibili e piccoli
  cubeRoot.children.forEach(cubelet => {
    cubelet.children.forEach(child => {
      if (child.userData && child.userData.baseScale && child.geometry && child.geometry.type === 'PlaneGeometry') {
        child.scale.set(0, 0, 1);
        child.visible = true;
      }
    });
  });
  
  // Attendi un momento per vedere i cubetti dispersi
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Animazione di assemblaggio - ogni cubetto torna alla sua posizione
  cubeRoot.children.forEach((cubelet, i) => {
    const delay = i * 0.03; // Delay progressivo per effetto a cascata
    const finalPos = finalPositions[i];
    
    // Animazione posizione
    gsap.to(cubelet.position, {
      x: finalPos.x,
      y: finalPos.y,
      z: finalPos.z,
      duration: 1.2,
      delay: delay,
      ease: "back.out(1.7)" // Effetto elastico
    });
    
    // Animazione rotazione
    gsap.to(cubelet.rotation, {
      x: 0,
      y: 0,
      z: 0,
      duration: 1.2,
      delay: delay,
      ease: "power2.out"
    });
    
    // Animazione scala
    gsap.to(cubelet.scale, {
      x: 1,
      y: 1,
      z: 1,
      duration: 1.2,
      delay: delay,
      ease: "back.out(1.7)"
    });
  });
  
  // Aspetta che tutti i cubetti siano assemblati
  await new Promise(resolve => setTimeout(resolve, 1200 + cubeRoot.children.length * 30));
  
  // Animazione finale: testi appaiono e crescono
  console.log("Apparizione testi...");
  cubeRoot.children.forEach(cubelet => {
    cubelet.children.forEach(child => {
      if (child.userData && child.userData.baseScale && child.geometry && child.geometry.type === 'PlaneGeometry') {
        gsap.to(child.scale, {
          x: 3.5,
          y: 3.5,
          z: 1,
          duration: 0.8,
          ease: "elastic.out(1, 0.6)"
        });
      }
    });
  });
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  animating = false;
  console.log("Animazione di assemblaggio completata!");
}

// Funzione per eseguire scramble e solve senza resettare il cubo
async function startScrambleAndSolve() {
  if (animating) {
    console.log("Animazione già in corso, saltata");
    return;
  }
  
  animating = true;
  console.log("Inizio scramble e solve...");
  
  // NON resettiamo il cubo, partiamo dallo stato corrente
  
  // Genera scramble
  const scramble = randomScramble(18); // Ridotto da 22 a 18 per velocizzare
  lastScramble = scramble.slice();
  
  console.log("Scramble:", scramble.join(" "));
  
  // Avvia CONTEMPORANEAMENTE lo scramble E l'animazione del testo
  const scramblePromise = (async () => {
    pushMoves(scramble);
    await runQueue();
  })();
  
  const textAnimationPromise = animateTextsToSmall();
  
  // Aspetta che entrambi finiscano
  await Promise.all([scramblePromise, textAnimationPromise]);
  
  console.log("Scramble completato");
  
  // Attendi 0.3 secondi
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Genera e esegui solve
  const solve = inverseMoves(lastScramble);
  console.log("Solve:", solve.join(" "));
  
  pushMoves(solve);
  await runQueue();
  
  console.log("Solve completato");
  
  // Animazione di ingrandimento testo (ritornano grandi)
  console.log("Ingrandimento testi...");
  await animateTextScale();
  
  animating = false;
  console.log("Animazione completata - cubo pronto per nuovi click");
}

function scaleAllTexts(scale) {
  cubeRoot.children.forEach(cubelet => {
    cubelet.children.forEach(child => {
      if (child.userData && child.userData.baseScale && child.geometry && child.geometry.type === 'PlaneGeometry') {
        const baseScale = child.userData.baseScale;
        child.scale.set(scale, scale, 1);
      }
    });
  });
}

function animateTextsToSmall() {
  return new Promise(resolve => {
    cubeRoot.children.forEach(cubelet => {
      cubelet.children.forEach(child => {
        if (child.userData && child.userData.baseScale && child.geometry && child.geometry.type === 'PlaneGeometry') {
          gsap.to(child.scale, {
            x: 1.0,
            y: 1.0,
            z: 1,
            duration: 2.6,
            ease: "power2.inOut"
          });
        }
      });
    });
    setTimeout(resolve, 2600);
  });
}

async function animateTextScale() {
  return new Promise(resolve => {
    cubeRoot.children.forEach(cubelet => {
      cubelet.children.forEach(child => {
        if (child.userData && child.userData.baseScale && child.geometry && child.geometry.type === 'PlaneGeometry') {
          gsap.to(child.scale, {
            x: 3.5,
            y: 3.5,
            z: 1,
            duration: 1.5,
            ease: "elastic.out(1, 0.5)"
          });
        }
      });
    });
    setTimeout(resolve, 1500);
  });
}

// Funzione per switchare texture in base all'angolo della camera
function updateTextOrientation() {
  const cameraPosition = new THREE.Vector3();
  camera.getWorldPosition(cameraPosition);
  
  cubeRoot.children.forEach(cubelet => {
    cubelet.children.forEach(child => {
      if (child.userData && child.userData.normalTexture && child.userData.flippedTexture) {
        // Ottieni posizione del testo e la sua normale in world space
        const textWorldPos = new THREE.Vector3();
        child.getWorldPosition(textWorldPos);
        
        const normal = new THREE.Vector3(0, 0, 1);
        normal.applyQuaternion(child.getWorldQuaternion(new THREE.Quaternion()));
        
        // Calcola direzione dalla faccia alla camera
        const toCamera = new THREE.Vector3().subVectors(cameraPosition, textWorldPos).normalize();
        
        // Se la normale punta verso la camera (dot > 0), usa texture normale
        // Altrimenti (camera dietro la faccia), usa texture flippata
        const dot = normal.dot(toCamera);
        if (dot > 0) {
          child.material.map = child.userData.normalTexture;
        } else {
          child.material.map = child.userData.flippedTexture;
        }
        child.material.needsUpdate = true;
      }
    });
  });
}

// Event listener per il pulsante
document.addEventListener('DOMContentLoaded', () => {
  // const resetBtn = document.getElementById('reset-animation-btn');
  // if (resetBtn) {
  //   resetBtn.addEventListener('click', () => {
  //     if (!animating) {
  //       startAutoAnimation();
  //     }
  //   });
  // }

  // Avvia animazione di assemblaggio all'avvio
  setTimeout(() => {
    startAssemblyAnimation();
  }, 500);

  // Crea un wrapper per posizionare bottone e QR code
  const qrWrapper = document.createElement('div');
  qrWrapper.id = 'qr-code-wrapper';
  document.body.appendChild(qrWrapper);

  // Bottone con immagine (quadrato, bordo arrotondato 20px)
  const qrCodeBtn = document.createElement('button');
  qrCodeBtn.id = 'qr-code-btn';
  const btnImg = document.createElement('img');
  btnImg.src = './qrCodeLogo.png';
  btnImg.alt = 'Apri QR';
  btnImg.style.width = '48px';
  btnImg.style.height = '48px';
  btnImg.style.display = 'block';
  qrCodeBtn.appendChild(btnImg);
  qrWrapper.appendChild(qrCodeBtn);

  // Finestra QR code (immagine senza logo)
  const qrCodeContainer = document.createElement('div');
  qrCodeContainer.id = 'qr-code-container';
  qrCodeContainer.style.display = 'none';
  const qrImg = document.createElement('img');
  qrImg.src = './qrCode.png'; 
  qrImg.alt = 'QR Code';
  qrImg.style.width = '200px';
  qrImg.style.height = '220px';
  qrCodeContainer.appendChild(qrImg);
  qrWrapper.appendChild(qrCodeContainer);

  // Toggle finestra QR code
  qrCodeBtn.addEventListener('click', () => {
    qrCodeContainer.style.display = (qrCodeContainer.style.display === 'block') ? 'none' : 'block';
  });
});
