// SoundSourceModel.js - creates and manages the 3D sphere that represents the sound source
export default function SoundSourceModel(name, gl, shProgram) {
    this.name = name;
    this.iVertexBuffer = gl.createBuffer();
    this.iIndexBuffer = gl.createBuffer();
    this.count = 0;
    
    // Generate a sphere with given radius and resolution
    this.generateSphere = function(radius, latitudeBands, longitudeBands) {
        const vertices = [];
        const indices = [];
        
        // Generate vertices
        for (let lat = 0; lat <= latitudeBands; lat++) {
            const theta = lat * Math.PI / latitudeBands;
            const sinTheta = Math.sin(theta);
            const cosTheta = Math.cos(theta);
            
            for (let lon = 0; lon <= longitudeBands; lon++) {
                const phi = lon * 2 * Math.PI / longitudeBands;
                const sinPhi = Math.sin(phi);
                const cosPhi = Math.cos(phi);
                
                const x = cosPhi * sinTheta;
                const y = cosTheta;
                const z = sinPhi * sinTheta;
                
                vertices.push(radius * x, radius * y, radius * z);
            }
        }
        
        // Generate indices
        for (let lat = 0; lat < latitudeBands; lat++) {
            for (let lon = 0; lon < longitudeBands; lon++) {
                const first = (lat * (longitudeBands + 1)) + lon;
                const second = first + longitudeBands + 1;
                
                indices.push(first, second, first + 1);
                indices.push(second, second + 1, first + 1);
            }
        }
        
        this.vertices = new Float32Array(vertices);
        this.indices = new Uint16Array(indices);
        
        return { 
            verticesF32: this.vertices, 
            indicesU16: this.indices 
        };
    };
    
    // Buffer the sphere data to the GPU
    this.BufferData = function(vertices, indices) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
        
        this.count = indices.length;
    };

    // Draw the sphere
    this.Draw = function() {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);
        
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
        gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
    };
    
    // Update position of the sound source sphere
    this.setPosition = function(x, y, z) {
        this.position = [x, y, z];
    };
}