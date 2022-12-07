import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import galaxyVertexShader from './shaders/galaxy/vertex.glsl';
import galaxyFragmentShader from './shaders/galaxy/fragment.glsl';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { gsap } from 'gsap';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GlitchPass } from 'three/examples/jsm/postprocessing/GlitchPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';

/**
 * Cursor
 */
const cursorElement = document.querySelector('.cursor');
const cursorFollow = document.querySelector('.cursorFollow');
document.addEventListener('mousemove', (e) => {
	let clientX = e.clientX;
	let clientY = e.clientY;
	cursorFollow.style.transform = `translate3d(calc(${clientX}px - 50%), calc(${clientY}px - 50%), 0)`;
	cursorElement.style.left = clientX + 'px';
	cursorElement.style.top = clientY + 'px';

	if (sceneReady) {
		cursorElement.classList.add('active');
		cursorFollow.classList.add('active');
	}
});

/**
 * Loaders
 */
let sceneReady = false;
let endAnimation = false;
const loadingBarElement = document.querySelector('.loading-bar');
const logoElement = document.querySelector('.logo');
const buttonElement = document.querySelector('.button');
const loadingManager = new THREE.LoadingManager(
	// Loaded
	() => {
		// Wait a little
		window.setTimeout(() => {
			// Animate overlay
			gsap.to(material.uniforms.uAlpha, {
				duration: 3,
				value: 1,
				delay: 1,
			});

			// Update loadingBarElement
			loadingBarElement.classList.add('ended');
			loadingBarElement.style.transform = '';

			// Update logoElement
			logoElement.classList.add('ended');

			sceneReady = true;
			generateGalaxy();
		}, 500);

		window.setTimeout(() => {
			const timeline = gsap.timeline({
				onComplete: () => {
					endAnimation = true;
					startButton.classList.toggle('active');
				},
			});

			timeline.to(camera.position, {
				duration: 1.5,
				delay: 1,
				y: 2.343774727065503,
				z: 5.173704172508508,
				ease: 'power2.out',
			});
		}, 500);

		window.setTimeout(() => {
			buttonElement.classList.add('active');

			buttonElement.addEventListener('click', () => {
				buttonElement.classList.remove('active');
				gsap.to(material.uniforms.uAlpha, {
					duration: 3,
					value: 0,
				});

				window.setTimeout(() => {
					geometry.dispose();
					material.dispose();
					scene.remove(points);
					scene.background = environmentMap;
					scene.opacity = 0;

					glitchPass.enabled = true;
				}, 3000);
			});
		}, 2500);
	},

	// Progress
	(itemUrl, itemsLoaded, itemsTotal) => {
		// Calculate the progress and update the loadingBarElement
		const progressRatio = itemsLoaded / itemsTotal;
		loadingBarElement.style.transform = `scaleX(${progressRatio})`;
	}
);
const gltfLoader = new GLTFLoader(loadingManager);
const cubeTextureLoader = new THREE.CubeTextureLoader(loadingManager);
const textureLoader = new THREE.TextureLoader(loadingManager);

// Canvas
const canvas = document.querySelector('canvas.webgl');

// Scene
const scene = new THREE.Scene();

/**
 * Galaxy
 */
const parameters = {};
parameters.count = 200000;
parameters.size = 0.005;
parameters.radius = 5;
parameters.branches = 3;
parameters.spin = 1;
parameters.randomness = 0.24;
parameters.randomnessPower = 1.4;
parameters.insideColor = '#ff6030';
parameters.outsideColor = '#0D44CA';

/**
 * Environment map
 */
const environmentMap = cubeTextureLoader.load([
	'/textures/environmentMaps/galaxy/px.png',
	'/textures/environmentMaps/galaxy/nx.png',
	'/textures/environmentMaps/galaxy/py.png',
	'/textures/environmentMaps/galaxy/ny.png',
	'/textures/environmentMaps/galaxy/pz.png',
	'/textures/environmentMaps/galaxy/nz.png',
]);
environmentMap.encoding = THREE.sRGBEncoding;

/**
 * Sizes
 */
const sizes = {
	width: window.innerWidth,
	height: window.innerHeight,
};

window.addEventListener('resize', () => {
	// Update sizes
	sizes.width = window.innerWidth;
	sizes.height = window.innerHeight;

	// Update camera
	camera.aspect = sizes.width / sizes.height;
	camera.updateProjectionMatrix();

	// Update renderer
	renderer.setSize(sizes.width, sizes.height);
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

/**
 * Cursor
 */

const cursor = {};
cursor.x = 0;
cursor.y = 0;
window.addEventListener('mousemove', (event) => {
	cursor.x = event.clientX / sizes.width - 0.5;
	cursor.y = event.clientY / sizes.height - 0.5;
});
/**
 * Camera
 */
// Group
const cameraGroup = new THREE.Group();
scene.add(cameraGroup);
// Base camera
const camera = new THREE.PerspectiveCamera(
	75,
	sizes.width / sizes.height,
	0.1,
	100
);
camera.position.x = 0;
camera.position.y = 50;
camera.position.z = 0;
cameraGroup.add(camera);

// Controls
const controls = new OrbitControls(camera, canvas);
controls.enabled = false;
controls.enableDamping = true;

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
	canvas: canvas,
});
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

