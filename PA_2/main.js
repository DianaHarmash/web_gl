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
let sensorController;           // Controller for phone sensor orientation

let iTextureWebCam = -1;
let video;

// WebSocket connection for sensor data
let ws;
let isSensorEnabled = false;  
let sensorOrientation = {
    alpha: 0,  // z-axis rotation
    beta: 0,   // x-axis rotation
    gamma: 0   // y-axis rotation
};

// Initialize WebSocket connection to sensor bridge server
function initWebSocket() {
     const phoneIP = "192.168.50.23"; 
     const phonePort = 8080; 

     const wsUrl = `ws://${phoneIP}:${phonePort}/sensor/connect?type=android.sensor.orientation`;
     console.log(`Connecting to WebSocket server at ${wsUrl}`);
    
    ws = new WebSocket(wsUrl);

    ws.onopen = function() {
        console.log('Successfully connected to WebSocket server at ' + wsUrl);
        document.getElementById('sensorStatus').textContent = 'Connected';
        document.getElementById('sensorStatus').style.color = '#4CAF50';
    };
    
    ws.onmessage = function(event) {
        try {
            console.log("Received data:", event.data);
            const data = JSON.parse(event.data);
            
            console.log("Parsed sensor data:", data);
            
            if (data.orientation) {
                sensorOrientation.alpha = data.orientation.alpha * (Math.PI / 180);
                sensorOrientation.beta = data.orientation.beta * (Math.PI / 180);
                sensorOrientation.gamma = data.orientation.gamma * (Math.PI / 180);
            } else if (data.alpha !== undefined) {
                sensorOrientation.alpha = data.alpha * (Math.PI / 180);
                sensorOrientation.beta = data.beta * (Math.PI / 180);
                sensorOrientation.gamma = data.gamma * (Math.PI / 180);
            } else if (data.data) {
                const sensorData = data.data;
                sensorOrientation.alpha = sensorData.alpha * (Math.PI / 180);
                sensorOrientation.beta = sensorData.beta * (Math.PI / 180);
                sensorOrientation.gamma = sensorData.gamma * (Math.PI / 180);
            } if (data.values) {
                const sensorData = data.data;
                sensorOrientation.alpha = data.values[0] * (Math.PI / 180);
                sensorOrientation.beta = data.values[1] * (Math.PI / 180);
                sensorOrientation.gamma = data.values[2] * (Math.PI / 180);
            }
            
            document.getElementById('alphaValue').textContent = 
                (sensorOrientation.alpha * (180 / Math.PI)).toFixed(2) + "°";
            document.getElementById('betaValue').textContent = 
                (sensorOrientation.beta * (180 / Math.PI)).toFixed(2) + "°";
            document.getElementById('gammaValue').textContent = 
                (sensorOrientation.gamma * (180 / Math.PI)).toFixed(2) + "°";
            
            if (isSensorEnabled) {
                requestAnimationFrame(draw);
            }
        } catch (error) {
            console.error('Error parsing WebSocket message:', error, 'Raw data:', event.data);
        }
    };
    
    ws.onclose = function(event) {
        console.log('Disconnected from WebSocket server', event.code, event.reason);
        document.getElementById('sensorStatus').textContent = 'Disconnected';
        document.getElementById('sensorStatus').style.color = '#ff9900';
        
        setTimeout(initWebSocket, 3000);
    };
    
    ws.onerror = function(error) {
        console.error('WebSocket error:', error);
        document.getElementById('sensorStatus').textContent = 'Error';
        document.getElementById('sensorStatus').style.color = '#ff0000';
    };
}

function CreateSurfaceData(data) {
    const uSegments = parseInt(document.getElementById('uSegments').value) || 32;
    const zSegments = parseInt(document.getElementById('zSegments').value) || 32;
    const { vertices, indices } = generateKissSurface(uSegments, zSegments);
    
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

// Function to create rotation matrix from Euler angles (ZXY order)
function createOrientationMatrix(alpha, beta, gamma) {
    // Create individual rotation matrices
    const zRotation = m4.zRotation(alpha);  // alpha: rotation around Z axis
    const xRotation = m4.xRotation(beta);   // beta: rotation around X axis
    const yRotation = m4.yRotation(gamma);  // gamma: rotation around Y axis
    
    // Combine rotations in ZXY order (first Z, then X, then Y)
    let result = m4.identity();
    result = m4.multiply(result, zRotation);
    result = m4.multiply(result, xRotation);
    result = m4.multiply(result, yRotation);
    
    return result;
}

function draw() { 
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

    // Get the view matrix based on input method
    let modelView;
    
    if (isSensorEnabled) {
        console.log("Using sensor orientation:", 
            sensorOrientation.alpha.toFixed(2), 
            sensorOrientation.beta.toFixed(2), 
            sensorOrientation.gamma.toFixed(2));
            
        let orientationMatrix = createOrientationMatrix(
            sensorOrientation.alpha,
            sensorOrientation.beta,
            sensorOrientation.gamma
        );
        
        modelView = orientationMatrix;
    } else {
        // Use trackball rotation
        modelView = spaceball.getViewMatrix();
    }
    
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

// Toggle sensor control
function toggleSensorControl() {
    isSensorEnabled = document.getElementById('sensorControlToggle').checked;
    
    if (isSensorEnabled) {
        console.log('Sensor control enabled');
        // If we're not connected yet, initialize the WebSocket
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            initWebSocket();
        }
    } else {
        console.log('Sensor control disabled');
    }
    
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
    
    // Initialize WebSocket connection to the sensor bridge server
    initWebSocket();

    // Set up webcam
    video = document.createElement('video');
    video.autoplay = true;

    // Connect to video stream
    let constraints = {video: true};
    navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
        video.srcObject = stream;

        let track = stream.getVideoTracks()[0];
        let settings = track.getSettings();

        iTextureWebCam = CreateWebCamTexture(gl, settings.width, settings.height);

        video.play();
    })
    .catch(function(err) {
        console.log(err.name + ": " + err.message);
    });

    document.getElementById('eyeSeparation').addEventListener('input', updateStereoParameters);
    document.getElementById('fov').addEventListener('input', updateStereoParameters);
    document.getElementById('nearClipping').addEventListener('input', updateStereoParameters);
    document.getElementById('convergence').addEventListener('input', updateStereoParameters);
    document.getElementById('uSegments').addEventListener('change', updateSurfaceSegments);
    document.getElementById('zSegments').addEventListener('change', updateSurfaceSegments);
    
    document.getElementById('sensorControlToggle').addEventListener('change', toggleSensorControl); 

const testConnectionBtn = document.getElementById('testConnectionBtn');
if (testConnectionBtn) {
    testConnectionBtn.addEventListener('click', function() {
        if (ws && ws.readyState === WebSocket.OPEN) {
            console.log("WebSocket connection is open");
        } else {
            console.log("WebSocket connection is not open");
            initWebSocket();
        }
    });
}
    spaceball = new TrackballRotator(canvas, draw, 0);

    setInterval(draw, 50); 
}

window.onload = init;