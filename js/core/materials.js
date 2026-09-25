/* ============================================================
   材质与几何工具：按世界法线选色的平面着色（纪念碑谷式纯色面片，
   旋转时颠倒的面也能正确着色）+ 调色板（从参考视频取样）+ 盒体工具
   ============================================================ */
import * as THREE from 'three';

export function facetMaterial(top, px, pz, opts = {}) {
  const dark = opts.dark || new THREE.Color(pz).multiplyScalar(0.8);
  return new THREE.ShaderMaterial({
    uniforms: {
      cTop: { value: new THREE.Color(top) },
      cX: { value: new THREE.Color(px) },
      cZ: { value: new THREE.Color(pz) },
      cDark: { value: new THREE.Color(dark) },
    },
    vertexShader: `
      varying vec3 vN;
      void main(){ vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform vec3 cTop, cX, cZ, cDark; varying vec3 vN;
      void main(){
        vec3 n = normalize(vN);
        float wy = max(n.y,0.0), wx = max(n.x,0.0), wz = max(n.z,0.0);
        float wd = max(-n.y,0.0) + max(-n.x,0.0) + max(-n.z,0.0);
        vec3 c = (cTop*wy + cX*wx + cZ*wz + cDark*wd) / max(wx+wy+wz+wd, 1e-4);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

// 调色板（从视频取样）
export const PAL = {
  stone:  facetMaterial('#cfeef8', '#aedbfc', '#5f96bd'),   // 地板 / 底座
  beam:   facetMaterial('#c6ebf5', '#aacde0', '#61869c'),   // 固定横梁 / 墙顶
  wall:   facetMaterial('#c6ebf5', '#82aac6', '#5f8faa'),   // 拱廊立面
  rotor:  facetMaterial('#c1ecf9', '#84a1be', '#6288a2'),   // 可旋转构件（略深）
  ledge:  facetMaterial('#ccf5ff', '#9cc0dd', '#94b8d5'),   // 小平台（更亮）
  stair:  facetMaterial('#d0f4fa', '#b6dcea', '#658699'),   // 楼梯
  goal:   facetMaterial('#e2fdfe', '#bfe0ea', '#7a9db0'),   // 终点平台
};

export function box(mat, x0, x1, y0, y1, z0, z1) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  const m = new THREE.Mesh(g, mat);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return m;
}
