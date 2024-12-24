const textureVertex = `precision mediump float;
attribute vec2 vertex;
varying vec2 uv;

void main() {
    gl_Position = vec4(vertex, 0.0, 1.0);
    uv = vertex * 0.5 + 0.5;
}
`;

const textureFragment = `precision mediump float;
    varying vec2 uv;
    uniform sampler2D diffuse;
    void main() {
        gl_FragColor = texture2D(diffuse, uv);
    }
`;

const uvVertex = `
    attribute vec2 vertex;

    uniform vec2 point;  // Точка обертання
    uniform float angle; // Кут обертання в радіанах

    void main() {
        vec2 translatedVertex = vertex - point;
        
        float cosTheta = cos(angle);
        float sinTheta = sin(angle);

        vec2 rotatedVertex = vec2(
            translatedVertex.x * cosTheta - translatedVertex.y * sinTheta,
            translatedVertex.x * sinTheta + translatedVertex.y * cosTheta
        );

        vec2 finalVertex = rotatedVertex + point;
        gl_Position = vec4(finalVertex * 2.0 - 1.0, 0.0, 1.0);
    }
`;

const uvFragment = `
    precision mediump float;
    void main() {
        gl_FragColor = vec4(0, 1, 0, 0.2);
    }
`;

const pointVertex = `
    uniform vec2 vertex;
    void main() {
        gl_Position = vec4(vertex * 2.0 - 1.0, 0.0, 1.0);
        gl_PointSize = 10.0;
    }
`;

const pointFragment = `
    precision mediump float;
    void main() {
        gl_FragColor = vec4(1, 1, 0, 1);
    }
`;

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Shader compilation error:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function createProgram(gl, vertex, fragment) {
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertex);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragment);

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error("Program link error:", gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }
    return program;
}

function convertTrianglesToLines(indices) {
    const lines = [];
    for (let i = 0; i < indices.length; i += 3) {
        const i0 = indices[i];
        const i1 = indices[i + 1];
        const i2 = indices[i + 2];

        lines.push(i0, i1);
        lines.push(i1, i2);
        lines.push(i2, i0);
    }
    return lines;
}

export default function TexCoordDrawer(mesh) {
    const surface = document.getElementById('uvcanvas');
    const gl = surface.getContext('webgl');

    const idTextureDiffuse = LoadTexture(gl, "./textures/diffuse.jpg");

    const iTextureVertexBuffer = gl.createBuffer();
    const iVertexBuffer = gl.createBuffer();
    const iIndexBuffer = gl.createBuffer();

    const textureProgram = createProgram(gl, textureVertex, textureFragment);
    const uvProgram = createProgram(gl, uvVertex, uvFragment);
    const pointProg = createProgram(gl, pointVertex, pointFragment);

    let point = [0.5, 0.5];

    let count = 0;


    function calculatePoint(event) {
        const rect = surface.getBoundingClientRect();
        const x = (event.clientX - rect.left) / surface.width;
        const y = 1.0 - ((event.clientY - rect.top) / surface.height);
        return [x, y];
    }

    surface.addEventListener('mousemove', (event) => {
        const [x, y] = calculatePoint(event);
        document.getElementById('coordinates').textContent = `Coordinates: (${x.toFixed(2)}, ${y.toFixed(2)})`;
    });

    surface.addEventListener('mousedown', (event) => {
        if (event.button == 0) {
            point = calculatePoint(event);
            mesh.point = point;
            document.dispatchEvent(new Event('draw'));
        }
    });

    this.init = function () {
        gl.clearColor(0, 0, 0, 1);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        gl.bindBuffer(gl.ARRAY_BUFFER, iTextureVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, -1, -1, 1, 1, 1, -1]), gl.STATIC_DRAW);

        this.update();
    };

    this.update = function () {
        gl.bindBuffer(gl.ARRAY_BUFFER, iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.uvBuffer), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iIndexBuffer);
        const indices = convertTrianglesToLines(mesh.indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

        count = indices.length;
    };

    this.draw = function () {
        const angle = parseFloat(document.getElementById('Angle').value) * (Math.PI / 180.0);

        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(textureProgram);

        let attribute = gl.getAttribLocation(textureProgram, 'vertex');
        gl.bindBuffer(gl.ARRAY_BUFFER, iTextureVertexBuffer);
        gl.enableVertexAttribArray(attribute);
        gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        gl.useProgram(uvProgram);

        attribute = gl.getAttribLocation(uvProgram, 'vertex');
        gl.bindBuffer(gl.ARRAY_BUFFER, iVertexBuffer);
        gl.enableVertexAttribArray(attribute);
        gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);

        attribute = gl.getUniformLocation(uvProgram, 'point');
        gl.uniform2fv(attribute, point);
        attribute = gl.getUniformLocation(uvProgram, 'angle');
        gl.uniform1f(attribute, angle);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iIndexBuffer);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, idTextureDiffuse);
        
        gl.drawElements(gl.LINES, count, gl.UNSIGNED_SHORT, 0);

        gl.useProgram(pointProg);

        attribute = gl.getUniformLocation(pointProg, 'vertex');
        gl.uniform2fv(attribute, point);
        gl.drawArrays(gl.POINTS, 0, 1);
    };
}
