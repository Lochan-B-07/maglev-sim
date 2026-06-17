import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// --- 1. Scene Setup (Realistic Daylight) ---
const scene = new THREE.Scene();
const skyColor = new THREE.Color(0x87CEEB); // Natural sky blue
scene.background = skyColor;
// Fog helps blend the horizon so it doesn't look like a floating island
scene.fog = new THREE.Fog(skyColor, 30, 150); 

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

// We turn Antialiasing back on for smooth, crisp edges
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Soft, realistic shadows
renderer.toneMapping = THREE.ACESFilmicToneMapping; // Cinematic color grading
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// --- 2. Lighting (Sun & Atmosphere) ---
// Hemisphere light simulates light bouncing off the sky and the grass
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
scene.add(hemiLight);

// Directional light acts as our Sun
const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
sunLight.position.set(50, 80, 20);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048; // High-res shadows
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 150;
sunLight.shadow.camera.left = -50;
sunLight.shadow.camera.right = 50;
sunLight.shadow.camera.top = 50;
sunLight.shadow.camera.bottom = -50;
scene.add(sunLight);

// --- 3. Realistic Environment & Models ---
// Vast Grass/Ground Plane
const groundGeom = new THREE.PlaneGeometry(500, 500);
const groundMat = new THREE.MeshStandardMaterial({ 
    color: 0x3b5e2b, // Muted natural green
    roughness: 1.0,
    metalness: 0.0
});
const ground = new THREE.Mesh(groundGeom, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.5;
ground.receiveShadow = true;
scene.add(ground);

// Concrete Track Base
const trackGeom = new THREE.BoxGeometry(2, 0.4, 200);
const trackMat = new THREE.MeshStandardMaterial({ 
    color: 0x888888, // Concrete grey
    roughness: 0.9 
});
const track = new THREE.Mesh(trackGeom, trackMat);
track.receiveShadow = true;
track.castShadow = true;
scene.add(track);

// Copper Induction Coils (No longer glowing)
const coilGeom = new THREE.BoxGeometry(2.2, 0.05, 0.5);
const coilMat = new THREE.MeshStandardMaterial({ 
    color: 0xb87333, // Pure copper
    metalness: 0.8,  // Highly metallic
    roughness: 0.3   // Slightly polished
});

for (let z = -98; z <= 98; z += 4) {
    const coil = new THREE.Mesh(coilGeom, coilMat);
    coil.position.set(0, 0.18, z);
    coil.receiveShadow = true;
    scene.add(coil);
}

// Scenery (Pine Trees for speed reference)
const treeGroup = new THREE.Group();
const trunkGeom = new THREE.CylinderGeometry(0.2, 0.3, 1.5);
const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3219, roughness: 1.0 });
const leavesGeom = new THREE.ConeGeometry(1.2, 4);
const leavesMat = new THREE.MeshStandardMaterial({ color: 0x2d4c1e, roughness: 0.9 });

for (let i = 0; i < 80; i++) {
    const isRightSide = Math.random() > 0.5;
    const xDist = (Math.random() * 20) + 4; // Between 4 and 24 units away from track
    const xPos = isRightSide ? xDist : -xDist;
    const zPos = (Math.random() * 200) - 100;

    const trunk = new THREE.Mesh(trunkGeom, trunkMat);
    trunk.position.set(xPos, 0.25, zPos);
    trunk.castShadow = true;
    
    const leaves = new THREE.Mesh(leavesGeom, leavesMat);
    leaves.position.set(xPos, 2.5, zPos);
    leaves.castShadow = true;

    treeGroup.add(trunk);
    treeGroup.add(leaves);
}
scene.add(treeGroup);

// The Maglev Train (Sleek, Automotive Paint Look)
const trainGroup = new THREE.Group();

// Main Chassis
const chassisGeom = new THREE.BoxGeometry(1.6, 0.9, 5);
const chassisMat = new THREE.MeshPhysicalMaterial({ 
    color: 0xeeeeee, 
    metalness: 0.2, 
    roughness: 0.1,
    clearcoat: 1.0, // Gives it that shiny, realistic automotive paint gloss
    clearcoatRoughness: 0.1
});
const chassis = new THREE.Mesh(chassisGeom, chassisMat);
chassis.position.y = 0.45;
chassis.castShadow = true;
trainGroup.add(chassis);

