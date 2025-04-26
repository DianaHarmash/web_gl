// Vertex shader
export const vertexShaderSource = `
attribute vec3 vertex;
attribute vec2 texCoord;
uniform mat4 ModelViewMatrix;
uniform mat4 ProjectionMatrix;
varying vec2 vTexCoord;

void main() {
    gl_Position = ProjectionMatrix * ModelViewMatrix * vec4(vertex, 1.0);
    vTexCoord = texCoord;
}`;

// Fragment shader
export const fragmentShaderSource = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
   precision highp float;
#else
   precision mediump float;
#endif

uniform vec4 color;
uniform sampler2D texture;
uniform int hasTexture;
varying vec2 vTexCoord;

void main() {
    if (hasTexture == 1) {
        gl_FragColor = texture2D(texture, vTexCoord);
    } else {
        gl_FragColor = color;
    }
}`;