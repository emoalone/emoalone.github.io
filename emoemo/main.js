import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Global Vars
const { Engine, World, Bodies, Body, Runner, Composite, Mouse, MouseConstraint, Events, Query, Vector } = Matter;

let scene, camera, renderer, engine, world;
let introGroup, particleSystem; 
const INTRO_COUNT = 20; 

// Hybrid Globals
let physicsEngine, physicsRunner;
let dollScene, dollCamera, dollRenderer;
let dollMeshes = [];
let isMatterActive = false;
let dollReqId;

// Assets
const CARD_TEXTURES = [
    './img/卡_1217圓-02.png', './img/卡_1217圓-04.png', './img/卡_1217圓-18.png',
    './img/卡_1217圓-38.png', './img/卡_1217圓-52.png', './img/卡_1217圓-102.png', './img/卡_1217圓-92.png'
];
const CARD_BACK_TEXTURE = ['./img/卡_1217圓-41.png', './img/卡_1217圓-65.png', './img/卡_1217圓-113.png']; 
const DOLL_MODEL_PATH = './model/emo02.glb'; 

const QUIZ_DATA = [
    { 
      q: "伴侶因為工作太累，忘記了你們期待已久的紀念日晚餐。你的第一反應是？", 
      a1: "感到失落，但心想「他那麼辛苦，我不該為這種小事發脾氣」，默默把委屈吞下去。", 
      a2: "感到憤怒，並冷冷地說：「沒關係啊，反正工作永遠比我重要，我早就習慣了。」", 
      s1: "victim", s2: "blackmailer" 
    },
    { 
      q: "朋友臨時有事，取消了你們週末的旅行。你在回覆訊息時會？", 
      a1: "趕緊說「沒關係啦，正事要緊！」但其實內心充滿焦慮，擔心對方是不是不想跟自己出去。", 
      a2: "嘆口氣回覆：「好吧，雖然我為了這趟旅行推掉了其他約會，但既然你這麼忙就算了。」", 
      s1: "victim", s2: "blackmailer" 
    },
    { 
      q: "家人總是過度干涉你的職涯選擇，常常說「我們這都是為了你好」。你的感受是？", 
      a1: "覺得壓力很大、很痛苦，但又覺得如果不聽他們的話，自己就是個不知感恩的人。", 
      a2: "覺得不耐煩，反嗆：「你們根本不懂我！如果我以後過得不好，都是你們害的！」", 
      s1: "victim", s2: "blackmailer" 
    },
    { 
      q: "團隊合作時，同事把應該他負責的麻煩工作推到你身上。你會怎麼做？", 
      a1: "不知如何拒絕，怕破壞辦公室的和平氣氛，只好加班默默把事情做完。", 
      a2: "在群組標記他：「如果這個專案因為你進度落後，大家的心血就全毀了，你自己看著辦。」", 
      s1: "victim", s2: "blackmailer" 
    },
    { 
      q: "當你和親密的人發生激烈爭吵，對方為了冷靜選擇先離開現場。你的內心戲是？", 
      a1: "陷入恐慌，覺得自己做錯了什麼即將被拋棄，想立刻傳長篇大論道歉求對方回來。", 
      a2: "覺得被挑戰底線，心想：「你今天敢踏出這個門，我們之間就完了。」", 
      s1: "victim", s2: "blackmailer" 
    }
];

let currentQ = 0, scores = { victim: 0, blackmailer: 0 };

