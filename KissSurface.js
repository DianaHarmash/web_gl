class SurfaceModel {
    constructor(name, uSegments, vSegments) {
        this.name = name;
        this.uSegments = uSegments;
        this.vSegments = vSegments;
        this.uSegmentsLines = [];
        this.vSegmentsLines = [];
        this.vertexList = [];
    }

    getName() {
        return this.name;
    }

    changeName(new_name) {
        this.name = new_name;
    }

    set_U_Segments(segmentsNumber) {
        this.uSegments = segmentsNumber;
    }

    set_V_Segments(segmentsNumber) {
        this.vSegments = segmentsNumber;
    }

    get_U_Segments() {
        return this.uSegments;
    }

    get_V_Segments() {
        return this.vSegments;
    }

    getVertexList() {
        return this.vertexList;
    }

    clearVertexList() {
        this.vertexList = [];
        this.uSegmentsLines = [];
        this.vSegmentsLines = [];
    }
}

class KissSurface extends SurfaceModel {
    constructor(name, uSegments, vSegments, zMin, zMax) {
        super(name, uSegments, vSegments)
        this.zMin = zMin;
        this.zMax = zMax;
    }

    getZmin() {
        return this.zMin;
    }

    getZmax() {
        return this.zMax;
    }

    generateVertices() {
        this.clearVertexList();
        let uMax = 2 * Math.PI; 

        for (let i = 0; i <= this.uSegments; i++) {
            var uLine = [];
            let u = (i / this.uSegments) * uMax;
            for (let j = 0; j <= this.vSegments; j++) {
                let z = this.zMin + (j / this.vSegments) * (this.zMax - this.zMin);

                let vertexes = this.surfaceEquation(z, u);

                this.vertexList.push(vertexes.x, vertexes.y, z);
                uLine.push([vertexes.x, vertexes.y, z]);
            }
            this.uSegmentsLines.push(uLine);
        }

        for (let j = 0; j <= this.vSegments; j++) {
            var vLine = [];
            let z = this.zMin + (j / this.vSegments) * (this.zMax - this.zMin);
            for (let i = 0; i <= this.uSegments; i++) {
                let u = (i / this.uSegments) * uMax;
                let vertexes = this.surfaceEquation(z, u);

                this.vertexList.push(vertexes.x, vertexes.y, z);
                vLine.push([vertexes.x, vertexes.y, z]);
            }
            this.vSegmentsLines.push(vLine);
        }
    }

    surfaceEquation(z, u) {
        let factor = z * z * Math.sqrt(1 - z);
        let x = factor * Math.cos(u);
        let y = factor * Math.sin(u);
        return { x, y };
    }
    intiBuffer(gl) {
        const vertices = this.getVertexList();

        this.vertexBuffer = gl.createBuffer();

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);

        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    }

    draw(gl, shProgram) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);

        gl.vertexAttribPointer(shProgram.vertexAttrib, 3, gl.FLOAT, false, 0, 0);

        gl.enableVertexAttribArray(shProgram.vertexAttrib);


        const uLineVerticesCount = this.vSegments + 1;
        const vLineVerticesCount = this.uSegments + 1;
        const vLinesOffset = this.uSegmentsLines.length * uLineVerticesCount;

        for (let i = 0; i < this.uSegmentsLines.length; i++) {
            const offset = i * uLineVerticesCount;
            gl.drawArrays(gl.LINE_STRIP, offset, uLineVerticesCount);
        }

        for (let i = 0; i < this.vSegmentsLines.length; i++) {
            const offset = i * vLineVerticesCount;
            gl.drawArrays(gl.LINE_STRIP, vLinesOffset + offset, vLineVerticesCount);
        }

    }


}