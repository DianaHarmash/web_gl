function generateKissSurface(uSegments, zSegments, uRange = [0, 2 * Math.PI], zRange = [-1, 1]) {
    const vertices = [];
    const indices = [];

    const [uMin, uMax] = uRange;
    const [zMin, zMax] = zRange;

    const uStep = (uMax - uMin) / uSegments;
    const zStep = (zMax - zMin) / zSegments;

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

function generateNormals(vertices, indices) {
    const normals = new Float32Array(vertices.length).fill(0);

    for (let i = 0; i < indices.length; i += 3) {
        const i0 = indices[i] * 3;
        const i1 = indices[i + 1] * 3;
        const i2 = indices[i + 2] * 3;

        const v0 = [vertices[i0], vertices[i0 + 1], vertices[i0 + 2]];
        const v1 = [vertices[i1], vertices[i1 + 1], vertices[i1 + 2]];
        const v2 = [vertices[i2], vertices[i2 + 1], vertices[i2 + 2]];

        const edge1 = [
            v1[0] - v0[0],
            v1[1] - v0[1],
            v1[2] - v0[2],
        ];
        const edge2 = [
            v2[0] - v0[0],
            v2[1] - v0[1],
            v2[2] - v0[2],
        ];

        const normal = [
            edge1[1] * edge2[2] - edge1[2] * edge2[1],
            edge1[2] * edge2[0] - edge1[0] * edge2[2],
            edge1[0] * edge2[1] - edge1[1] * edge2[0],
        ];

        for (const idx of [i0, i1, i2]) {
            normals[idx] += normal[0];
            normals[idx + 1] += normal[1];
            normals[idx + 2] += normal[2];
        }
    }

    for (let i = 0; i < normals.length; i += 3) {
        const nx = normals[i];
        const ny = normals[i + 1];
        const nz = normals[i + 2];
        const normalized = m4.normalize([nx, ny, nz]);
        
        for (let j = 0; j < normalized.length; ++j) {
            normals[i + j] = normalized[j];
        }
    }

    return normals;
}

export default function Model(gl, shProgram) {
    this.iVertexBuffer = gl.createBuffer();
    this.iNormalBuffer = gl.createBuffer();
    this.iIndexBuffer = gl.createBuffer();
    this.count = 0;

    this.BufferData = function(vertices, normals, indices) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

        this.count = indices.length;
    };

    this.Draw = function() {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.vertexAttribPointer(shProgram.iAttribNormal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribNormal);

        gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
    }

    this.CreateSurfaceData = function() {
        const U = parseFloat(document.getElementById('U Segments').value);
        const Z = parseFloat(document.getElementById('Z Segments').value)
    
        const { vertices, indices } = generateKissSurface(U, Z);
        const normals = generateNormals(vertices, indices);
        this.BufferData(vertices, normals, indices);
    }
}
