import { APOTHEM } from '../roomDimensions.js';
import { makeCanvasTexture } from '../canvasTexture.js';

const BALL_RADIUS = 0.22;

// 공 텍스처: 방 곳곳의 포인트 조명 색(주황/종이색/청록/금색)을 세로
// 줄무늬로 둘러서 비치볼 느낌을 냄 — 구 UV 매핑에서 가로로 감기는
// 텍스처라 이렇게 그리면 자연스럽게 경도 줄무늬가 됨.
function drawBallTexture(ctx, w, h) {
  const colors = ['#d9793a', '#f3ece0', '#4a9fc9', '#f3ece0', '#c79a4b', '#f3ece0'];
  const stripeW = w / colors.length;
  colors.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.floor(i * stripeW), 0, Math.ceil(stripeW) + 1, h);
  });
}

// 방 한가운데 굴러다니는 장난감 공. 어느 "방"에도 속하지 않는 순수한
// 장난감이라 userData.room은 안 붙임 — 대신 userData.isBall을 붙여서
// controls.js가 클릭했을 때 방 이동이 아니라 kick()으로 튕겨내도록
// 구분함. 물리는 진짜 엔진 없이 중력 + 바닥/벽 반사만 흉내 낸 값싼
// 시뮬레이션.
export function buildBall() {
  const tex = makeCanvasTexture(drawBallTexture, 240, 120);
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_RADIUS, 24, 16),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45 })
  );
  // 바닥 위에 올려둠 — x/z 자리는 roomLayout.js가 잡음.
  mesh.position.set(0, BALL_RADIUS, 0);
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.userData.isBall = true;

  const velocity = new THREE.Vector3(0, 0, 0);
  const GRAVITY = -12, RESTITUTION = 0.62, WALL_BOUNCE = 0.75, AIR_DRAG = 0.998;
  // 둥근 방 안쪽 원(벽 가구 앞)을 벗어나지 않게 튕김 — 벽 가구 깊이만큼 여유를 둠.
  const MAX_R = APOTHEM - 0.8 - BALL_RADIUS;

  // 클릭할 때마다 호출 — 무작위 방향으로 튕겨나가게 함.
  mesh.userData.kick = () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2.2 + Math.random() * 1.8;
    velocity.set(Math.cos(angle) * speed, 3.2 + Math.random() * 1.6, Math.sin(angle) * speed);
  };

  // 매 프레임 중력을 적용하고, 바닥/벽에 닿으면 속도를 반사시켜
  // 튕기게 함. 가만히 멈춰 있을 땐(속도 0 + 바닥에 붙어있음) 계산을
  // 건너뛰어 매 프레임 불필요한 연산을 안 하게 함.
  mesh.userData.update = (dt) => {
    if (velocity.lengthSq() < 0.0001 && mesh.position.y <= BALL_RADIUS + 0.001) return;

    velocity.y += GRAVITY * dt;
    velocity.x *= AIR_DRAG; velocity.z *= AIR_DRAG;
    mesh.position.addScaledVector(velocity, dt);

    if (mesh.position.y < BALL_RADIUS) {
      mesh.position.y = BALL_RADIUS;
      if (velocity.y < 0) velocity.y = -velocity.y * RESTITUTION;
      if (Math.abs(velocity.y) < 0.5) velocity.y = 0;
      velocity.x *= 0.88; velocity.z *= 0.88; // 바닥 마찰
    }
    // 원 경계에 닿으면 경계 안으로 되돌리고, 바깥으로 향하던 속도 성분만
    // 뒤집어서(법선 방향 반사) 튕겨나오게 함.
    const r = Math.hypot(mesh.position.x, mesh.position.z);
    if (r > MAX_R) {
      const nx = mesh.position.x / r, nz = mesh.position.z / r;
      mesh.position.x = nx * MAX_R; mesh.position.z = nz * MAX_R;
      const vn = velocity.x * nx + velocity.z * nz;
      if (vn > 0) {
        velocity.x -= (1 + WALL_BOUNCE) * vn * nx;
        velocity.z -= (1 + WALL_BOUNCE) * vn * nz;
      }
    }

    // 굴러가는 방향에 맞게 회전축을 잡아서 실제로 굴러가는 것처럼 보이게 함.
    const speed = Math.hypot(velocity.x, velocity.z);
    if (speed > 0.02) {
      const axis = new THREE.Vector3(-velocity.z, 0, velocity.x).normalize();
      mesh.rotateOnWorldAxis(axis, (speed * dt) / BALL_RADIUS);
    }

    if (velocity.lengthSq() < 0.01 && mesh.position.y <= BALL_RADIUS + 0.001) {
      velocity.set(0, 0, 0);
    }
  };

  return mesh;
}