document.addEventListener('DOMContentLoaded', () => {
    const loader = document.getElementById('loader-wrap');
    if(loader) loader.style.display = 'none';

    // Bindings
    window.toggleMenu = () => {
        const menu = document.getElementById('mobile-menu-overlay');
        const burger = document.querySelector('.hamburger');
        menu.classList.toggle('active');
        burger.classList.toggle('active');
    };

    window.openQuizModal = () => {
        document.getElementById('quiz-modal').classList.remove('hidden');
        startQuiz();
    };
    
    window.closeModal = (id) => document.getElementById(id).classList.add('hidden');
    
    window.handleDecrypt = () => {
        const input = document.getElementById('user-input');
        if(input && input.value.trim().length < 1) { 
            alert("請先輸入內容喔！"); return; 
        }
        document.getElementById('decrypt-input-state').classList.add('hidden');
        document.getElementById('decrypt-result-state').classList.remove('hidden');
    };
    
    window.resetDecrypt = () => {
        document.getElementById('user-input').value = "";
        document.getElementById('decrypt-input-state').classList.remove('hidden');
        document.getElementById('decrypt-result-state').classList.add('hidden');
    };
    
    window.switchFanCard = (el) => {
        document.querySelectorAll('.fan-card').forEach(c => c.style.zIndex = "1"); 
        el.style.zIndex = "20";
    };
    
    window.restartQuiz = () => startQuiz();
    
    window.showQuotesBlock = () => {
        document.getElementById('result-blackmailer').classList.add('hidden');
        document.getElementById('result-quotes').classList.remove('hidden');
    };
    
    window.goToDecryptInput = () => {
        document.getElementById('quiz-modal').classList.add('hidden');
        document.getElementById('decrypt-modal').classList.remove('hidden');
        window.resetDecrypt();
    };

    window.answer = (c) => { 
        scores[c===1?'victim':'blackmailer']++; 
        currentQ++; 
        renderQuiz(); 
    };

    const input = document.getElementById('user-input');
    if(input) input.addEventListener("keypress", (e) => { if (e.key === "Enter") window.handleDecrypt(); });

    // Init
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined' && typeof Matter !== 'undefined') {
        gsap.registerPlugin(ScrollTrigger);
        
        if(document.getElementById('webgl-container')) initThree();
        
        ScrollTrigger.create({
            trigger: "#quiz-entry",
            start: "top bottom",
            onEnter: initHybridPhysics,
            onLeaveBack: stopHybridPhysics
        });

        initParallaxImages();
        initFogAnimation(); 
        animate();
    }
});

function initFogAnimation() {
    gsap.from(".fog-header", { scrollTrigger: { trigger: "#knowledge-section", start: "top 80%" }, y: 50, opacity: 0, duration: 1 });
    gsap.from(".fog-card", { scrollTrigger: { trigger: ".fog-grid", start: "top 80%" }, y: 50, opacity: 0, duration: 1, stagger: 0.2 });
    gsap.from(".timeline-line", { scrollTrigger: { trigger: ".timeline-container", start: "top 80%" }, height: 0, duration: 1.5, ease: "none" });
    gsap.utils.toArray(".timeline-item").forEach(item => { gsap.from(item, { scrollTrigger: { trigger: item, start: "top 85%" }, y: 30, opacity: 0, duration: 0.8 }); });
    gsap.from(".sos-tactical-card", { scrollTrigger: { trigger: ".sos-section", start: "top 80%" }, y: 50, opacity: 0, duration: 0.8, stagger: 0.2 });
}

function initParallaxImages() {
    if (window.innerWidth <= 768) return; 

    const images = document.querySelectorAll('.images img');
    images.forEach(img => {
        const speed = img.getAttribute('data-speed') || 1;
        gsap.to(img, { 
            y: -10 * speed, 
            scrollTrigger: { 
                trigger: "#section-2", 
                start: "top 70%", 
                end: "bottom top", 
                scrub: true 
            }, 
            force3D: true, 
            ease: "none" 
        });
    });
}

function startQuiz() {
    currentQ = 0; scores = { victim: 0, blackmailer: 0 }; 
    const modalContent = document.querySelector('#quiz-modal .modal-content');
    if(modalContent) modalContent.classList.remove('result-mode');
    ['result-blackmailer', 'result-victim', 'result-quotes'].forEach(id => { const el = document.getElementById(id); if(el) el.classList.add('hidden'); });
    const qBlock = document.getElementById('quiz-question-block');
    if(qBlock) qBlock.classList.remove('hidden');
    renderQuiz(); 
}

