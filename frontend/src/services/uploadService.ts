export async function uploadCase(form: any, file: Blob) {
  const formData = new FormData();
  Object.entries(form).forEach(([key, value]) => {
    formData.append(key, String(value));
  });
  formData.append('image', file, `${form.fileName || 'photo'}.jpg`);

  // 실제 백엔드 주소로 변경
  const response = await fetch('/api/diagnosis/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('업로드 실패');
  }

  return response.json(); // { caseId: '...'}
}
