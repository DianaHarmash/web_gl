function normalizeUV(value, min, max) {
    return (value - min) / (max - min);
}

function generateKissSurface(uSegments, zSegments, uRange = [0, 2 * Math.PI], zRange = [-1, 1]) {
    const vertices = [];
    const indices = [];
    const uvs = [];
    const tangents = [];

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
            uvs.push(normalizeUV(z, zMin, zMax), normalizeUV(u, uMin, uMax));

            const tangentX = -z2 * sqrtTerm * Math.sin(u);
            const tangentY = z2 * sqrtTerm * Math.cos(u);
            const tangentZ = 0; 
            
            tangents.push(...m4.normalize([tangentX, tangentY, tangentZ], [1.0, 0.0, 0.0]));
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

    return { vertices, indices, uvs, tangents };
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
    this.iUVBuffer = gl.createBuffer();
    this.iNormalBuffer = gl.createBuffer();
    this.iTangentBuffer = gl.createBuffer();
    this.iIndexBuffer = gl.createBuffer();

    this.uvBuffer = undefined;
    this.indexBuffer = undefined;

    this.idTextureDiffuse = LoadTexture(gl, "./textures/diffuse.jpg");
    this.idTextureNormal = LoadTexture(gl, "./textures/normal.jpg");
    this.idTextureSpecular = LoadTexture(gl, "./textures/specular.jpg");

    this.point = [0.5, 0.5];
    
    this.count = 0;

    this.BufferData = function(vertices, uvs, normals, tangents, indices) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iUVBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uvs), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTangentBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(tangents), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

        this.uvBuffer = uvs;
        this.indexBuffer = indices;

        this.count = indices.length;
    };

    this.Draw = function() {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iUVBuffer);
        gl.vertexAttribPointer(shProgram.iAttribUV, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribUV);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.vertexAttribPointer(shProgram.iAttribNormal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribNormal);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTangentBuffer);
        gl.vertexAttribPointer(shProgram.iAttribTangent, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribTangent);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.idTextureDiffuse);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.idTextureNormal);

        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, this.idTextureSpecular);

        gl.uniform2fv(shProgram.iPoint, this.point);
        gl.uniform1f(shProgram.iAngle, parseFloat(document.getElementById('Angle').value) * (Math.PI / 180.0));

        gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
    }

    this.CreateSurfaceData = function() {
        const U = parseFloat(document.getElementById('U Segments').value);
        const Z = parseFloat(document.getElementById('Z Segments').value)
    
        const { vertices, indices, uvs, tangents } = generateKissSurface(U, Z);
        const normals = generateNormals(vertices, indices);
        this.BufferData(vertices, uvs, normals, tangents, indices);
    }
}
