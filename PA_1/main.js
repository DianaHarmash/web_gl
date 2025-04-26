import TrackballRotator from './Utils/trackball-rotator.js';
import { CreateWebCamTexture } from './Texture.js';
import Model from './Model.js';
import StereoCamera from './StereoCamera.js';
import { vertexShaderSource, fragmentShaderSource } from './shader.js';
import m4 from './Utils/m4.js';

window.m4 = m4; 

let gl;                         // The WebGL context
let surface;                    // The Kiss surface model
let surfaceWebCam;              // A substrate for webcam image (zero parallax)
let shProgram;                  // The shader program
let spaceball;                  // A SimpleRotator object for mouse rotation
let stereoCam;                  // Stereo camera and parameters

let iTextureWebCam = -1;
let video;

function CreateSurfaceData(data) {
    const uSegments = parseInt(document.getElementById('uSegments').value) || 32;
    const zSegments = parseInt(document.getElementById('zSegments').value) || 32;
    const { vertices, indices } = generateKissSurface(uSegments, zSegments);
    
    // Convert to appropriate typed arrays
    data.verticesF32 = new Float32Array(vertices);
    data.indicesU16 = new Uint16Array(indices);
}

function CreateWebCamQuad(data) {
    // Create a simple quad at z=0 (zero parallax)
    const vertices = new Float32Array([
        -1.0,  1.0, 0.0,  // Top left
         1.0,  1.0, 0.0,  // Top right
        -1.0, -1.0, 0.0,  // Bottom left
         1.0, -1.0, 0.0   // Bottom right
    ]);
    
    const indices = new Uint16Array([
        0, 1, 2,  // First triangle
        2, 1, 3   // Second triangle
    ]);
    
    // Add texture coordinates
    const texCoords = new Float32Array([
        0.0, 0.0,   // Top left
        1.0, 0.0,   // Top right
        0.0, 1.0,   // Bottom left
        1.0, 1.0    // Bottom right
    ]);
    
    data.verticesF32 = vertices;
    data.indicesU16 = indices;
    data.texCoordsF32 = texCoords;
}

// Helper function to normalize UV coordinates
function normalizeUV(value, min, max) {
    return (value - min) / (max - min);
}

function generateKissSurface(uSegments, zSegments, uRange = [0, 2 * Math.PI], zRange = [-1, 1]) {
    const vertices = [];
    const indices = [];
    const [uMin, uMax] = uRange;
    const [zMin, zMax] = zRange;

    const uStep = (uMax - uMin) / uSegments;
    const zStep = (zMax - zMin) / zSegments;

    // Generate vertices
    for (let zIndex = 0; zIndex <= zSegments; zIndex++) {
        const z = zMin + zIndex * zStep;
        const z2 = z * z;
        const sqrtTerm = Math.sqrt(1 - z);

        for (let uIndex = 0; uIndex <= uSegments; uIndex++) {
            const u = uMin + uIndex * uStep;

            const x = z2 * sqrtTerm * Math.cos(u);
            const y = z2 * sqrtTerm * Math.sin(u);

            vertices.push(x, y, z);
        }
    }

    // Generate indices
    for (let zIndex = 0; zIndex < zSegments; zIndex++) {
        for (let uIndex = 0; uIndex < uSegments; uIndex++) {
            const current = zIndex * (uSegments + 1) + uIndex;
            const next = current + uSegments + 1;

            indices.push(current, next, current + 1);
            indices.push(current + 1, next, next + 1);
        }
    }

    return { vertices, indices };
}

// Create shader program function 
function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vsh, vShader);
    gl.compileShader(vsh);
    if (!gl.getShaderParameter(vsh, gl.COMPILE_STATUS)) {
        throw new Error("Error in vertex shader: " + gl.getShaderInfoLog(vsh));
    }
    
    let fsh = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if (!gl.getShaderParameter(fsh, gl.COMPILE_STATUS)) {
        throw new Error("Error in fragment shader: " + gl.getShaderInfoLog(fsh));
    }
    
    let prog = gl.createProgram();
    gl.attachShader(prog, vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error("Link error in program: " + gl.getProgramInfoLog(prog));
    }
    return prog;
}

