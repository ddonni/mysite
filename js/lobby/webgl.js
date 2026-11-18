// 이 브라우저가 WebGL을 그릴 수 있는지만 확인하는 아주 작은 헬퍼 —
// main.js가 이 결과로 3D 로비를 시도할지, 곧바로 텍스트 링크 폴백으로
// 갈지 정함.
export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
  } catch (e) {
    return false;
  }
}
