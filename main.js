import * as THREE from 'three';

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Load background image
const textureLoader = new THREE.TextureLoader();
const backgroundTexture = textureLoader.load('background.jpg');

// Shader uniforms
const uniforms = {
    u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    u_time: { value: 0.0 },
    u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
    u_texture: { value: backgroundTexture }
};

// Function to load shader files and create material
async function loadShadersAndCreateMaterial() {
    try {
        // Load vertex shader
        const vertexResponse = await fetch('shaders/vertexShader.glsl');
        if (!vertexResponse.ok) throw new Error('Failed to load vertex shader');
        const vertexShader = await vertexResponse.text();

        // Load fragment shader
        const fragmentResponse = await fetch('shaders/fragmentShader.glsl');
        if (!fragmentResponse.ok) throw new Error('Failed to load fragment shader');
        const fragmentShader = await fragmentResponse.text();

        // Create ShaderMaterial with loaded shaders
        const material = new THREE.ShaderMaterial({
            uniforms: uniforms,
            vertexShader: vertexShader,
            fragmentShader: fragmentShader
        });

        console.log('Shaders loaded successfully');
        return material;
    } catch (error) {
        console.error('Error loading shaders:', error);
        return null;
    }
}

// Create plane with shader material
const geometry = new THREE.PlaneGeometry(2, 2);

// Load shaders and set up the mesh
loadShadersAndCreateMaterial().then(material => {
    if (material) {
        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);
    } else {
        console.error('Failed to create material, mesh not added to scene');
    }
});

// Handle mouse movement
document.addEventListener('mousemove', (event) => {
    uniforms.u_mouse.value.x = event.clientX / window.innerWidth;
    uniforms.u_mouse.value.y = 1.0 - event.clientY / window.innerHeight; // Flip Y for UV
});

// Handle window resize
window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    uniforms.u_resolution.value.set(window.innerWidth, window.innerHeight);
    camera.updateProjectionMatrix();
});

// Animation loop
function animate(time) {
    uniforms.u_time.value = time * 0.001;
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}
animate(0);