// Cockpit Window
const glassGeom = new THREE.BoxGeometry(1.62, 0.35, 1.2);
const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x111111,
    metalness: 0.9,
    roughness: 0.05,
    envMapIntensity: 1.0
});
const windowMesh = new THREE.Mesh(glassGeom, glassMat);
windowMesh.position.set(0, 0.6, 1.95);
trainGroup.add(windowMesh);

// Undercarriage Magnets
const magGeom = new THREE.BoxGeometry(1.3, 0.15, 4.8);
const magMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
const magnets = new THREE.Mesh(magGeom, magMat);
magnets.position.y = -0.05;
trainGroup.add(magnets);

scene.add(trainGroup);

// --- 4. Physics & PID State ---
const physics = {
    mass: 15000,
    gravity: 9.81,
    posY: 0.2, 
    velY: 0,
    posZ: -80,
    velZ: 0
};

const pid = {
    p: 500000,
    i: 1000,   
    d: 30000,  
    targetGap: 0.015,
    integralError: 0,
    lastError: 0
};

let propulsionForce = 60000;

// --- 5. UI Binding ---
document.getElementById('val-p').addEventListener('input', (e) => {
    pid.p = parseFloat(e.target.value);
    document.getElementById('lbl-p').innerText = `Proportional (P): ${(pid.p/1000).toFixed(0)}k`;
});
document.getElementById('val-d').addEventListener('input', (e) => {
    pid.d = parseFloat(e.target.value);
    document.getElementById('lbl-d').innerText = `Derivative (D): ${(pid.d/1000).toFixed(0)}k`;
});
document.getElementById('val-prop').addEventListener('input', (e) => {
    propulsionForce = parseFloat(e.target.value) * 1000;
    document.getElementById('lbl-prop').innerText = `Propulsion Force: ${e.target.value} kN`;
});

const telemetryUI = document.getElementById('telemetry');

// --- 6. Main Loop ---
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    let dt = Math.min(clock.getDelta(), 0.1);
    
    if (dt === 0) return; // Prevent initial NaN crash

    // --- Vertical PID Physics ---
    const currentGap = physics.posY - 0.2;
    const error = pid.targetGap - currentGap;
    
    pid.integralError += error * dt;
    const derivativeError = (error - pid.lastError) / dt;
    pid.lastError = error;

    const magForce = (pid.p * error) + (pid.i * pid.integralError) + (pid.d * derivativeError);
    const baseGravity = physics.mass * physics.gravity;
    
    const totalUpwardForce = Math.max(0, baseGravity + magForce); 
    const netForceY = totalUpwardForce - baseGravity;

    physics.velY += (netForceY / physics.mass) * dt;
    physics.posY += physics.velY * dt;

    if (physics.posY < 0.2) {
        physics.posY = 0.2;
        physics.velY = 0;
        pid.integralError = 0; 
    }

    // --- Horizontal Propulsion ---
    let accZ = 0;
    if (currentGap > 0.001) {
        const drag = 0.5 * 1.2 * Math.pow(physics.velZ, 2) * 0.5;
        accZ = (propulsionForce - drag) / physics.mass;
    } else {
        accZ = -physics.velZ * 5; 
    }

    physics.velZ += accZ * dt;
    physics.posZ += physics.velZ * dt;

    // Loop the world seamlessly
    if (physics.posZ > 90) physics.posZ = -90;

    // Apply Math to 3D Model
    trainGroup.position.set(0, physics.posY, physics.posZ);

    // Dynamic Camera Tracking
    camera.position.set(6, physics.posY + 4, physics.posZ - 12);
    controls.target.set(0, physics.posY, physics.posZ);
    controls.update();

    // Update Telemetry UI
    telemetryUI.innerText = 
        `Error: ${(error * 1000).toFixed(2)} mm\n` +
        `Gap: ${(currentGap * 1000).toFixed(2)} mm\n` +
        `Velocity: ${physics.velZ.toFixed(1)} m/s`;

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();