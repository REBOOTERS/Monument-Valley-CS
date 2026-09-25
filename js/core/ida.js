/* ============================================================
   艾达（玩家角色，跨章节共享）：
   圆柱/球体拼装；腿部摆动与身体起伏由玩法层驱动（parts 引用）。
   ============================================================ */
import * as THREE from 'three';
import { PAL } from './materials.js';

const IDA_SCALE = 1.05;

export function buildIda() {
  const group = new THREE.Group();
  group.scale.setScalar(IDA_SCALE);
  const body = new THREE.Group();
  const hair = new THREE.MeshBasicMaterial({ color: '#142d4b' });
  const dress = new THREE.MeshBasicMaterial({ color: '#f49b75' });
  const dressDark = new THREE.MeshBasicMaterial({ color: '#e07f58' });
  const skin = new THREE.MeshBasicMaterial({ color: '#f2c9a8' });
  const white = new THREE.MeshBasicMaterial({ color: '#f4f8fa' });
  const legMat = new THREE.MeshBasicMaterial({ color: '#1b2230' });

  const mkLeg = (x) => {
    const g = new THREE.Group(); g.position.set(x, 0.42, 0);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.42, 8), legMat);
    leg.position.y = -0.21; g.add(leg);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.14), white);
    shoe.position.set(0, -0.42, 0.02); g.add(shoe);
    return g;
  };
  const legL = mkLeg(-0.07), legR = mkLeg(0.07);
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.3, 0.5, 14), dress);
  skirt.position.y = 0.62; body.add(skirt);
  const hem = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.31, 0.05, 14), dressDark);
  hem.position.y = 0.395; body.add(hem);
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.11, 0.12, 12), dress);
  torso.position.y = 0.92; body.add(torso);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.06, 12), white);
  collar.position.y = 0.99; body.add(collar);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.06, 8), skin);
  neck.position.y = 1.03; body.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.135, 16, 12), skin);
  head.position.y = 1.16; body.add(head);
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.165, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), hair);
  hairCap.position.y = 1.165; body.add(hairCap);
  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 10), hair);
  bun.position.set(0, 1.31, -0.07); body.add(bun);
  const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8), skin);
  armL.position.set(-0.15, 0.82, 0); armL.rotation.z = 0.15; body.add(armL);
  const armR = armL.clone(); armR.position.x = 0.15; armR.rotation.z = -0.15; body.add(armR);
  group.add(legL, legR, body);

  return { group, parts: { legL, legR, body } };
}
