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

// Create plane with shader material
const geometry = new THREE.PlaneGeometry(2, 2);
const material = new THREE.ShaderMaterial({
    uniforms,
   vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
  fragmentShader: `
        precision highp float;
        uniform vec2 u_resolution;
        uniform vec2 u_mouse;
        uniform sampler2D u_texture;
        varying vec2 vUv;
        
        // --- Constants to tweak the effect ---
        const float LENS_SIZE = 0.25;
        const float WARP_STRENGTH = 0.5;
        const float SQUIRCLE_POWER = 4.0;
        const float EDGE_SOFTNESS = 0.01;
        const float BORDER_THICKNESS = 0.1;
        // Refraction strength (subtle, droplet-like)
        const float REFRACTION_STRENGTH = 0.05;
        // Chromatic aberration strength (subtle, affects color split)
        const float CHROMATIC_STRENGTH = 0.005;
        
        // Signed Distance Function for a Squircle
        float squircleSDF(vec2 p, float size) {
            vec2 d = abs(p);
            return pow(pow(d.x, SQUIRCLE_POWER) + pow(d.y, SQUIRCLE_POWER), 1.0 / SQUIRCLE_POWER) - size;
        }
        
        void main() {
            // Correct for aspect ratio
            vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
            vec2 uv_aspect = vUv * aspect;
            vec2 mouse_aspect = u_mouse * aspect;
        
            // Center coordinates on the mouse
            vec2 p = uv_aspect - mouse_aspect;
        
            // Get the distance using squircle function
            float dist = squircleSDF(p, LENS_SIZE);
        
            // Create a soft mask for the lens area
            float mask = 1.0 - smoothstep(-EDGE_SOFTNESS, EDGE_SOFTNESS, dist);
        
            // If outside the lens, draw original texture
            if (mask <= 0.0) {
                gl_FragColor = texture2D(u_texture, vUv);
                return;
            }
        
            // --- 1. Calculate the Warp (Magnification) ---
            float radial_dist = length(p);
            float warpFactor = 1.0 - radial_dist / LENS_SIZE;
            warpFactor = pow(warpFactor, 2.0);
        
            // --- 2. Refraction Effect (Droplet-like) ---
            // Simulate a normal map for a droplet by using the gradient of the squircle
            vec2 normal = normalize(p) * (1.0 - warpFactor);
            vec2 refractOffset = normal * REFRACTION_STRENGTH * mask;
        
            // --- 3. Chromatic Aberration ---
            // Sample RGB channels at slightly different offsets for subtle color split
            vec2 warpedUv = u_mouse + (vUv - u_mouse) * (1.0 - warpFactor * WARP_STRENGTH);
            vec3 finalColor;
            finalColor.r = texture2D(u_texture, warpedUv + refractOffset * (1.0 + CHROMATIC_STRENGTH)).r;
            finalColor.g = texture2D(u_texture, warpedUv + refractOffset).g;
            finalColor.b = texture2D(u_texture, warpedUv + refractOffset * (1.0 - CHROMATIC_STRENGTH)).b;
        
            // --- 4. Add subtle inner border/sheen ---
            float border = smoothstep(LENS_SIZE - BORDER_THICKNESS, LENS_SIZE, radial_dist);
            finalColor = mix(finalColor, vec3(1.0), border * 0.2);
        
            // --- 5. Blend with original background ---
            vec3 originalColor = texture2D(u_texture, vUv).rgb;
            finalColor = mix(originalColor, finalColor, mask);
        
            gl_FragColor = vec4(finalColor, 1.0);
        }
    `,
});
const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);

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
