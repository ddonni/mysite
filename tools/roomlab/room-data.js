// 사진(인터넷 인테리어 예시)을 Claude가 보고 쓴 방 설계도 — 2차.
// 1차에서 고친 것: 책상은 창 아래 뒷벽을 따라(왼벽엔 흰 수납장), 의자는 창 쪽 책상을 봄, 카메라를 사진처럼 더 뒤·위로,
// 햇빛을 줄이고 스탠드 불빛으로 저녁 분위기.
window.ROOM = {
  photo: 'photo.png',
  room: {
    w: 3.0, d: 3.6, h: 2.4,
    wall: '#E9E5DF', trim: '#F5F4F1',
    walls: { left: '#E3DFD8' },
    floor: { color: '#D8C8B0', pattern: 'wood' },
  },
  openings: [
    { wall: 'back', kind: 'window', x: -0.45, y: 0.75, w: 1.8, h: 1.5, frame: '#F2F0EC' },
  ],
  camera: { pos: [0.55, 1.75, 3.3], look: [-0.2, 0.6, -0.9], fov: 64 },
  ambient: 0.75,
  sun: 0.55,
  light: [-0.6, 3.0, -2.4],
  lamps: [
    { pos: [0.22, 1.1, -1.45], color: '#FFD8A0', power: 2.2, range: 3.5 },
    { pos: [-0.35, 1.15, -1.45], color: '#FFE4BC', power: 0.8, range: 2 },
  ],
  objects: [
    { name: '커튼', x: -0.45, z: -1.74, rot: 0, parts: [
      { shape: 'box', pos: [-0.6, 0.05, 0], size: [0.65, 2.25, 0.05], color: '#C7C1B8' },
      { shape: 'box', pos: [0.02, 0.05, 0.03], size: [0.62, 2.25, 0.04], color: '#D3CEC6' },
      { shape: 'box', pos: [0.65, 0.05, 0], size: [0.5, 2.25, 0.05], color: '#C7C1B8' },
      { shape: 'box', pos: [0, 2.3, 0], size: [2.0, 0.04, 0.06], color: '#BDB7AF' },
    ] },
    { name: '에어컨', x: 0.95, z: -1.68, rot: 0, parts: [
      { shape: 'box', pos: [0, 1.95, 0], size: [0.85, 0.28, 0.22], color: '#F5F5F3' },
      { shape: 'box', pos: [0, 1.97, 0.11], size: [0.75, 0.03, 0.01], color: '#DCDCD8' },
    ] },
    { name: '창가 책상', x: -0.82, z: -1.47, rot: 0, parts: [
      { shape: 'box', pos: [0, 0.72, 0], size: [1.3, 0.04, 0.55], color: '#F6F5F2' },
      { shape: 'box', pos: [-0.62, 0, 0], size: [0.04, 0.72, 0.5], color: '#F6F5F2' },
      { shape: 'box', pos: [0.62, 0, 0], size: [0.04, 0.72, 0.5], color: '#F6F5F2' },
      // 오른쪽 끝 흰 스탠드(팔이 앞으로 꺾임), 왼쪽 끝 작은 소품들
      { shape: 'cylinder', pos: [0.48, 0.76, -0.12], size: [0.07, 0.02, 0.07], color: '#FFFFFF' },
      { shape: 'cylinder', pos: [0.48, 0.78, -0.12], size: [0.012, 0.45, 0.012], color: '#FFFFFF' },
      { shape: 'box', pos: [0.48, 1.2, -0.02], size: [0.06, 0.03, 0.24], color: '#FFFFFF', rot: [-15, 0, 0] },
      { shape: 'box', pos: [-0.45, 0.76, -0.1], size: [0.18, 0.14, 0.14], color: '#EEE8E0' },
      { shape: 'cylinder', pos: [-0.25, 0.76, -0.12], size: [0.05, 0.16, 0.05], color: '#E8D9C8' },
    ] },
    { name: '왼벽 수납장', x: -1.24, z: -0.1, rot: 0, parts: [
      { shape: 'box', pos: [0, 0, 0], size: [0.5, 0.78, 1.6], color: '#F7F6F3' },
      { shape: 'box', pos: [0.251, 0.25, 0], size: [0.005, 0.01, 1.5], color: '#DAD6CF' },
      { shape: 'box', pos: [0.251, 0.52, 0], size: [0.005, 0.01, 1.5], color: '#DAD6CF' },
      { shape: 'box', pos: [0.251, 0, 0], size: [0.005, 0.78, 0.01], color: '#DAD6CF' },
      { shape: 'box', pos: [-0.05, 0.78, -0.5], size: [0.2, 0.22, 0.12], color: '#E9E2D8' },
    ] },
    { name: '의자', x: -0.82, z: -0.95, rot: 180, parts: [
      { shape: 'box', pos: [0, 0.05, 0], size: [0.55, 0.02, 0.06], color: '#232326', rot: [0, 30, 0] },
      { shape: 'box', pos: [0, 0.05, 0], size: [0.55, 0.02, 0.06], color: '#232326', rot: [0, -30, 0] },
      { shape: 'box', pos: [0, 0.05, 0], size: [0.06, 0.02, 0.55], color: '#232326' },
      { shape: 'cylinder', pos: [0, 0.07, 0], size: [0.022, 0.36, 0.022], color: '#2E2E31' },
      { shape: 'box', pos: [0, 0.43, 0], size: [0.46, 0.07, 0.44], color: '#F7F7F5' },
      { shape: 'box', pos: [0, 0.5, -0.22], size: [0.42, 0.52, 0.05], color: '#F7F7F5', rot: [-8, 0, 0] },
    ] },
    { name: '협탁·스탠드', x: 0.22, z: -1.55, rot: 0, parts: [
      { shape: 'box', pos: [0, 0, 0], size: [0.4, 0.55, 0.36], color: '#F5F4F1' },
      { shape: 'box', pos: [0, 0.27, 0.181], size: [0.3, 0.01, 0.005], color: '#D9D6D0' },
      { shape: 'cylinder', pos: [0, 0.55, 0], size: [0.07, 0.02, 0.07], color: '#FFFFFF' },
      { shape: 'cylinder', pos: [0, 0.57, 0], size: [0.012, 0.48, 0.012], color: '#FFFFFF' },
      { shape: 'sphere', pos: [0, 1.12, 0.04], size: [0.09], color: '#FFE9B8', emissive: true },
    ] },
    { name: '침대', x: 0.95, z: -0.72, rot: 0, parts: [
      { shape: 'box', pos: [0, 0, 0], size: [1.05, 0.3, 2.05], color: '#F3F2EF' },
      { shape: 'box', pos: [0, 0, -1.02], size: [1.1, 0.95, 0.08], color: '#F6F5F2' },
      { shape: 'box', pos: [0, 0.3, 0.02], size: [1.0, 0.18, 1.98], color: '#FBFAF7' },
      { shape: 'box', pos: [0, 0.45, 0.25], size: [1.04, 0.1, 1.5], color: '#DED3C1' },
      { shape: 'box', pos: [0, 0.551, 0.25], size: [1.02, 0.005, 1.48], color: '#CFC3AE' },
      { shape: 'box', pos: [-0.2, 0.48, -0.75], size: [0.5, 0.13, 0.32], color: '#FFFFFF' },
      { shape: 'box', pos: [0.25, 0.48, -0.72], size: [0.4, 0.12, 0.3], color: '#F2EEE7' },
    ] },
    { name: '둥근 러그', x: -0.05, z: 0.35, rot: 0, parts: [
      { shape: 'cylinder', pos: [0, 0, 0], size: [0.8, 0.03, 0.8], color: '#E2D5C2' },
    ] },
    { name: '슬리퍼', x: 0.3, z: 0.0, rot: 25, parts: [
      { shape: 'box', pos: [-0.06, 0.03, 0], size: [0.1, 0.04, 0.26], color: '#CDBFAE' },
      { shape: 'box', pos: [0.07, 0.03, 0.03], size: [0.1, 0.04, 0.26], color: '#CDBFAE' },
    ] },
    { name: '휴지통', x: -1.25, z: 1.25, rot: 0, parts: [
      { shape: 'cylinder', pos: [0, 0, 0], size: [0.14, 0.32, 0.12], color: '#F7F7F5' },
    ] },
  ],
};
