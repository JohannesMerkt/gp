// Copyright (c) 2021 LMU Munich Geometry Processing Authors. All rights reserved.
// Created by Changkun Ou <https://changkun.de>.
//
// Use of this source code is governed by a GNU GPLv3 license that can be found
// in the LICENSE file.

import {Vertex, Edge, Face, Halfedge} from './primitive';
import {Vector} from '../linalg/vec';

export class HalfedgeMesh {
  color: Vector;
  wireframe: Vector;

  // The following four fields are the key fields to represent half-edge based
  // meshes.
  verts: Vertex[]; // a list of vertices
  edges: Edge[]; // a list of edges
  faces: Face[]; // a list of faces
  halfedges: Halfedge[]; // a list of halfedges

  /**
   * constructor constructs the halfedge-based mesh representation.
   *
   * @param {string} data is a text string from an .obj file
   */
  constructor(data: string) {
    this.color = new Vector(0, 128, 255, 1);
    this.wireframe = new Vector(125, 125, 125, 1);

    // load .obj file
    const indices: number[] = [];
    const positions: Vector[] = [];
    const lines = data.split('\n');
    for (let line of lines) {
      line = line.trim();
      const tokens = line.split(' ');
      switch (tokens[0].trim()) {
        case 'v':
          positions.push(
            new Vector(
              parseFloat(tokens[1]),
              parseFloat(tokens[2]),
              parseFloat(tokens[3]),
              1
            )
          );
          break;
        case 'f':
          // only load indices of vertices
          for (let i = 1; i < tokens.length; i++) {
            const vv = tokens[i].split('/');
            indices.push(parseInt(vv[0]) - 1);
          }
          break;
      }
    }

    this.verts = [];
    this.edges = [];
    this.faces = [];
    this.halfedges = [];
    this.buildMesh(indices, positions);
  }

  /**
   * buildMesh builds half-edge based connectivity for the given vertex index buffer
   * and vertex position buffer.
   *
   * @param indices is the vertex index buffer that contains all vertex indices.
   * @param positions is the vertex buffer that contains all vertex positions.
   */
  buildMesh(indices: number[], positions: Vector[]) {
// TODO: preinit arrays size for performance improvements
    //this.faces = new Array(indices.length / 3);
    //this.verts = new Array(positions.length);

    // create all vertices at once
    for (let i = 0; i < positions.length; i++) {
      const vert = new Vertex(positions[i]);
      vert.idx = this.verts.length;
      this.verts.push(vert);
    }

    // contains all halfedges that dont belong to a face yet
    const unusedHalfedgeIDs: number[] = [];

    const getOrCreateHalfedge = (startVert: Vertex, endVert: Vertex) => {
      // first search for existing edge
      const halfedgeID = unusedHalfedgeIDs.find(id => {
        if (this.halfedges[id].vert?.idx === startVert.idx) {
          const twin = this.halfedges[id].twin;
          if (twin && twin.vert) {
            if (twin.vert.idx === endVert.idx) {
              return true;
            }
          } else {
            console.log(
              "WARNING HALFEDGE DIDN'T HAVE A TWIN OR TWIN DIDN'T HAVE A VERT"
            );
          }
        }
        return false;
      });
      if (halfedgeID) {
        const unusedId = unusedHalfedgeIDs.findIndex(id => id === halfedgeID);
        if (unusedId > -1) {
          unusedHalfedgeIDs.splice(unusedId, 1);
        } else {
          console.log("WARNING DIDN'T FIND UNUSED HALFEDGE TO DELETE!");
        }
        return this.halfedges[halfedgeID];
      }
      // create new full edge with opposite twins that will be unused for now
      const edge = new Edge();
      edge.idx = this.edges.length;
      this.edges.push(edge);
      const newHalfedge = new Halfedge();
      newHalfedge.idx = this.halfedges.length;
      newHalfedge.vert = startVert;
      newHalfedge.edge = edge;
      this.halfedges.push(newHalfedge);
      const twinHalfedge = new Halfedge();
      twinHalfedge.idx = this.halfedges.length;
      twinHalfedge.vert = endVert;
      twinHalfedge.edge = edge;
      this.halfedges.push(twinHalfedge);

      newHalfedge.twin = twinHalfedge;
      twinHalfedge.twin = newHalfedge;
      edge.halfedge = newHalfedge;

      unusedHalfedgeIDs.push(twinHalfedge.idx as number);
      return newHalfedge;
    };

    const faceCount = indices.length / 3;
    for (let i = 0; i < faceCount; i++) {
      const faceVerts: Vertex[] = [];
      for (let fv = 0; fv < 3; fv++) {
        faceVerts.push(this.verts[indices[i * 3 + fv]]);
      }
      const halfedge1 = getOrCreateHalfedge(faceVerts[0], faceVerts[1]);
      const halfedge2 = getOrCreateHalfedge(faceVerts[1], faceVerts[2]);
      const halfedge3 = getOrCreateHalfedge(faceVerts[2], faceVerts[0]);
      halfedge1.next = halfedge2;
      halfedge2.next = halfedge3;
      halfedge3.next = halfedge1;
      halfedge1.prev = halfedge3;
      halfedge2.prev = halfedge1;
      halfedge3.prev = halfedge2;
      faceVerts[0].halfedge = halfedge1;
      faceVerts[1].halfedge = halfedge2;
      faceVerts[2].halfedge = halfedge3;
      const face = new Face();
      face.idx = this.faces.length;
      face.halfedge = halfedge1;
      halfedge1.face = face;
      halfedge2.face = face;
      halfedge3.face = face;
      this.faces.push(face);
    }

    // mark all unusedHalfedges as boundary edges
    for (let i = 0; i < unusedHalfedgeIDs.length; i++) {
      // TODO: Link all hidden boundary faces
      this.halfedges[unusedHalfedgeIDs[i]].onBoundary = true;
    }
  }
}