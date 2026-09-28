// 업로드 전에 사진을 줄여주는 헬퍼. 휴대폰 사진은 원본이 4000px·수 MB씩
// 되는데, 실제로 쓰이는 곳은 기록 카드(200px 남짓)·상세 창·로비 텍스처
// (512px 이하)뿐이라 원본을 그대로 올리면 페이지를 열 때마다 필요한 양의
// 수십 배를 내려받게 됨 — 긴 변을 MAX_SIDE로 줄이고 JPEG로 다시 저장함.
//
// 어떤 이유로든(오래된 브라우저, 디코딩 실패 등) 줄이지 못하면 원본을
// 그대로 돌려줌 — 사진이 조금 무거워질 뿐 저장 자체는 막지 않음.
const MAX_SIDE = 1200;
const QUALITY = 0.85;
// 이미 이보다 작고 가벼운 사진은 다시 인코딩하면 화질만 나빠지니 그대로 둠.
const SMALL_ENOUGH_BYTES = 300 * 1024;
// GIF(움직이는 사진)·SVG는 캔버스로 다시 그리면 애니메이션/벡터가 깨짐.
const SKIP_TYPES = ['image/gif', 'image/svg+xml'];

export async function shrinkImage(file) {
  if (!file || SKIP_TYPES.includes(file.type)) return file;
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file;

  let bitmap;
  try {
    // 기본값으로 EXIF 회전 정보를 반영해서 디코딩함(세로 사진이 눕지 않게).
    bitmap = await createImageBitmap(file);
  } catch (e) {
    return file;
  }

  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= SMALL_ENOUGH_BYTES) return file;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    // JPEG엔 투명도가 없어서, 투명한 PNG를 그대로 옮기면 배경이 검게 나옴.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
    // 줄였는데 오히려 커졌으면(이미 잘 압축된 작은 사진 등) 원본이 나음.
    if (!blob || blob.size >= file.size) return file;
    const name = (file.name || 'photo').replace(/\.[^.]*$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg' });
  } catch (e) {
    return file;
  } finally {
    if (bitmap.close) bitmap.close();
  }
}