let geometry = null;
let material = new THREE.ShaderMaterial({
	depthWrite: false,
	blending: THREE.AdditiveBlending,
	vertexColors: true,
	transparent: true,
	uniforms: {
		uTime: { value: 0 },
		uSize: { value: 30 * renderer.getPixelRatio() },
		uAlpha: { value: 0 },
	},
	vertexShader: galaxyVertexShader,
	fragmentShader: galaxyFragmentShader,
});
let points = null;

const generateGalaxy = () => {
	if (points !== null) {
		geometry.dispose();
		material.dispose();
		scene.remove(points);
	}

	/**
	 * Geometry
	 */
	geometry = new THREE.BufferGeometry();

	const positions = new Float32Array(parameters.count * 3);
	const randomness = new Float32Array(parameters.count * 3);
	const colors = new Float32Array(parameters.count * 3);
	const scales = new Float32Array(parameters.count * 1);

	const insideColor = new THREE.Color(parameters.insideColor);
	const outsideColor = new THREE.Color(parameters.outsideColor);

	for (let i = 0; i < parameters.count; i++) {
		const i3 = i * 3;

		// Position
		const radius = Math.random() * parameters.radius;

		const branchAngle =
			((i % parameters.branches) / parameters.branches) * Math.PI * 2;

		const randomX =
			Math.pow(Math.random(), parameters.randomnessPower) *
			(Math.random() < 0.5 ? 1 : -1) *
			parameters.randomness *
			radius;
		const randomY =
			Math.pow(Math.random(), parameters.randomnessPower) *
			(Math.random() < 0.5 ? 1 : -1) *
			parameters.randomness *
			radius;
		const randomZ =
			Math.pow(Math.random(), parameters.randomnessPower) *
			(Math.random() < 0.5 ? 1 : -1) *
			parameters.randomness *
			radius;

		positions[i3] = Math.cos(branchAngle) * radius;
		positions[i3 + 1] = 0;
		positions[i3 + 2] = Math.sin(branchAngle) * radius;

		randomness[i3] = randomX;
		randomness[i3 + 1] = randomY;
		randomness[i3 + 2] = randomZ;

		// Color
		const mixedColor = insideColor.clone();
		mixedColor.lerp(outsideColor, radius / parameters.radius);

		colors[i3] = mixedColor.r;
		colors[i3 + 1] = mixedColor.g;
		colors[i3 + 2] = mixedColor.b;

		// Scale
		scales[i] = Math.random();
	}

	geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
	geometry.setAttribute(
		'aRandomness',
		new THREE.BufferAttribute(randomness, 3)
	);
	geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
	geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));

	/**
	 * Points
	 */
	points = new THREE.Points(geometry, material);
	scene.add(points);
};

/**
 * Post processing
 */
const renderTarget = new THREE.WebGLRenderTarget(800, 600, {
	samples: renderer.getPixelRatio() === 1 ? 2 : 0,
});

const effectComposer = new EffectComposer(renderer, renderTarget);
effectComposer.setSize(sizes.width, sizes.height);
effectComposer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const renderPass = new RenderPass(scene, camera);
effectComposer.addPass(renderPass);

const glitchPass = new GlitchPass();
glitchPass.goWild = true;
glitchPass.enabled = false;
effectComposer.addPass(glitchPass);

const unrealBloomPass = new UnrealBloomPass();
effectComposer.addPass(unrealBloomPass);
unrealBloomPass.strength = 2;
unrealBloomPass.radius = 1;
unrealBloomPass.threshold = 0.6;

if (renderer.getPixelRatio() === 1 && !renderer.capabilities.isWebGL2) {
	const smaaPass = new SMAAPass();
	effectComposer.addPass(smaaPass);
}

/**
 * Animate
 */
const clock = new THREE.Clock();
let previousTime = 0;

const tick = () => {
	const elapsedTime = clock.getElapsedTime() + 5;
	const deltaTime = elapsedTime - previousTime;
	previousTime = elapsedTime;

	// Update material
	if (sceneReady) {
		material.uniforms.uTime.value = elapsedTime;
	}

	// Animate camera with cursor
	if (endAnimation) {
		const parallaxX = cursor.x * 10;
		const parallaxY = -cursor.y * 3;

		cameraGroup.position.x +=
			(parallaxX - cameraGroup.position.x) * 5 * deltaTime;
		cameraGroup.position.y +=
			(parallaxY - cameraGroup.position.y) * 5 * deltaTime;
	}

	// Update controls
	controls.update();

	// Render
	/* renderer.render(scene, camera); */
	effectComposer.render();

	// Call tick again on the next frame
	window.requestAnimationFrame(tick);
};

tick();
