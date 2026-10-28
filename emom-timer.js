const CIRCUMFERENCE = 2 * Math.PI * 176; // 1105.84px
const ICON_ARC = (240 / 360) * CIRCUMFERENCE; // 737.23px
const PLANK_LENGTH = 360;

const ring = document.getElementById('emom-ring');
const plank = document.getElementById('plank-path');
const head = document.getElementById('head-node');
const floor = document.getElementById('floor-line');
const hud = document.getElementById('timer-hud');
const secText = document.getElementById('seconds-text');

function setMorphProgress(progress) {
    // Bei 100% Morph alle Icon-Innenelemente hart sperren (kein Aufblitzen beim Reset)
    const isComplete = progress >= 0.999;
    plank.style.display = isComplete ? 'none' : 'block';
    head.style.display = isComplete ? 'none' : 'block';
    floor.style.display = isComplete ? 'none' : 'block';

    // 1. Bodenlinie blendet sanft aus (0% -> 40%)
    const floorT = Math.min(1, progress / 0.40);
    floor.style.opacity = (1 - floorT).toFixed(2);

    // 2. Plank & Arm ziehen sich in den 8-Uhr-Punkt (103.58, 344) zurück
    const plankT = Math.min(1, progress / 0.52);
    const remainingLen = PLANK_LENGTH * (1 - plankT);
    plank.setAttribute('stroke-dasharray', `${Math.max(0, remainingLen).toFixed(2)} ${PLANK_LENGTH}`);
    plank.setAttribute('stroke-linecap', remainingLen < 4 ? 'butt' : 'round');
    plank.style.opacity = remainingLen < 2 ? '0' : '1';

    // 3. Kopf verschmilzt ins Zentrum
    const headT = Math.min(1, progress / 0.42);
    head.setAttribute('cx', (352 - headT * 96).toFixed(2));
    head.setAttribute('cy', (190 + headT * 66).toFixed(2));
    head.setAttribute('r', Math.max(0, 22 * (1 - headT)).toFixed(2));
    head.style.opacity = (1 - headT).toFixed(2);

    // 4. Ring lädt sich von 240° auf 360° (60 Sekunden) auf
    const ringT = Math.max(0, Math.min(1, (progress - 0.18) / 0.64));
    const currentArc = ICON_ARC + ringT * (CIRCUMFERENCE - ICON_ARC);
    ring.setAttribute('stroke-dasharray', `${currentArc.toFixed(2)} ${CIRCUMFERENCE.toFixed(2)}`);

    // 5. Scharfe Sekundenzahl im Zentrum einblenden
    const hudT = Math.max(0, Math.min(1, (progress - 0.45) / 0.55));
    hud.setAttribute('opacity', hudT.toFixed(2));
    hud.setAttribute('transform', `scale(${(0.88 + hudT * 0.12).toFixed(3)})`);
}