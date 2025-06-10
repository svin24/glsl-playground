precision highp float;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform sampler2D u_texture;
varying vec2 vUv;

// --- Constants to tweak the effect ---
const float LENS_SIZE = 0.15;
const float WARP_STRENGTH = 0.5;
const float SQUIRCLE_POWER = 4.0;
const float EDGE_SOFTNESS = 0.005; 
const float REFRACTION_STRENGTH = 0.05;
const float CHROMATIC_STRENGTH = 5.0;
const float REFRACTIVE_INDEX = 4.0;
const float BLUR_STRENGTH = 0.001;
const int BLUR_KERNEL_SIZE = 5;
const float SHEEN_THICKNESS = 0.02; 
const float SHEEN_INTENSITY = 0.25;

// Signed Distance Function for a Squircle
float squircleSDF(vec2 p, float size) {
    vec2 d = abs(p);
    return pow(pow(d.x, SQUIRCLE_POWER) + pow(d.y, SQUIRCLE_POWER), 1.0 / SQUIRCLE_POWER) - size;
}

// Gaussian weight function for blur
float gaussianWeight(float x, float sigma) {
    return exp(-(x * x) / (2.0 * sigma * sigma));
}

vec3 gaussianBlur(vec2 uv, float strength, float mask) {
    vec3 color = vec3(0.0);
    float sigma = strength * mask;
    float totalWeight = 0.0;
    int halfSize = BLUR_KERNEL_SIZE / 2;
    vec2 texelSize = 1.0 / u_resolution;

    for (int i = -halfSize; i <= halfSize; i++) {
        for (int j = -halfSize; j <= halfSize; j++) {
            vec2 offset = vec2(float(i), float(j)) * texelSize;
            float weight = gaussianWeight(length(offset), sigma);
            color += texture2D(u_texture, uv + offset).rgb * weight;
            totalWeight += weight;
        }
    }
    return color / totalWeight;
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

    // Create a softer mask for the lens area to reduce distinct border
    // Use a wider smoothstep range for a more gradual transition
    float mask = 1.0 - smoothstep(-EDGE_SOFTNESS * 2.0, EDGE_SOFTNESS * 2.0, dist);

    // 1. Calculate the Warp (Magnification)
    float radial_dist = length(p);
    float warpFactor = 1.0 - radial_dist / LENS_SIZE;
    warpFactor = pow(warpFactor, 2.0);

    // 2. Refraction Effect (Inspired by 3D Raytracing)
    vec2 normal = normalize(p) * (1.0 - warpFactor);
    float eta = 1.0 / REFRACTIVE_INDEX;
    vec2 incident = p - mouse_aspect;
    vec2 refractDir = normal * (1.0 - eta) * REFRACTION_STRENGTH * mask;
    vec2 refractOffset = refractDir;

    // 3. Chromatic Aberration
    vec2 warpedUv = u_mouse + (vUv - u_mouse) * (1.0 - warpFactor * WARP_STRENGTH);
    vec3 finalColor;
    finalColor.r = texture2D(u_texture, warpedUv + refractOffset * (1.0 + CHROMATIC_STRENGTH)).r;
    finalColor.g = texture2D(u_texture, warpedUv + refractOffset).g;
    finalColor.b = texture2D(u_texture, warpedUv + refractOffset * (1.0 - CHROMATIC_STRENGTH)).b;

    // 4. Apply Gaussian Blur
    finalColor = gaussianBlur(warpedUv + refractOffset, BLUR_STRENGTH, mask);

    // 5. Add Subtle Sheen Effect Matching Squircle Shape
    // Sheen is applied near the edge of the squircle using the same SDF
    float sheenDist = squircleSDF(p, LENS_SIZE - SHEEN_THICKNESS);
    float sheen = smoothstep(-SHEEN_THICKNESS, SHEEN_THICKNESS, sheenDist) * (1.0 - smoothstep(-SHEEN_THICKNESS * 0.5, SHEEN_THICKNESS * 0.5, dist));
    finalColor = mix(finalColor, vec3(1.0), sheen * SHEEN_INTENSITY * mask);

    // 6. Blend with original background
    vec3 originalColor = texture2D(u_texture, vUv).rgb;
    finalColor = mix(originalColor, finalColor, mask);

    // 7. Clamp colors to prevent overexposure 
    finalColor = clamp(finalColor, 0.0, 1.0);

    gl_FragColor = vec4(finalColor, 1.0);
}