function draw() { 
    console.log("m4 type:", typeof m4);
    if (typeof m4 === 'object') {
      console.log("Available m4 properties:");
      for (let prop in m4) {
        console.log(" - " + prop + " (" + typeof m4[prop] + ")");
      }
    } else if (typeof m4 === 'function') {
      console.log("m4 is a function, not an object with methods");
    }
    
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // Draw the webcam at zero parallax
    if (iTextureWebCam >= 0) {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, video);
        
        // Use orthographic projection for the webcam
        let matrOrth = m4.orthographic(-1, 1, -1, 1, stereoCam.nearClippingDistance, stereoCam.farClippingDistance);
        gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, matrOrth);
        
        // Identity matrix for the webcam (fixed position at z=0)
        let identityMatrix = m4.identity();
        let translateZ = m4.translation(0, 0, -stereoCam.convergence);
        let matWebCam = m4.multiply(translateZ, identityMatrix);
        gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, matWebCam);
        
        // Enable texturing for the webcam
        gl.uniform1i(shProgram.iHasTexture, 1);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, iTextureWebCam);
        gl.uniform1i(shProgram.iTexture, 0);
        
        // Draw the webcam quad (both eyes see the same image)
        gl.colorMask(true, true, true, true);
        surfaceWebCam.Draw();
    }

    // Get the view matrix from the SimpleRotator
    let modelView = spaceball.getViewMatrix();
    let rotateToPointZero = m4.axisRotation([0.707, 0.707, 0], 0.7);
    let translateToPointZero = m4.translation(0, 0, -10);

    const colorPolygon = new Float32Array([0.5, 0.5, 0.5, 1]);
    const colorEdge = new Float32Array([1, 1, 1, 1]);

    // Disable texturing for the model
    gl.uniform1i(shProgram.iHasTexture, 0);

    // The FIRST PASS (for the left eye - red channel)
    let matrLeftFrustum = stereoCam.calcLeftFrustum();
    gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, matrLeftFrustum);

    let translateLeftEye = m4.translation(stereoCam.eyeSeparation/2, 0, 0);
    let matAccum0 = m4.multiply(rotateToPointZero, modelView);
    let matAccum1 = m4.multiply(translateLeftEye, matAccum0);
    let matAccum2 = m4.multiply(translateToPointZero, matAccum1);
    
    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, matAccum2);

    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(1, 0);
    
    // Red channel only
    gl.colorMask(true, false, false, true);
    gl.uniform4fv(shProgram.iColor, colorPolygon);
    surface.Draw();
    gl.uniform4fv(shProgram.iColor, colorEdge);
    surface.DrawWireframe();

    // The SECOND PASS (for the right eye - cyan channels)
    gl.clear(gl.DEPTH_BUFFER_BIT);

    let matrRightFrustum = stereoCam.calcRightFrustum();
    gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, matrRightFrustum);

    let translateRightEye = m4.translation(-stereoCam.eyeSeparation/2, 0, 0);
    matAccum0 = m4.multiply(rotateToPointZero, modelView);
    matAccum1 = m4.multiply(translateRightEye, matAccum0);
    matAccum2 = m4.multiply(translateToPointZero, matAccum1);

    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, matAccum2);

    // Green and blue channels only (cyan)
    gl.colorMask(false, true, true, true);
    gl.uniform4fv(shProgram.iColor, colorPolygon);
    surface.Draw();
    gl.uniform4fv(shProgram.iColor, colorEdge);
    surface.DrawWireframe();

    // Reset to default state
    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.colorMask(true, true, true, true);
}

// Update parameters from UI sliders
function updateStereoParameters() {
    stereoCam.eyeSeparation = parseFloat(document.getElementById('eyeSeparation').value);
    stereoCam.FOV = parseFloat(document.getElementById('fov').value) * Math.PI / 180; // Convert to radians
    stereoCam.nearClippingDistance = parseFloat(document.getElementById('nearClipping').value);
    stereoCam.convergence = parseFloat(document.getElementById('convergence').value);
    
    document.getElementById('eyeSeparationValue').textContent = stereoCam.eyeSeparation.toFixed(2);
    document.getElementById('fovValue').textContent = (stereoCam.FOV * 180 / Math.PI).toFixed(0);
    document.getElementById('nearClippingValue').textContent = stereoCam.nearClippingDistance.toFixed(1);
    document.getElementById('convergenceValue').textContent = stereoCam.convergence.toFixed(1);
    
    draw();
}

// Update surface segments
function updateSurfaceSegments() {
    let data = {};
    CreateSurfaceData(data);
    surface.BufferData(data.verticesF32, data.indicesU16);
    draw();
}

// Constructor for the shader program
function ShaderProgram(name, program) {
    this.name = name;
    this.prog = program;

    // Shader attribute and uniform locations
    this.iAttribVertex = -1;
    this.iAttribTexCoord = -1; 
    this.iModelViewMatrix = -1;
    this.iProjectionMatrix = -1;
    this.iColor = -1;
    this.iTexture = -1;
    this.iHasTexture = -1;

    this.Use = function() {
        gl.useProgram(this.prog);
    }
}