function renderQuiz() {
    const container = document.getElementById('quiz-container');
    const modalContent = document.querySelector('#quiz-modal .modal-content');
    const resultBlackmailer = document.getElementById('result-blackmailer');
    const resultVictim = document.getElementById('result-victim');
    if(!container) return;
    
    if(currentQ >= QUIZ_DATA.length) {
        document.getElementById('quiz-question-block').classList.add('hidden');
        modalContent.classList.add('result-mode');
        if (scores.blackmailer > scores.victim) resultBlackmailer.classList.remove('hidden');
        else resultVictim.classList.remove('hidden');
        return;
    }
    const d = QUIZ_DATA[currentQ];
    container.innerHTML = `
        <div style="font-size:5rem; font-family:serif; margin-bottom:10px; color:#ddd;">${(currentQ + 1).toString().padStart(2, '0')}</div>
        <h3 style="font-size:1.3rem; margin-bottom:30px; color:#333; line-height: 1.6; text-align: left;">${d.q}</h3>
        <div class="quiz-options">
            <button class="quiz-option-btn" onclick="window.answer(1)">${d.a1}</button>
            <button class="quiz-option-btn" onclick="window.answer(2)">${d.a2}</button>
        </div>
    `;
}

// ★★★ GLB + Matter.js Hybrid Engine ★★★
function initHybridPhysics() {
    if (isMatterActive) return;
    isMatterActive = true;
    
    const container = document.getElementById('matter-container');
    container.innerHTML = ''; 
    const w = container.clientWidth;
    const h = container.clientHeight;

    physicsEngine = Engine.create();
    physicsEngine.world.gravity.y = 0; 
    const world = physicsEngine.world;

    const thick = 200;
    const wallOpts = { isStatic: true, restitution: 1, friction: 0 };
    const ground = Bodies.rectangle(w / 2, h + thick/2, w + thick*2, thick, wallOpts);
    const roof = Bodies.rectangle(w / 2, -thick/2, w + thick*2, thick, wallOpts);
    const wallL = Bodies.rectangle(-thick/2, h / 2, thick, h + thick*2, wallOpts);
    const wallR = Bodies.rectangle(w + thick/2, h / 2, thick, h + thick*2, wallOpts);
    
    const dollsBodies = [];
    const DOLL_SIZE = 120; 
    
    for (let i = 0; i < 8; i++) {
        const physicsRadius = (DOLL_SIZE / 2) * 0.75;
        const body = Bodies.circle(Math.random() * w, Math.random() * h, physicsRadius, { 
            restitution: 0.6, 
            frictionAir: 0.01 
        });
        Body.setVelocity(body, { x: (Math.random()-0.5)*5, y: (Math.random()-0.5)*5 });
        dollsBodies.push(body);
    }
    Composite.add(world, [ground, roof, wallL, wallR, ...dollsBodies]);

    let currentMousePos = { x: -1000, y: -1000 };
    
    const updateRepelPos = (clientX, clientY) => {
        if(!container) return;
        const rect = container.getBoundingClientRect();
        currentMousePos.x = clientX - rect.left;
        currentMousePos.y = clientY - rect.top;
    };

    window.addEventListener('mousemove', (e) => updateRepelPos(e.clientX, e.clientY));
    
    window.addEventListener('touchmove', (e) => {
        if(e.touches.length > 0) updateRepelPos(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    
    window.addEventListener('touchstart', (e) => {
        if(e.touches.length > 0) updateRepelPos(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    
    window.addEventListener('touchend', () => {
        currentMousePos = { x: -1000, y: -1000 }; 
    });

    Events.on(physicsEngine, 'beforeUpdate', function() {
        const blastRadius = 100; 
        const forceStrength = 0.02; 

        const bodiesNearMouse = Query.region(dollsBodies, {
            min: { x: currentMousePos.x - blastRadius, y: currentMousePos.y - blastRadius },
            max: { x: currentMousePos.x + blastRadius, y: currentMousePos.y + blastRadius }
        });

        bodiesNearMouse.forEach(body => {
            let forceVector = Vector.sub(body.position, currentMousePos);
            forceVector = Vector.normalise(forceVector);
            const finalForce = Vector.mult(forceVector, forceStrength * body.mass);
            Body.applyForce(body, body.position, finalForce);
        });
    });

    dollScene = new THREE.Scene();
    dollCamera = new THREE.OrthographicCamera(w / -2, w / 2, h / 2, h / -2, 1, 1000);
    dollCamera.position.z = 500;

    dollRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    dollRenderer.setSize(w, h);
    dollRenderer.setPixelRatio(window.devicePixelRatio);
    // ★ 修改：確保 GLTF 模型的色彩空間正確，不會白白灰灰的 ★
    dollRenderer.outputColorSpace = THREE.SRGBColorSpace; 
    container.appendChild(dollRenderer.domElement);

    // ★ 修改：大幅提高環境光與平行光的強度，解決模型死白的問題 ★
    const ambientLight = new THREE.AmbientLight(0xffffff, .0); 
    dollScene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 3.0);
    dirLight.position.set(200, 300, 500); 
    dollScene.add(dirLight);

    dollMeshes = [];
    const loader = new GLTFLoader();

    loader.load(DOLL_MODEL_PATH, (gltf) => {
        const model = gltf.scene;

        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        model.position.sub(center); 

        const maxDim = Math.max(size.x, size.y, size.z);
        const scaleTarget = DOLL_SIZE / maxDim; 

        const wrapper = new THREE.Group();
        wrapper.add(model);
        wrapper.scale.set(scaleTarget, scaleTarget, scaleTarget);

        dollsBodies.forEach(body => {
            const clone = wrapper.clone();
            clone.rotation.x = Math.random() * Math.PI;
            clone.rotation.y = Math.random() * Math.PI;
            dollScene.add(clone);
            dollMeshes.push({ mesh: clone, body: body });
        });
    }, undefined, (err) => {
        console.warn(`GLB 載入失敗 (${DOLL_MODEL_PATH})，使用備用方塊。請確認檔案路徑。`, err);
        const geo = new THREE.BoxGeometry(DOLL_SIZE, DOLL_SIZE, DOLL_SIZE);
        const mat = new THREE.MeshStandardMaterial({ color: 0x00999a });
        dollsBodies.forEach(body => {
            const mesh = new THREE.Mesh(geo, mat);
            dollScene.add(mesh);
            dollMeshes.push({ mesh: mesh, body: body });
        });
    });

    const mouse = Mouse.create(dollRenderer.domElement);
    mouse.pixelRatio = window.devicePixelRatio || 1;
    mouse.element.removeEventListener("mousewheel", mouse.mousewheel);
    mouse.element.removeEventListener("DOMMouseScroll", mouse.mousewheel);

    const mouseConstraint = MouseConstraint.create(physicsEngine, {
        mouse: mouse,
        constraint: { stiffness: 0.2, render: { visible: false } }
    });
    Composite.add(world, mouseConstraint);

    physicsRunner = Runner.create();
    Runner.run(physicsRunner, physicsEngine);

    function animateDolls() {
        dollReqId = requestAnimationFrame(animateDolls);
        dollMeshes.forEach(obj => {
            obj.mesh.position.x = obj.body.position.x - w / 2;
            obj.mesh.position.y = -(obj.body.position.y - h / 2);
            obj.mesh.rotation.z = -obj.body.angle;
            obj.mesh.rotation.x += obj.body.speed * 0.01;
            obj.mesh.rotation.y += obj.body.speed * 0.01;
        });
        dollRenderer.render(dollScene, dollCamera);
    }
    animateDolls();
}

function stopHybridPhysics() {
    if (!isMatterActive) return;
    Runner.stop(physicsRunner);
    cancelAnimationFrame(dollReqId);
    if(dollRenderer) {
        dollRenderer.dispose();
        dollRenderer.domElement.remove();
    }
    physicsEngine = null;
    physicsRunner = null;
    dollScene = null;
    dollCamera = null;
    dollRenderer = null;
    dollMeshes = [];
    isMatterActive = false;
}

// --- Top Three.js Cards ---
function initThree() {
    const container = document.getElementById('webgl-container');
    if (!container) return;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 1, 3000);
    camera.position.z = 600; 
    
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    
    const ambient = new THREE.AmbientLight(0xffffff, 0.8); scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8); dirLight.position.set(500, 500, 1000); scene.add(dirLight);

    const textureLoader = new THREE.TextureLoader();
    createBackgroundParticles();
    introGroup = new THREE.Group(); scene.add(introGroup);
    
    const loadTexture = (path) => {
        return textureLoader.load(path, (t) => { t.colorSpace = THREE.SRGBColorSpace; });
    };

    for(let i=0; i<INTRO_COUNT; i++) {
        const frontPath = CARD_TEXTURES[i % CARD_TEXTURES.length];
        const backPath = CARD_BACK_TEXTURE[i % CARD_BACK_TEXTURE.length]; 
        
        const frontTex = loadTexture(frontPath);
        const backTex = loadTexture(backPath);

        const cardGroup = createDoubleSidedCard(frontTex, backTex);
        resetIntroCard(cardGroup, true);
        introGroup.add(cardGroup);
    }
    window.addEventListener('resize', onResize);
}

function createDoubleSidedCard(front, back) {
    const width = 150, height = 250, radius = 20, depth = 0.2; 
    
    const shape = new THREE.Shape();
    shape.moveTo(-width/2 + radius, height/2);
    shape.lineTo(width/2 - radius, height/2);
    shape.absarc(width/2 - radius, height/2 - radius, radius, Math.PI/2, 0, true);
    shape.lineTo(width/2, -height/2 + radius);
    shape.absarc(width/2 - radius, -height/2 + radius, radius, 0, -Math.PI/2, true);
    shape.lineTo(-width/2 + radius, -height/2);
    shape.absarc(-width/2 + radius, -height/2 + radius, radius, -Math.PI/2, Math.PI, true);
    shape.lineTo(-width/2, height/2 - radius);
    shape.absarc(-width/2 + radius, height/2 - radius, radius, Math.PI, Math.PI/2, true);

    const grp = new THREE.Group();
    const faceGeo = new THREE.ShapeGeometry(shape); 
    fixUVs(faceGeo);

    const f = new THREE.Mesh(faceGeo, new THREE.MeshBasicMaterial({ 
        map: front, color: 0xffffff, transparent: true,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    })); 
    f.position.z = depth / 2 + 0.5; 
    grp.add(f);

    const b = new THREE.Mesh(faceGeo, new THREE.MeshBasicMaterial({ 
        map: back, color: 0xffffff, transparent: true,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    })); 
    b.rotation.y = Math.PI; 
    b.position.z = -(depth / 2 + 0.5); 
    grp.add(b);

    const bodyGeo = new THREE.ExtrudeGeometry(shape, { depth: depth, bevelEnabled: false, steps: 1 });
    bodyGeo.center();

    const bodyMesh = new THREE.Mesh(bodyGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    grp.add(bodyMesh);

    return grp;
}

function fixUVs(geo) { 
    geo.computeBoundingBox(); 
    const max = geo.boundingBox.max, min = geo.boundingBox.min; 
    const w = max.x - min.x, h = max.y - min.y; 
    const uv = geo.attributes.uv, pos = geo.attributes.position; 
    for(let i=0; i<pos.count; i++) {
        uv.setXY(i, (pos.getX(i)-min.x)/w, (pos.getY(i)-min.y)/h); 
    }
    uv.needsUpdate = true; 
}

function resetIntroCard(card, isInit = false) { 
    card.position.x = (Math.random()-0.5)*window.innerWidth*0.8; 
    card.position.y = isInit ? (Math.random() - 0.5) * window.innerHeight : -window.innerHeight*0.8; 
    card.position.z = Math.random() * -600 - 100; 
    card.rotation.x = Math.random()*Math.PI; 
    card.rotation.y = Math.random()*Math.PI; 
    
    card.userData = { 
        speed: 0.3 + Math.random() * 0.5, 
        rotSpeedX: (Math.random() - 0.5) * 0.003, 
        rotSpeedY: (Math.random() - 0.5) * 0.003  
    }; 
}

function createBackgroundParticles() { 
    const geo = new THREE.BufferGeometry(); 
    const v = []; 
    for(let i=0; i<200; i++) v.push((Math.random()-0.5)*2000,(Math.random()-0.5)*2000,(Math.random()-0.5)*2000); 
    geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); 
    particleSystem = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x888888, size: 5 })); 
    scene.add(particleSystem); 
}

function animate() { 
    requestAnimationFrame(animate); 
    if(introGroup) introGroup.children.forEach(c => { 
        c.position.y += c.userData.speed; 
        c.rotation.x += c.userData.rotSpeedX; 
        c.rotation.y += c.userData.rotSpeedY; 
        if(c.position.y > window.innerHeight*1.2) resetIntroCard(c); 
    }); 
    if(particleSystem) particleSystem.rotation.y += 0.001; 
    
    camera.lookAt(scene.position); 
    renderer.render(scene, camera); 
}

function onResize() { 
    camera.aspect = window.innerWidth/window.innerHeight; 
    camera.updateProjectionMatrix(); 
    renderer.setSize(window.innerWidth, window.innerHeight); 
}