function initGL() {
    let prog = createProgram(gl, vertexShaderSource, fragmentShaderSource);

    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    shProgram.iAttribVertex = gl.getAttribLocation(prog, "vertex");
    shProgram.iAttribTexCoord = gl.getAttribLocation(prog, "texCoord");
    shProgram.iModelViewMatrix = gl.getUniformLocation(prog, "ModelViewMatrix");
    shProgram.iProjectionMatrix = gl.getUniformLocation(prog, "ProjectionMatrix");
    shProgram.iColor = gl.getUniformLocation(prog, "color");
    shProgram.iTexture = gl.getUniformLocation(prog, "texture");
    shProgram.iHasTexture = gl.getUniformLocation(prog, "hasTexture");

    // Create Kiss surface - pass gl and shProgram to the Model constructor
    let data = {};
    CreateSurfaceData(data);
    surface = new Model('Surface', gl, shProgram);
    surface.BufferData(data.verticesF32, data.indicesU16);

    // Create webcam quad - pass gl and shProgram
    let webcamData = {};
    CreateWebCamQuad(webcamData);
    surfaceWebCam = new ModelWithTexture('SurfaceWebCam', gl, shProgram);
    surfaceWebCam.BufferData(webcamData.verticesF32, webcamData.indicesU16, webcamData.texCoordsF32);

    // Initialize stereo camera with correct parameters
    stereoCam = new StereoCamera(
        parseFloat(document.getElementById('eyeSeparation').value),     // eye separation
        parseFloat(document.getElementById('convergence').value),       // convergence
        gl.canvas.width / gl.canvas.height,                             // aspect ratio
        parseFloat(document.getElementById('fov').value) * Math.PI / 180, // FOV in radians
        parseFloat(document.getElementById('nearClipping').value),      // near clipping
        100.0                                                          // far clipping
    );

    gl.enable(gl.DEPTH_TEST);
}

// Model with texture coordinates - modified to take gl and shProgram
function ModelWithTexture(name, gl, shProgram) {
    this.name = name;
    this.iVertexBuffer = gl.createBuffer();
    this.iIndexBuffer = gl.createBuffer();
    this.iTexCoordBuffer = gl.createBuffer();
    this.count = 0;
    
    this.BufferData = function(vertices, indices, texCoords) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTexCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
        
        this.count = indices.length;
    }

    this.Draw = function() {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);
        
        if (shProgram.iAttribTexCoord >= 0) {
            gl.bindBuffer(gl.ARRAY_BUFFER, this.iTexCoordBuffer);
            gl.vertexAttribPointer(shProgram.iAttribTexCoord, 2, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(shProgram.iAttribTexCoord);
        }
        
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
        gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
    }
}

// Initialize the application
function init() {
    let canvas;
    try {
        canvas = document.getElementById("webglcanvas");
        gl = canvas.getContext("webgl");
        if (!gl) {
            throw "Browser does not support WebGL";
        }
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not get a WebGL graphics context.</p>";
        return;
    }
    
    try {
        initGL();  
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not initialize the WebGL graphics context: " + e + "</p>";
        return;
    }

    // Set up webcam
    video = document.createElement('video');
    video.autoplay = true;

    // Connect to video stream
    let constraints = {video: true};
    navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
        video.srcObject = stream;

        let track = stream.getVideoTracks()[0];
        let settings = track.getSettings();

        // Pass gl to CreateWebCamTexture
        iTextureWebCam = CreateWebCamTexture(gl, settings.width, settings.height);

        video.play();
    })
    .catch(function(err) {
        console.log(err.name + ": " + err.message);
    });

    // Set up event listeners for UI controls
    document.getElementById('eyeSeparation').addEventListener('input', updateStereoParameters);
    document.getElementById('fov').addEventListener('input', updateStereoParameters);
    document.getElementById('nearClipping').addEventListener('input', updateStereoParameters);
    document.getElementById('convergence').addEventListener('input', updateStereoParameters);
    document.getElementById('uSegments').addEventListener('change', updateSurfaceSegments);
    document.getElementById('zSegments').addEventListener('change', updateSurfaceSegments);

    // Set up the trackball rotator
    spaceball = new TrackballRotator(canvas, draw, 0);

    // Start animation loop
    setInterval(draw, 50); // 20 fps
}

// Call init when the page loads
window.onload = init;